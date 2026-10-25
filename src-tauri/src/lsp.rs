//! Speaking LSP to a language server running on the remote host.
//!
//! `langserver.rs` installs these servers; this module drives them. A server
//! is started over its own SSH exec channel and talks JSON-RPC over stdio,
//! which is the transport every one of them already speaks — no port to open
//! and nothing listening on the far side.
//!
//! The wire format is Content-Length framed, and that framing stops here: the
//! editor's client wants bare JSON, so this module adds headers on the way out
//! and strips them on the way in.

use crate::langserver::lsp_command;
use crate::ssh::{connect_host, shell_quote, SshConnection};
use crate::store::Store;
use russh::ChannelMsg;
use std::collections::HashMap;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::sync::{mpsc, watch, Mutex as AsyncMutex};
use uuid::Uuid;

/// One language server, running for one workspace on one host.
#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LspSession {
    pub id: String,
    pub host_id: String,
    pub server_id: String,
    pub root: String,
}

/// Payload of `lsp://message` — one JSON-RPC message, headers already removed.
#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct Incoming {
    session_id: String,
    message: String,
}

/// Payload of `lsp://closed`: the server went away on its own.
#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct Closed {
    session_id: String,
    error: Option<String>,
}

struct Running {
    info: LspSession,
    outbox: mpsc::UnboundedSender<String>,
    /// Held only to be dropped — that is what stops the pump.
    _shutdown: watch::Sender<bool>,
}

#[derive(Default)]
pub struct LspManager {
    conns: AsyncMutex<HashMap<String, Arc<SshConnection>>>,
    sessions: AsyncMutex<HashMap<String, Running>>,
}

impl LspManager {
    /// The lock is held across the dial on purpose. Releasing it to connect is
    /// what lets two callers each authenticate a fresh session and throw one
    /// away; language servers start rarely enough that serialising costs
    /// nothing.
    async fn connection(&self, store: &Store, host_id: &str) -> Result<Arc<SshConnection>, String> {
        let mut conns = self.conns.lock().await;
        if let Some(conn) = conns.get(host_id) {
            return Ok(conn.clone());
        }
        let conn = Arc::new(connect_host(store, host_id).await?);
        conns.insert(host_id.to_string(), conn.clone());
        Ok(conn)
    }
}

/// Carry messages both ways until the server stops or the session is closed.
async fn pump(
    app: AppHandle,
    mut channel: russh::Channel<russh::client::Msg>,
    mut outbox: mpsc::UnboundedReceiver<String>,
    info: LspSession,
    mut stop: watch::Receiver<bool>,
) {
    let mut pending: Vec<u8> = Vec::new();

    let error = loop {
        tokio::select! {
            _ = stop.changed() => return, // closed deliberately
            queued = outbox.recv() => match queued {
                Some(message) => {
                    if let Err(e) = channel.data_bytes(frame(&message)).await {
                        break Some(format!("could not reach the language server: {e}"));
                    }
                }
                None => break None,
            },
            event = channel.wait() => match event {
                Some(ChannelMsg::Data { data }) => {
                    pending.extend_from_slice(&data);
                    while let Some(message) = take_message(&mut pending) {
                        let _ = app.emit(
                            "lsp://message",
                            Incoming { session_id: info.id.clone(), message },
                        );
                    }
                }
                // Language servers log heavily to stderr; none of it is protocol.
                Some(ChannelMsg::ExtendedData { .. }) => {}
                Some(ChannelMsg::ExitStatus { exit_status }) if exit_status != 0 => {
                    break Some(format!(
                        "the language server exited with status {exit_status} — it may not be installed on this host"
                    ))
                }
                Some(ChannelMsg::Eof) | Some(ChannelMsg::Close) | Some(ChannelMsg::ExitStatus { .. }) | None => {
                    break None
                }
                _ => {}
            },
        }
    };

    app.state::<LspManager>()
        .sessions
        .lock()
        .await
        .remove(&info.id);
    let _ = app.emit(
        "lsp://closed",
        Closed {
            session_id: info.id,
            error,
        },
    );
}

#[tauri::command]
pub async fn lsp_start(
    app: AppHandle,
    store: State<'_, Store>,
    lsp: State<'_, LspManager>,
    host_id: String,
    server_id: String,
    root: String,
) -> Result<LspSession, String> {
    let command = lsp_command(&server_id).ok_or_else(|| {
        format!("'{server_id}' can be installed from here, but editing support for it is not wired up yet")
    })?;

    // One server per workspace, shared by every file open in it — which is
    // what the servers themselves expect, and far cheaper than one each.
    let existing = lsp
        .sessions
        .lock()
        .await
        .values()
        .find(|r| {
            r.info.host_id == host_id && r.info.server_id == server_id && r.info.root == root
        })
        .map(|r| r.info.clone());
    if let Some(info) = existing {
        return Ok(info);
    }

    let conn = lsp.connection(&store, &host_id).await?;
    let channel = conn
        .channel_open_session()
        .await
        .map_err(|e| e.to_string())?;

    // Started inside the workspace: several servers look for their config
    // relative to the working directory, and it costs nothing when they don't.
    let launch = format!("cd {} 2>/dev/null; exec {command}", shell_quote(&root));
    channel
        .exec(true, launch)
        .await
        .map_err(|e| format!("could not start {command}: {e}"))?;

    let info = LspSession {
        id: Uuid::new_v4().to_string(),
        host_id,
        server_id,
        root,
    };
    let (outbox, inbox) = mpsc::unbounded_channel();
    let (shutdown, stop) = watch::channel(false);

    lsp.sessions.lock().await.insert(
        info.id.clone(),
        Running {
            info: info.clone(),
            outbox,
            _shutdown: shutdown,
        },
    );
    tauri::async_runtime::spawn(pump(app, channel, inbox, info.clone(), stop));

    Ok(info)
}

#[tauri::command]
pub async fn lsp_send(
    lsp: State<'_, LspManager>,
    session_id: String,
    message: String,
) -> Result<(), String> {
    let outbox = lsp
        .sessions
        .lock()
        .await
        .get(&session_id)
        .map(|r| r.outbox.clone())
        .ok_or_else(|| "that language server is no longer running".to_string())?;
    outbox
        .send(message)
        .map_err(|_| "the language server has stopped".to_string())
}

#[tauri::command]
pub async fn lsp_stop(lsp: State<'_, LspManager>, session_id: String) -> Result<(), String> {
    lsp.sessions.lock().await.remove(&session_id);
    Ok(())
}

/// Drop every server on a host, and the connection carrying them.
#[tauri::command]
pub async fn lsp_stop_host(lsp: State<'_, LspManager>, host_id: String) -> Result<(), String> {
    lsp.sessions
        .lock()
        .await
        .retain(|_, r| r.info.host_id != host_id);
    lsp.conns.lock().await.remove(&host_id);
    Ok(())
}

// ---- Content-Length framing ----

/// Header names are ASCII and `len()` on a `String` is bytes, which is exactly
/// what Content-Length counts — a multi-byte body must not be measured in
/// characters.
fn frame(message: &str) -> Vec<u8> {
    let mut out = format!("Content-Length: {}\r\n\r\n", message.len()).into_bytes();
    out.extend_from_slice(message.as_bytes());
    out
}

/// Take one complete message off the front of the buffer, if there is one.
///
/// Reads arrive in whatever sizes the network chose, so a message may be split
/// across several of them or several may arrive at once; the buffer keeps
/// whatever is left over for the next read.
fn take_message(buffer: &mut Vec<u8>) -> Option<String> {
    loop {
        let end = buffer.windows(4).position(|w| w == b"\r\n\r\n")? + 4;
        let headers = String::from_utf8_lossy(&buffer[..end - 4]).into_owned();

        let length = headers.lines().find_map(|line| {
            let (name, value) = line.split_once(':')?;
            if !name.trim().eq_ignore_ascii_case("content-length") {
                return None;
            }
            value.trim().parse::<usize>().ok()
        });

        let Some(length) = length else {
            // A header block whose size we cannot read is not something we can
            // skip past safely by guessing. Drop it and look for the next one,
            // rather than stalling on it for the life of the session.
            buffer.drain(..end);
            continue;
        };

        if buffer.len() < end + length {
            return None; // the body is still arriving
        }
        let body = String::from_utf8_lossy(&buffer[end..end + length]).into_owned();
        buffer.drain(..end + length);
        return Some(body);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn wire(message: &str) -> Vec<u8> {
        frame(message)
    }

    #[test]
    fn frames_a_message_with_its_byte_length() {
        let framed = frame(r#"{"id":1}"#);
        assert_eq!(framed, b"Content-Length: 8\r\n\r\n{\"id\":1}".to_vec());
    }

    /// Content-Length counts bytes, not characters. Measuring an accented or
    /// CJK body in characters truncates it and desynchronises the stream.
    #[test]
    fn frames_multibyte_bodies_by_byte_count() {
        let message = r#"{"t":"héllo"}"#;
        let framed = frame(message);
        let header = String::from_utf8_lossy(&framed[..20]).into_owned();
        assert!(
            header.starts_with(&format!("Content-Length: {}", message.len())),
            "unexpected header: {header}"
        );
        // And it round-trips.
        let mut buffer = framed;
        assert_eq!(take_message(&mut buffer).as_deref(), Some(message));
    }

    #[test]
    fn reads_one_complete_message() {
        let mut buffer = wire(r#"{"id":1}"#);
        assert_eq!(take_message(&mut buffer).as_deref(), Some(r#"{"id":1}"#));
        assert!(buffer.is_empty());
        assert_eq!(take_message(&mut buffer), None);
    }

    /// The common case on a real connection: a message split over two reads.
    #[test]
    fn waits_for_a_body_that_is_still_arriving() {
        let framed = wire(r#"{"id":1,"x":"yz"}"#);
        let (head, tail) = framed.split_at(framed.len() - 5);

        let mut buffer = head.to_vec();
        assert_eq!(take_message(&mut buffer), None, "must not return a partial body");

        buffer.extend_from_slice(tail);
        assert_eq!(
            take_message(&mut buffer).as_deref(),
            Some(r#"{"id":1,"x":"yz"}"#)
        );
    }

    /// A header split mid-way is equally ordinary.
    #[test]
    fn waits_for_headers_that_are_still_arriving() {
        let mut buffer = b"Content-Len".to_vec();
        assert_eq!(take_message(&mut buffer), None);
        buffer.extend_from_slice(b"gth: 2\r\n\r\n{}");
        assert_eq!(take_message(&mut buffer).as_deref(), Some("{}"));
    }

    #[test]
    fn reads_several_messages_from_one_read() {
        let mut buffer = wire(r#"{"id":1}"#);
        buffer.extend_from_slice(&wire(r#"{"id":2}"#));
        buffer.extend_from_slice(&wire(r#"{"id":3}"#));

        let mut seen = Vec::new();
        while let Some(message) = take_message(&mut buffer) {
            seen.push(message);
        }
        assert_eq!(seen, vec![r#"{"id":1}"#, r#"{"id":2}"#, r#"{"id":3}"#]);
        assert!(buffer.is_empty());
    }

    /// Servers are allowed to send other headers, in any case they like.
    #[test]
    fn tolerates_extra_headers_and_odd_casing() {
        let mut buffer =
            b"content-length: 2\r\nContent-Type: application/vscode-jsonrpc; charset=utf-8\r\n\r\n{}"
                .to_vec();
        assert_eq!(take_message(&mut buffer).as_deref(), Some("{}"));
    }

    /// A block we cannot size must not wedge the stream — the next message
    /// still has to come through.
    #[test]
    fn skips_a_header_block_with_no_length() {
        let mut buffer = b"Proxy-Note: hello\r\n\r\n".to_vec();
        buffer.extend_from_slice(&wire(r#"{"id":9}"#));
        assert_eq!(take_message(&mut buffer).as_deref(), Some(r#"{"id":9}"#));
    }
}
