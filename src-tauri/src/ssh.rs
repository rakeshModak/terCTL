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

/// How many bastions deep a chain may go before we call it a mistake. OpenSSH
/// imposes no limit, but each hop is a live session and a misconfigured chain
/// is far more likely than a genuinely deep one.
const MAX_JUMPS: usize = 8;

/// A connected session, plus the bastion sessions it rides on.
///
/// The jump sessions are never used directly — they are held only so they
/// outlive the session tunnelled through them. Dropping a `Handle` tears its
/// session down, which would collapse the `direct-tcpip` channel underneath
/// everything above it, so the whole chain has to stay owned together.
///
/// Derefs to the innermost session, so callers use it exactly as they used the
/// bare `Handle` before.
pub(crate) struct SshConnection {
    session: Handle<ClientHandler>,
    _jumps: Vec<Handle<ClientHandler>>,
}

impl std::ops::Deref for SshConnection {
    type Target = Handle<ClientHandler>;

    fn deref(&self) -> &Self::Target {
        &self.session
    }
}

pub(crate) async fn connect_host(store: &Store, host_id: &str) -> Result<SshConnection, String> {
    let hosts = store.list_hosts().map_err(|e| e.to_string())?;

    // Walk the jump chain outward from the target so the bastions can then be
    // dialled in order. `seen` catches a host that routes through itself,
    // directly or round a longer loop — without it that recurses forever.
    let mut chain: Vec<Host> = Vec::new();
    let mut seen: Vec<String> = Vec::new();
    let mut cursor = host_id.to_string();
    loop {
        if seen.contains(&cursor) {
            return Err(format!(
                "jump chain loops back to '{}' — a host cannot be reached through itself",
                hosts
                    .iter()
                    .find(|h| h.id == cursor)
                    .map(|h| h.label.as_str())
                    .unwrap_or(&cursor)
            ));
        }
        seen.push(cursor.clone());

        let host = hosts
            .iter()
            .find(|h| h.id == cursor)
            .cloned()
            .ok_or_else(|| {
                if chain.is_empty() {
                    "host not found".to_string()
                } else {
                    "jump host not found — it may have been deleted".to_string()
                }
            })?;

        let next = host.jump_host_id.clone();
        chain.push(host);
        match next {
            Some(id) if !id.is_empty() => cursor = id,
            _ => break,
        }
        if chain.len() > MAX_JUMPS {
            return Err(format!("jump chain is deeper than {MAX_JUMPS} hosts"));
        }
    }

    // `chain` runs target-first; dial from the outermost bastion inward.
    chain.reverse();
    let mut jumps: Vec<Handle<ClientHandler>> = Vec::new();
    let mut session: Option<Handle<ClientHandler>> = None;

    for host in chain {
        let next = match session.take() {
            // First hop: a plain TCP connection to the bastion.
            None => open_direct(store, &host).await?,
            // Every hop after opens a channel through the previous session and
            // speaks SSH over it, which is what `ssh -J` does.
            Some(previous) => {
                let tunnel = previous
                    .channel_open_direct_tcpip(
                        host.hostname.clone(),
                        host.port as u32,
                        "127.0.0.1",
                        0,
                    )
                    .await
                    .map_err(|e| {
                        format!("could not open a tunnel to {}: {e}", host.label)
                    })?;
                jumps.push(previous);
                open_over(store, &host, tunnel.into_stream()).await?
            }
        };
        session = Some(next);
    }

    Ok(SshConnection {
        session: session.ok_or_else(|| "host not found".to_string())?,
        _jumps: jumps,
    })
}

fn client_config() -> Arc<client::Config> {
    Arc::new(client::Config {
        keepalive_interval: Some(std::time::Duration::from_secs(20)),
        keepalive_max: 3,
        window_size: 8 * 1024 * 1024,
        ..Default::default()
    })
}

/// Host key state for one hop. Every hop is verified against its own pinned
/// fingerprint — tunnelling through a bastion does not make the next server's
/// identity anyone else's problem.
fn handler_for(
    store: &Store,
    host: &Host,
) -> Result<(ClientHandler, Option<String>, Arc<StdMutex<Option<String>>>), String> {
    let expected = store.get_known_host_key(&host.id).map_err(|e| e.to_string())?;
    let observed = Arc::new(StdMutex::new(None));
    Ok((
        ClientHandler {
            expected_fingerprint: expected.clone(),
            observed_fingerprint: observed.clone(),
        },
        expected,
        observed,
    ))
}

fn pin_on_first_sight(
    store: &Store,
    host: &Host,
    expected: Option<String>,
    observed: &Arc<StdMutex<Option<String>>>,
) -> Result<(), String> {
    if expected.is_none() {
        if let Some(fp) = observed.lock().unwrap().clone() {
            store
                .set_known_host_key(&host.id, &fp)
                .map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

fn connect_err(host: &Host, e: russh::Error) -> String {
    match e {
        russh::Error::UnknownKey => format!(
            "host key mismatch for {} — the server's identity may have changed. Refusing to connect.",
            host.label
        ),
        other => other.to_string(),
    }
}

async fn open_direct(store: &Store, host: &Host) -> Result<Handle<ClientHandler>, String> {
    let (handler, expected, observed) = handler_for(store, host)?;
    let mut session = client::connect(
        client_config(),
        (host.hostname.as_str(), host.port),
        handler,
    )
    .await
    .map_err(|e| connect_err(host, e))?;

    pin_on_first_sight(store, host, expected, &observed)?;
    authenticate(&mut session, host).await?;
    Ok(session)
}

/// Same as `open_direct`, but speaking SSH over an already-open stream — the
/// channel a bastion gave us — instead of dialling TCP ourselves.
async fn open_over<S>(store: &Store, host: &Host, stream: S) -> Result<Handle<ClientHandler>, String>
where
    S: tokio::io::AsyncRead + tokio::io::AsyncWrite + Unpin + Send + 'static,
{
    let (handler, expected, observed) = handler_for(store, host)?;
    let mut session = client::connect_stream(client_config(), stream, handler)
        .await
        .map_err(|e| connect_err(host, e))?;

    pin_on_first_sight(store, host, expected, &observed)?;
    authenticate(&mut session, host).await?;
    Ok(session)
}

/// Payload of the `host://os` event.
#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct HostOsDetected {
    host_id: String,
    os: String,
}

/// Identify the remote OS the first time a host is reached, and remember it.
///
/// Runs before the shell is opened, so it costs one round trip on the very
/// first connect and nothing afterwards. Failure is not an error worth
/// surfacing — the host simply stays unmarked and is probed again next time.
async fn record_os_on_first_connect(
    app: &AppHandle,
    store: &Store,
    host_id: &str,
    session: &Handle<ClientHandler>,
) {
    if store.get_host_os(host_id).ok().flatten().is_some() {
        return;
    }
    let Some(os) = crate::osinfo::detect_os(session).await else {
        return;
    };
    if store.set_host_os(host_id, &os).is_err() {
        return;
    }
    let _ = app.emit(
        "host://os",
        HostOsDetected {
            host_id: host_id.to_string(),
            os,
        },
    );
}

#[tauri::command]
pub async fn ssh_connect(
    app: AppHandle,
    store: State<'_, Store>,
    manager: State<'_, SessionManager>,
    host_id: String,
) -> Result<String, String> {
    let session = connect_host(&store, &host_id).await?;
    record_os_on_first_connect(&app, &store, &host_id, &session).await;

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
    use crate::models::NewHost;
    use rusqlite::Connection;
    use std::sync::Mutex;

    fn test_store() -> Store {
        let conn = Connection::open_in_memory().unwrap();
        Store::init_schema(&conn).unwrap();
        Store(Mutex::new(conn))
    }

    fn host_named(store: &Store, label: &str) -> String {
        store
            .add_host(NewHost {
                label: label.into(),
                hostname: format!("{label}.internal"),
                port: 22,
                username: "deploy".into(),
                auth_kind: AuthKind::Key,
                key_ref: Some("k".into()),
                group_id: None,
                tags: vec![],
                accent: None,
                term_scheme: None,
                jump_host_id: None,
            })
            .unwrap()
            .id
    }

    /// `unwrap_err` would need `SshConnection: Debug`, and `Handle` is not —
    /// deriving it just for tests is not worth it.
    async fn expect_rejected(store: &Store, host_id: &str) -> String {
        match connect_host(store, host_id).await {
            Ok(_) => panic!("expected the chain to be rejected before dialling"),
            Err(e) => e,
        }
    }

    fn route_via(store: &Store, host_id: &str, jump_id: Option<&str>) {
        let mut host = store
            .list_hosts()
            .unwrap()
            .into_iter()
            .find(|h| h.id == host_id)
            .unwrap();
        host.jump_host_id = jump_id.map(str::to_string);
        store.update_host(host).unwrap();
    }

    /// A host routed through itself must be rejected while the chain is being
    /// walked. Getting this wrong loops forever rather than failing, so it
    /// never reaches the network — which is exactly why it is testable here.
    #[tokio::test]
    async fn rejects_a_host_that_jumps_through_itself() {
        let store = test_store();
        let a = host_named(&store, "a");
        route_via(&store, &a, Some(&a));

        let err = expect_rejected(&store, &a).await;
        assert!(err.contains("loops back"), "unexpected error: {err}");
    }

    #[tokio::test]
    async fn rejects_a_longer_jump_loop() {
        let store = test_store();
        let a = host_named(&store, "a");
        let b = host_named(&store, "b");
        let c = host_named(&store, "c");
        // a → b → c → a
        route_via(&store, &a, Some(&b));
        route_via(&store, &b, Some(&c));
        route_via(&store, &c, Some(&a));

        let err = expect_rejected(&store, &a).await;
        assert!(err.contains("loops back"), "unexpected error: {err}");
    }

    #[tokio::test]
    async fn rejects_a_chain_deeper_than_the_limit() {
        let store = test_store();
        let ids: Vec<String> = (0..MAX_JUMPS + 3)
            .map(|i| host_named(&store, &format!("h{i}")))
            .collect();
        // Each host routes through the next, ending in a direct connection.
        for pair in ids.windows(2) {
            route_via(&store, &pair[0], Some(&pair[1]));
        }

        let err = expect_rejected(&store, &ids[0]).await;
        assert!(err.contains("deeper than"), "unexpected error: {err}");
    }

    /// A bastion that was deleted leaves the reference dangling. Deleting
    /// through the store detaches it, but an import can still carry one.
    #[tokio::test]
    async fn reports_a_missing_jump_host() {
        let store = test_store();
        let a = host_named(&store, "a");
        route_via(&store, &a, Some("does-not-exist"));

        let err = expect_rejected(&store, &a).await;
        assert!(err.contains("jump host not found"), "unexpected error: {err}");
    }

    #[tokio::test]
    async fn deleting_a_bastion_detaches_the_hosts_behind_it() {
        let store = test_store();
        let bastion = host_named(&store, "bastion");
        let target = host_named(&store, "target");
        route_via(&store, &target, Some(&bastion));

        store.delete_host(&bastion).unwrap();

        let host = store
            .list_hosts()
            .unwrap()
            .into_iter()
            .find(|h| h.id == target)
            .unwrap();
        assert_eq!(host.jump_host_id, None);
    }

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
            os: None,
            jump_host_id: None,
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
