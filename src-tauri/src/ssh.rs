use crate::models::{AuthKind, Host};
use crate::session::{SessionCommand, SessionManager, TermClosed, TermOutput};
use crate::store::Store;
use crate::vault::{self, SecretKind};
use russh::client::{self, Handle};
use russh::keys::ssh_key::PublicKey;
use russh::keys::{decode_secret_key, load_secret_key, HashAlg, PrivateKeyWithHashAlg};
use russh::{ChannelMsg, Disconnect};
use std::sync::{Arc, Mutex as StdMutex};
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::sync::mpsc;
use uuid::Uuid;

pub(crate) struct ClientHandler {
    expected_fingerprint: Option<String>,
    observed_fingerprint: Arc<StdMutex<Option<String>>>,
}

impl client::Handler for ClientHandler {
    type Error = russh::Error;

    async fn check_server_key(&mut self, key: &PublicKey) -> Result<bool, Self::Error> {
        let fingerprint = key.fingerprint(HashAlg::Sha256).to_string();
        *self.observed_fingerprint.lock().unwrap() = Some(fingerprint.clone());
        match &self.expected_fingerprint {
            Some(expected) => Ok(*expected == fingerprint),
            None => Ok(true),
        }
    }
}

fn expand_tilde(path: &str) -> String {
    match path.strip_prefix("~/") {
        Some(rest) => match std::env::var("HOME") {
            Ok(home) => format!("{home}/{rest}"),
            Err(_) => path.to_string(),
        },
        None => path.to_string(),
    }
}

async fn authenticate(session: &mut Handle<ClientHandler>, host: &Host) -> Result<(), String> {
    let auth_result = match host.auth_kind {
        AuthKind::Password => {
            let password = vault::get_secret(&host.id, SecretKind::Password)
                .map_err(|e| e.to_string())?
                .ok_or_else(|| "no password stored for this host".to_string())?;
            session
                .authenticate_password(host.username.clone(), password)
                .await
                .map_err(|e| e.to_string())?
        }
        AuthKind::Key => {
            let passphrase = vault::get_secret(&host.id, SecretKind::Passphrase)
                .map_err(|e| e.to_string())?;
            let stored_key =
                vault::get_secret(&host.id, SecretKind::PrivateKey).map_err(|e| e.to_string())?;
            let key_pair = match stored_key {
                Some(pem) => decode_secret_key(&pem, passphrase.as_deref())
                    .map_err(|e| format!("failed to decode the stored private key: {e}"))?,
                None => {
                    let key_ref = host
                        .key_ref
                        .as_deref()
                        .ok_or_else(|| "no private key configured for this host".to_string())?;
                    let key_path = expand_tilde(key_ref);
                    load_secret_key(&key_path, passphrase.as_deref())
                        .map_err(|e| format!("failed to load private key '{key_path}': {e}"))?
                }
            };
            let hash_alg = session
                .best_supported_rsa_hash()
                .await
                .map_err(|e| e.to_string())?
                .flatten();
            session
                .authenticate_publickey(
                    host.username.clone(),
                    PrivateKeyWithHashAlg::new(Arc::new(key_pair), hash_alg),
                )
                .await
                .map_err(|e| e.to_string())?
        }
        AuthKind::Agent => return Err("agent authentication is not supported yet".to_string()),
    };

    if !auth_result.success() {
        return Err("authentication rejected by server".to_string());
    }
    Ok(())
}

pub(crate) async fn connect_host(
    store: &Store,
    host_id: &str,
) -> Result<Handle<ClientHandler>, String> {
    let host = store
        .list_hosts()
        .map_err(|e| e.to_string())?
        .into_iter()
        .find(|h| h.id == host_id)
        .ok_or_else(|| "host not found".to_string())?;

    let expected_fingerprint = store.get_known_host_key(host_id).map_err(|e| e.to_string())?;
    let observed_fingerprint = Arc::new(StdMutex::new(None));

    let handler = ClientHandler {
        expected_fingerprint: expected_fingerprint.clone(),
        observed_fingerprint: observed_fingerprint.clone(),
    };

    let config = Arc::new(client::Config {
        keepalive_interval: Some(std::time::Duration::from_secs(20)),
        keepalive_max: 3,
        ..Default::default()
    });
    let mut session = client::connect(config, (host.hostname.as_str(), host.port), handler)
        .await
        .map_err(|e| match e {
            russh::Error::UnknownKey => {
                "host key mismatch — the server's identity may have changed. Refusing to connect."
                    .to_string()
            }
            other => other.to_string(),
        })?;

    if expected_fingerprint.is_none() {
        if let Some(fp) = observed_fingerprint.lock().unwrap().clone() {
            store
                .set_known_host_key(host_id, &fp)
                .map_err(|e| e.to_string())?;
        }
    }

    authenticate(&mut session, &host).await?;
    Ok(session)
}

#[tauri::command]
pub async fn ssh_connect(
    app: AppHandle,
    store: State<'_, Store>,
    manager: State<'_, SessionManager>,
    host_id: String,
) -> Result<String, String> {
    let mut session = connect_host(&store, &host_id).await?;

    let mut channel = session
        .channel_open_session()
        .await
        .map_err(|e| e.to_string())?;
    channel
        .request_pty(false, "xterm-256color", 80, 24, 0, 0, &[])
        .await
        .map_err(|e| e.to_string())?;
    channel
        .request_shell(false)
        .await
        .map_err(|e| e.to_string())?;

    let session_id = Uuid::new_v4().to_string();
    let (cmd_tx, mut cmd_rx) = mpsc::unbounded_channel::<SessionCommand>();
    manager.register(session_id.clone(), cmd_tx);

    let task_app = app.clone();
    let task_session_id = session_id.clone();
    tauri::async_runtime::spawn(async move {
        let mut close_error: Option<String> = None;

        loop {
            tokio::select! {
                cmd = cmd_rx.recv() => match cmd {
                    Some(SessionCommand::Input(bytes)) => {
                        if let Err(e) = channel.data_bytes(bytes).await {
                            close_error = Some(e.to_string());
                            break;
                        }
                    }
                    Some(SessionCommand::Resize { cols, rows }) => {
                        let _ = channel.window_change(cols, rows, 0, 0).await;
                    }
                    Some(SessionCommand::Close) | None => {
                        let _ = channel.eof().await;
                        break;
                    }
                },
                msg = channel.wait() => match msg {
                    Some(ChannelMsg::Data { data }) | Some(ChannelMsg::ExtendedData { data, .. }) => {
                        let _ = task_app.emit(
                            "term://output",
                            TermOutput { session_id: task_session_id.clone(), data: data.to_vec() },
                        );
                    }
                    Some(ChannelMsg::ExitStatus { .. })
                    | Some(ChannelMsg::Eof)
                    | Some(ChannelMsg::Close)
                    | None => break,
                    _ => {}
                },
            }
        }

        let _ = session
            .disconnect(Disconnect::ByApplication, "", "English")
            .await;
        task_app.state::<SessionManager>().remove(&task_session_id);
        let _ = task_app.emit(
            "term://closed",
            TermClosed {
                session_id: task_session_id,
                error: close_error,
            },
        );
    });

    Ok(session_id)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Opt-in integration test against a real SSH server — there is no way
    /// to exercise PTY streaming without one. Run explicitly with:
    ///   TERCTL_TEST_HOST=<ip> TERCTL_TEST_USER=<user> \
    ///   TERCTL_TEST_KEY=<path> cargo test connect_authenticate -- --ignored --nocapture
    #[tokio::test]
    #[ignore]
    async fn connect_authenticate_and_run_command() {
        let hostname = std::env::var("TERCTL_TEST_HOST").expect("set TERCTL_TEST_HOST");
        let username = std::env::var("TERCTL_TEST_USER").unwrap_or_else(|_| "root".into());
        let key_ref = std::env::var("TERCTL_TEST_KEY").expect("set TERCTL_TEST_KEY");

        let host = Host {
            id: "integration-test".into(),
            label: "integration-test".into(),
            hostname,
            port: 22,
            username,
            auth_kind: AuthKind::Key,
            key_ref: Some(key_ref),
            group_id: None,
            tags: vec![],
            accent: None,
            term_scheme: None,
        };

        let handler = ClientHandler {
            expected_fingerprint: None,
            observed_fingerprint: Arc::new(StdMutex::new(None)),
        };
        let config = Arc::new(client::Config::default());
        let mut session = client::connect(config, (host.hostname.as_str(), host.port), handler)
            .await
            .expect("tcp connect + key exchange should succeed");

        authenticate(&mut session, &host)
            .await
            .expect("authentication should succeed");

        let mut channel = session
            .channel_open_session()
            .await
            .expect("open channel");
        channel
            .request_pty(false, "xterm-256color", 80, 24, 0, 0, &[])
            .await
            .expect("request pty");
        channel.request_shell(false).await.expect("request shell");

        channel
            .data_bytes(b"echo TERCTL_OK\n".to_vec())
            .await
            .expect("send command");

        let mut collected = Vec::new();
        let deadline = tokio::time::Instant::now() + std::time::Duration::from_secs(10);
        loop {
            let remaining = deadline.saturating_duration_since(tokio::time::Instant::now());
            if remaining.is_zero() {
                panic!(
                    "timed out waiting for output, got so far: {:?}",
                    String::from_utf8_lossy(&collected)
                );
            }
            match tokio::time::timeout(remaining, channel.wait()).await {
                Ok(Some(ChannelMsg::Data { data })) => {
                    collected.extend_from_slice(&data);
                    if String::from_utf8_lossy(&collected).contains("TERCTL_OK") {
                        break;
                    }
                }
                Ok(Some(_)) => {}
                Ok(None) => panic!("channel closed before we saw the expected output"),
                Err(_) => panic!("timed out waiting for output"),
            }
        }

        channel.eof().await.ok();
        session
            .disconnect(Disconnect::ByApplication, "", "English")
            .await
            .ok();
    }
}
