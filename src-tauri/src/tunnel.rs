//! SSH local port forwarding — the `ssh -L` half of the in-app browser.
//!
//! A service bound to `127.0.0.1` on a remote host is, by definition, not
//! reachable from this machine. Forwarding fixes that without touching the
//! server's firewall: we bind a listener on *our* loopback, and every
//! connection to it is carried over the SSH session as a `direct-tcpip`
//! channel that the server opens against its own loopback. The browser then
//! talks to `http://127.0.0.1:<local>` and the bytes come out at
//! `127.0.0.1:<remote>` on the far side.
//!
//! The listener is loopback-only and never configurable. Binding `0.0.0.0`
//! would republish someone's private service to the whole LAN, which is the
//! opposite of what a debugging tool should do.

use crate::ssh::{connect_host, SshConnection};
use crate::store::Store;
use russh::ChannelMsg;
use std::collections::HashMap;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use tokio::sync::{watch, Mutex as AsyncMutex};
use uuid::Uuid;

/// A live forward. `local_port` is what a browser should be pointed at.
#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TunnelInfo {
    pub id: String,
    pub host_id: String,
    /// What the *server* resolves — almost always `127.0.0.1`, but a forward
    /// may also target a third box the server can reach and we cannot.
    pub remote_host: String,
    pub remote_port: u16,
    pub local_port: u16,
}

/// One remote socket in LISTEN state, as reported by `ss` or `netstat`.
#[derive(Clone, Debug, PartialEq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListeningPort {
    pub port: u16,
    /// The bind address exactly as the remote reported it (`127.0.0.1`,
    /// `0.0.0.0`, `::`, …), for display.
    pub address: String,
    /// True when every socket on this port is bound to loopback — i.e. this
    /// is precisely the case a forward exists to solve.
    pub loopback: bool,
    pub process: Option<String>,
    pub pid: Option<u32>,
}

/// Payload of `tunnel://closed`: the forward stopped on its own, so whatever
/// pane was pointed at it is now showing a dead port.
#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct TunnelClosed {
    tunnel_id: String,
    error: Option<String>,
}

struct Tunnel {
    info: TunnelInfo,
    /// Held only to be dropped: the accept loop and every in-flight pump task
    /// hold a receiver, and a dropped sender wakes all of them at once.
    _shutdown: watch::Sender<bool>,
}

/// Forwards, plus one reused SSH connection per host to carry them.
///
/// The connection is this module's own — separate from the terminal PTY, the
/// SFTP browser and the metrics poller — so closing a shell does not collapse
/// a forward you are still browsing through.
#[derive(Default)]
pub struct TunnelManager {
    conns: AsyncMutex<HashMap<String, Arc<SshConnection>>>,
    tunnels: AsyncMutex<HashMap<String, Tunnel>>,
}

impl TunnelManager {
    async fn connection(&self, store: &Store, host_id: &str) -> Result<Arc<SshConnection>, String> {
        if let Some(conn) = self.conns.lock().await.get(host_id) {
            return Ok(conn.clone());
        }
        let conn = Arc::new(connect_host(store, host_id).await?);
        self.conns
            .lock()
            .await
            .insert(host_id.to_string(), conn.clone());
        Ok(conn)
    }

    async fn drop_connection(&self, host_id: &str) {
        self.conns.lock().await.remove(host_id);
    }
}

/// Accept loop for one forward. Returns quietly when the tunnel is closed on
/// purpose, and emits `tunnel://closed` when the SSH session under it dies.
async fn serve(
    app: AppHandle,
    conn: Arc<SshConnection>,
    listener: TcpListener,
    info: TunnelInfo,
    mut stop: watch::Receiver<bool>,
) {
    let fatal = loop {
        let tcp = tokio::select! {
            _ = stop.changed() => return, // closed deliberately
            accepted = listener.accept() => match accepted {
                Ok((tcp, _peer)) => tcp,
                Err(e) => break format!("stopped listening on 127.0.0.1:{}: {e}", info.local_port),
            },
        };

        // Nagle off: a forwarded HTTP response is a chain of small writes, and
        // batching them adds a visible delay to every page load.
        let _ = tcp.set_nodelay(true);

        match conn
            .channel_open_direct_tcpip(
                info.remote_host.clone(),
                info.remote_port as u32,
                "127.0.0.1",
                info.local_port as u32,
            )
            .await
        {
            Ok(channel) => {
                tauri::async_runtime::spawn(crate::webframe::relay(tcp, channel, stop.clone()));
            }
            // The server refused this one connection — nothing is listening on
            // the far side yet. That is an ordinary state for a dev server that
            // has not booted, so the forward stays up and the browser simply
            // sees the connection drop. Anything else means the session itself
            // is gone and no later connection can succeed either.
            Err(russh::Error::ChannelOpenFailure(_)) => drop(tcp),
            Err(e) => {
                break format!(
                    "lost the connection carrying this forward ({}:{}): {e}",
                    info.remote_host, info.remote_port
                )
            }
        }
    };

    // A dead session poisons every forward riding on it, so drop the pooled
    // handle and let the next open reconnect.
    let manager = app.state::<TunnelManager>();
    manager.drop_connection(&info.host_id).await;
    manager.tunnels.lock().await.remove(&info.id);
    let _ = app.emit(
        "tunnel://closed",
        TunnelClosed {
            tunnel_id: info.id,
            error: Some(fatal),
        },
    );
}

#[tauri::command]
pub async fn tunnel_open(
    app: AppHandle,
    store: State<'_, Store>,
    tunnels: State<'_, TunnelManager>,
    host_id: String,
    remote_host: Option<String>,
    remote_port: u16,
) -> Result<TunnelInfo, String> {
    if remote_port == 0 {
        return Err("port must be between 1 and 65535".to_string());
    }
    let remote_host = remote_host
        .map(|h| h.trim().to_string())
        .filter(|h| !h.is_empty())
        .unwrap_or_else(|| "127.0.0.1".to_string());

    // Reuse a forward already pointing at this target rather than stacking a
    // second listener on it — opening :3000 twice should land on one port.
    let existing = tunnels
        .tunnels
        .lock()
        .await
        .values()
        .find(|t| {
            t.info.host_id == host_id
                && t.info.remote_host == remote_host
                && t.info.remote_port == remote_port
        })
        .map(|t| t.info.clone());
    if let Some(info) = existing {
        return Ok(info);
    }

    let conn = tunnels.connection(&store, &host_id).await?;

    // Port 0 lets the OS pick a free one; making the user find one is busywork.
    let listener = TcpListener::bind(("127.0.0.1", 0))
        .await
        .map_err(|e| format!("could not open a local port: {e}"))?;
    let local_port = listener
        .local_addr()
        .map_err(|e| format!("could not read the local port: {e}"))?
        .port();

    let info = TunnelInfo {
        id: Uuid::new_v4().to_string(),
        host_id,
        remote_host,
        remote_port,
        local_port,
    };

    // Registered before the accept loop starts: were it the other way round, a
    // forward that failed immediately would try to remove itself from the map
    // before it was ever in it, and the entry would outlive the loop.
    let (shutdown, stop) = watch::channel(false);
    tunnels.tunnels.lock().await.insert(
        info.id.clone(),
        Tunnel {
            info: info.clone(),
            _shutdown: shutdown,
        },
    );
    tauri::async_runtime::spawn(serve(app, conn, listener, info.clone(), stop));

    Ok(info)
}

#[tauri::command]
pub async fn tunnel_close(
    tunnels: State<'_, TunnelManager>,
    tunnel_id: String,
) -> Result<(), String> {
    tunnels.tunnels.lock().await.remove(&tunnel_id);
    Ok(())
}

#[tauri::command]
pub async fn tunnel_list(tunnels: State<'_, TunnelManager>) -> Result<Vec<TunnelInfo>, String> {
    Ok(tunnels
        .tunnels
        .lock()
        .await
        .values()
        .map(|t| t.info.clone())
        .collect())
}

/// Drop the pooled SSH connection for a host. Its forwards die with it, which
/// is why every tunnel on that host is dropped here rather than left dangling.
#[tauri::command]
pub async fn tunnel_disconnect(
    tunnels: State<'_, TunnelManager>,
    host_id: String,
) -> Result<(), String> {
    tunnels
        .tunnels
        .lock()
        .await
        .retain(|_, t| t.info.host_id != host_id);
    tunnels.drop_connection(&host_id).await;
    Ok(())
}

/// What one HTTP request through a forward came back with. This is the
/// `curl -I` that browsing a port used to require, except it also answers the
/// question curl can't: whether the page will render inside the app at all.
#[derive(Clone, Debug, Default, PartialEq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProbeResult {
    pub status: Option<u16>,
    pub status_text: Option<String>,
    pub server: Option<String>,
    pub content_type: Option<String>,
    /// Set when a response header forbids embedding, naming the header that
    /// did it. The pane uses this to offer the system browser instead of
    /// rendering a frame the page will refuse to fill.
    pub blocked_by: Option<String>,
    pub elapsed_ms: u64,
}

/// How long to wait for response headers. A dev server that has not answered
/// in this long is hung, and saying so beats a spinner that never resolves.
const PROBE_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(8);

/// Headers only — a response body can be a 40MB bundle and none of it is read.
const PROBE_LIMIT: usize = 32 * 1024;

#[tauri::command]
pub async fn tunnel_probe(
    store: State<'_, Store>,
    tunnels: State<'_, TunnelManager>,
    tunnel_id: String,
    path: Option<String>,
) -> Result<ProbeResult, String> {
    let info = tunnels
        .tunnels
        .lock()
        .await
        .get(&tunnel_id)
        .map(|t| t.info.clone())
        .ok_or_else(|| "that forward is no longer open".to_string())?;

    let conn = tunnels.connection(&store, &info.host_id).await?;
    let started = std::time::Instant::now();

    // The request mirrors what the embedded frame will send, `Host` included,
    // so a server that varies on it answers the probe the same way it will
    // answer the page.
    let path = path.filter(|p| p.starts_with('/')).unwrap_or_else(|| "/".into());
    let request = format!(
        "GET {path} HTTP/1.1\r\nHost: 127.0.0.1:{}\r\nUser-Agent: TerCTL\r\nAccept: */*\r\nConnection: close\r\n\r\n",
        info.local_port
    );

    let exchange = async {
        let channel = conn
            .channel_open_direct_tcpip(
                info.remote_host.clone(),
                info.remote_port as u32,
                "127.0.0.1",
                info.local_port as u32,
            )
            .await
            .map_err(|e| match e {
                russh::Error::ChannelOpenFailure(_) => format!(
                    "nothing is listening on {}:{} — the service may not be up yet",
                    info.remote_host, info.remote_port
                ),
                other => other.to_string(),
            })?;

        let mut stream = channel.into_stream();
        stream
            .write_all(request.as_bytes())
            .await
            .map_err(|e| format!("could not send the request: {e}"))?;

        let mut buf = Vec::new();
        let mut chunk = [0u8; 4096];
        loop {
            let n = stream
                .read(&mut chunk)
                .await
                .map_err(|e| format!("could not read the response: {e}"))?;
            if n == 0 {
                break;
            }
            buf.extend_from_slice(&chunk[..n]);
            // Stop at the blank line ending the headers; the body is not wanted.
            if buf.windows(4).any(|w| w == b"\r\n\r\n") || buf.len() >= PROBE_LIMIT {
                break;
            }
        }
        Ok::<_, String>(buf)
    };

    let raw = match tokio::time::timeout(PROBE_TIMEOUT, exchange).await {
        Ok(result) => result?,
        Err(_) => {
            return Err(format!(
                "{}:{} accepted the connection but sent nothing back within {}s",
                info.remote_host,
                info.remote_port,
                PROBE_TIMEOUT.as_secs()
            ))
        }
    };

    let mut probe = parse_probe(&String::from_utf8_lossy(&raw))?;
    probe.elapsed_ms = started.elapsed().as_millis() as u64;
    Ok(probe)
}

fn parse_probe(raw: &str) -> Result<ProbeResult, String> {
    let head = raw.split("\r\n\r\n").next().unwrap_or(raw);
    let mut lines = head.lines();
    let status_line = lines.next().unwrap_or("").trim();

    // A TLS server answers a plaintext GET with a binary alert, not a status
    // line — worth saying plainly, since the fix is to use https, not to debug.
    if !status_line.starts_with("HTTP/") {
        return Err(
            "the port answered, but not with HTTP — it may be serving HTTPS or another protocol"
                .to_string(),
        );
    }

    let mut parts = status_line.splitn(3, ' ');
    let _version = parts.next();
    let status = parts.next().and_then(|c| c.parse::<u16>().ok());
    let status_text = parts
        .next()
        .map(str::trim)
        .filter(|t| !t.is_empty())
        .map(str::to_string);

    let header = |name: &str| {
        lines.clone().find_map(|line| {
            let (key, value) = line.split_once(':')?;
            key.trim()
                .eq_ignore_ascii_case(name)
                .then(|| value.trim().to_string())
        })
    };

    Ok(ProbeResult {
        status,
        status_text,
        server: header("server"),
        content_type: header("content-type"),
        blocked_by: framing_block(header("x-frame-options"), header("content-security-policy")),
        elapsed_ms: 0,
    })
}

/// Decide whether the response would refuse to render inside the app's frame.
///
/// The app's own origin is never in a server's allow-list, so `SAMEORIGIN` and
/// any explicit `frame-ancestors` host list both block us in practice. Only a
/// wildcard genuinely lets us in.
fn framing_block(xfo: Option<String>, csp: Option<String>) -> Option<String> {
    if let Some(xfo) = xfo {
        let value = xfo.trim().to_ascii_lowercase();
        if value.starts_with("deny") {
            return Some("X-Frame-Options: DENY".to_string());
        }
        if value.starts_with("sameorigin") || value.starts_with("allow-from") {
            return Some(format!("X-Frame-Options: {}", xfo.trim()));
        }
    }

    let csp = csp?;
    let directive = csp
        .split(';')
        .map(str::trim)
        .find(|d| d.to_ascii_lowercase().starts_with("frame-ancestors"))?;
    let sources: Vec<&str> = directive.split_whitespace().skip(1).collect();
    if sources.contains(&"*") {
        return None;
    }
    Some(format!("Content-Security-Policy: {directive}"))
}

/// Ask the remote what it is listening on. `ss` is preferred (present on any
/// modern Linux); `netstat` covers older boxes. `-p` only names the process
/// for sockets the login user owns, so a name is never guaranteed.
///
/// The first line is a marker naming the tool, so the parser knows which
/// column layout it is reading instead of guessing.
const LISTENERS_SCRIPT: &str = r#"LC_ALL=C; export LC_ALL
if command -v ss >/dev/null 2>&1; then
  printf 'ss\n'; ss -H -ltnp 2>/dev/null
elif command -v netstat >/dev/null 2>&1; then
  printf 'netstat\n'; netstat -ltnp 2>/dev/null
else
  printf 'none\n'
fi
"#;

#[tauri::command]
pub async fn tunnel_listening_ports(
    store: State<'_, Store>,
    tunnels: State<'_, TunnelManager>,
    host_id: String,
) -> Result<Vec<ListeningPort>, String> {
    let run = || async {
        let conn = tunnels.connection(&store, &host_id).await?;
        let mut channel = conn
            .channel_open_session()
            .await
            .map_err(|e| e.to_string())?;
        channel
            .exec(true, LISTENERS_SCRIPT)
            .await
            .map_err(|e| e.to_string())?;
        let mut out = Vec::new();
        while let Some(msg) = channel.wait().await {
            match msg {
                ChannelMsg::Data { data } => out.extend_from_slice(&data),
                ChannelMsg::Eof | ChannelMsg::Close => break,
                _ => {}
            }
        }
        Ok::<_, String>(String::from_utf8_lossy(&out).into_owned())
    };

    match run().await {
        Ok(raw) => parse_listeners(&raw),
        Err(e) => {
            // Drop a stale connection so the next scan reconnects.
            tunnels.drop_connection(&host_id).await;
            Err(e)
        }
    }
}

fn parse_listeners(raw: &str) -> Result<Vec<ListeningPort>, String> {
    let mut lines = raw.trim_start().lines();
    let tool = lines.next().map(str::trim).unwrap_or("");
    let parse: fn(&str) -> Option<ListeningPort> = match tool {
        "ss" => parse_ss_line,
        "netstat" => parse_netstat_line,
        "none" => {
            return Err("neither ss nor netstat is installed on this host, so its open \
                 ports can't be listed — enter the port by hand"
                .to_string())
        }
        other => return Err(format!("unexpected output while listing ports: {other}")),
    };
    Ok(merge_by_port(lines.filter_map(parse).collect()))
}

/// `LISTEN 0 4096 127.0.0.1:3000 0.0.0.0:* users:(("node",pid=999,fd=20))`
///
/// Both tools put the local address in field 3, so the two parsers differ only
/// in how they name the owning process.
fn parse_ss_line(line: &str) -> Option<ListeningPort> {
    let fields: Vec<&str> = line.split_whitespace().collect();
    // A header slips through when the ss build predates `-H`.
    if matches!(fields.first(), Some(&"State") | Some(&"Netid")) {
        return None;
    }
    let (address, port) = split_addr_port(fields.get(3)?)?;
    let users = fields.get(5..).map(|rest| rest.join(" ")).unwrap_or_default();
    let (process, pid) = parse_ss_users(&users);
    Some(ListeningPort {
        port,
        loopback: is_loopback(&address),
        address,
        process,
        pid,
    })
}

/// `tcp  0  0  127.0.0.1:3000  0.0.0.0:*  LISTEN  999/node`
fn parse_netstat_line(line: &str) -> Option<ListeningPort> {
    let fields: Vec<&str> = line.split_whitespace().collect();
    // Drops the banner and the column header along with any non-listening row.
    if !fields.contains(&"LISTEN") {
        return None;
    }
    let (address, port) = split_addr_port(fields.get(3)?)?;
    let (process, pid) = fields
        .get(6)
        .map(|f| parse_netstat_program(f))
        .unwrap_or((None, None));
    Some(ListeningPort {
        port,
        loopback: is_loopback(&address),
        address,
        process,
        pid,
    })
}

/// `users:(("nginx",pid=1234,fd=6),("nginx",pid=1235,fd=6))` → first entry.
/// Workers of one service repeat the same name, so the first is enough.
fn parse_ss_users(field: &str) -> (Option<String>, Option<u32>) {
    let Some((_, rest)) = field.split_once("((") else {
        return (None, None);
    };
    let process = rest
        .strip_prefix('"')
        .and_then(|r| r.split_once('"'))
        .map(|(name, _)| name.to_string())
        .filter(|n| !n.is_empty());
    let pid = rest
        .split_once("pid=")
        .and_then(|(_, r)| r.split(|c: char| !c.is_ascii_digit()).next())
        .and_then(|digits| digits.parse().ok());
    (process, pid)
}

/// `999/node` → ("node", 999). A bare `-` means netstat could not see the owner.
fn parse_netstat_program(field: &str) -> (Option<String>, Option<u32>) {
    let Some((pid, name)) = field.split_once('/') else {
        return (None, None);
    };
    (
        Some(name.to_string()).filter(|n| !n.is_empty()),
        pid.parse().ok(),
    )
}

/// Splits the many shapes a bind address takes: `127.0.0.1:3000`, `[::]:22`,
/// `:::22` (netstat's IPv6 spelling), `*:8080`, `[::ffff:127.0.0.1]:8080`.
/// Splitting from the right is what makes the bare-colon IPv6 forms work.
fn split_addr_port(field: &str) -> Option<(String, u16)> {
    let (addr, port) = field.rsplit_once(':')?;
    let port: u16 = port.parse().ok()?;
    let addr = addr.trim_start_matches('[').trim_end_matches(']');
    Some((addr.to_string(), port))
}

fn is_loopback(addr: &str) -> bool {
    let addr = addr.trim_start_matches("::ffff:");
    addr == "::1" || addr.starts_with("127.")
}

/// A service bound to both `0.0.0.0:80` and `[::]:80` is one service. Collapse
/// per port, keeping the first process name seen; the port counts as loopback
/// only when every socket on it was loopback, since a single public binding is
/// enough to make it reachable without a forward.
fn merge_by_port(found: Vec<ListeningPort>) -> Vec<ListeningPort> {
    let mut merged: Vec<ListeningPort> = Vec::new();
    for entry in found {
        match merged.iter_mut().find(|m| m.port == entry.port) {
            Some(existing) => {
                if existing.process.is_none() {
                    existing.process = entry.process;
                    existing.pid = entry.pid;
                }
                // A public binding wins the display address: it is the one that
                // explains why the port is (or isn't) reachable directly.
                if existing.loopback && !entry.loopback {
                    existing.address = entry.address;
                }
                existing.loopback = existing.loopback && entry.loopback;
            }
            None => merged.push(entry),
        }
    }
    merged.sort_by_key(|p| p.port);
    merged
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ports(raw: &str) -> Vec<ListeningPort> {
        parse_listeners(raw).expect("should parse")
    }

    #[test]
    fn parses_ss_output() {
        let raw = "ss\n\
LISTEN 0      4096       127.0.0.1:3000       0.0.0.0:*    users:((\"node\",pid=999,fd=20))\n\
LISTEN 0      511          0.0.0.0:80         0.0.0.0:*    users:((\"nginx\",pid=12,fd=6),((\"nginx\",pid=13,fd=6))\n\
LISTEN 0      128             [::]:22            [::]:*\n";
        let found = ports(raw);
        assert_eq!(found.len(), 3);

        assert_eq!(found[0].port, 22);
        assert_eq!(found[0].address, "::");
        assert!(!found[0].loopback);
        assert_eq!(found[0].process, None);

        assert_eq!(found[1].port, 80);
        assert_eq!(found[1].process.as_deref(), Some("nginx"));
        assert_eq!(found[1].pid, Some(12));
        assert!(!found[1].loopback);

        assert_eq!(found[2].port, 3000);
        assert_eq!(found[2].process.as_deref(), Some("node"));
        assert_eq!(found[2].pid, Some(999));
        // The whole point of the feature: bound to loopback, so unreachable
        // from here without a forward.
        assert!(found[2].loopback);
    }

    #[test]
    fn parses_netstat_output() {
        let raw = "netstat\n\
Active Internet connections (only servers)\n\
Proto Recv-Q Send-Q Local Address           Foreign Address         State       PID/Program name\n\
tcp        0      0 127.0.0.1:3000          0.0.0.0:*               LISTEN      999/node\n\
tcp6       0      0 :::22                   :::*                    LISTEN      800/sshd\n\
tcp        0      0 0.0.0.0:80              0.0.0.0:*               LISTEN      -\n";
        let found = ports(raw);
        assert_eq!(found.len(), 3);

        assert_eq!(found[0].port, 22);
        assert_eq!(found[0].address, "::");
        assert_eq!(found[0].process.as_deref(), Some("sshd"));

        assert_eq!(found[1].port, 80);
        // `-` has no slash, so there is no owner to report.
        assert_eq!(found[1].process, None);

        assert_eq!(found[2].port, 3000);
        assert_eq!(found[2].process.as_deref(), Some("node"));
        assert!(found[2].loopback);
    }

    /// A header survives on ss builds without `-H`; it must not become a port.
    #[test]
    fn skips_an_ss_header_row() {
        let raw = "ss\n\
State  Recv-Q Send-Q Local Address:Port  Peer Address:Port Process\n\
LISTEN 0      4096       127.0.0.1:8080       0.0.0.0:*\n";
        let found = ports(raw);
        assert_eq!(found.len(), 1);
        assert_eq!(found[0].port, 8080);
    }

    /// Dual-stack services list the same port twice. One row, and a port with
    /// any public binding must not be reported as loopback-only.
    #[test]
    fn collapses_dual_stack_bindings() {
        let raw = "ss\n\
LISTEN 0 511 0.0.0.0:80 0.0.0.0:*\n\
LISTEN 0 511    [::]:80    [::]:* users:((\"nginx\",pid=7,fd=6))\n\
LISTEN 0 128 127.0.0.1:5432 0.0.0.0:* users:((\"postgres\",pid=8,fd=5))\n\
LISTEN 0 128     [::1]:5432    [::]:*\n";
        let found = ports(raw);
        assert_eq!(found.len(), 2);

        assert_eq!(found[0].port, 80);
        assert!(!found[0].loopback);
        // The name came from the second row; merging must not lose it.
        assert_eq!(found[0].process.as_deref(), Some("nginx"));

        assert_eq!(found[1].port, 5432);
        assert!(found[1].loopback, "both bindings were loopback");
    }

    #[test]
    fn reports_a_host_with_neither_tool() {
        let err = parse_listeners("none\n").unwrap_err();
        assert!(err.contains("by hand"), "unexpected error: {err}");
    }

    #[test]
    fn splits_every_address_shape() {
        assert_eq!(
            split_addr_port("127.0.0.1:3000"),
            Some(("127.0.0.1".into(), 3000))
        );
        assert_eq!(split_addr_port("[::]:22"), Some(("::".into(), 22)));
        assert_eq!(split_addr_port(":::22"), Some(("::".into(), 22)));
        assert_eq!(split_addr_port("*:8080"), Some(("*".into(), 8080)));
        assert_eq!(
            split_addr_port("[::ffff:127.0.0.1]:8080"),
            Some(("::ffff:127.0.0.1".into(), 8080))
        );
        // Peer columns and junk must not be read as a listener.
        assert_eq!(split_addr_port("0.0.0.0:*"), None);
        assert_eq!(split_addr_port("LISTEN"), None);
    }

    #[test]
    fn reads_a_response_head() {
        let raw = "HTTP/1.1 200 OK\r\n\
Server: nginx/1.24.0\r\n\
Content-Type: text/html; charset=utf-8\r\n\
Content-Length: 4096\r\n\
\r\n\
<!doctype html><html>";
        let probe = parse_probe(raw).expect("should parse");
        assert_eq!(probe.status, Some(200));
        assert_eq!(probe.status_text.as_deref(), Some("OK"));
        assert_eq!(probe.server.as_deref(), Some("nginx/1.24.0"));
        assert_eq!(
            probe.content_type.as_deref(),
            Some("text/html; charset=utf-8")
        );
        assert_eq!(probe.blocked_by, None);
    }

    /// A 500 is still a successful probe — the port is serving, which is the
    /// question being asked. Only a non-HTTP answer is an error.
    #[test]
    fn reads_an_error_status() {
        let probe = parse_probe("HTTP/1.1 502 Bad Gateway\r\n\r\n").expect("should parse");
        assert_eq!(probe.status, Some(502));
        assert_eq!(probe.status_text.as_deref(), Some("Bad Gateway"));
    }

    #[test]
    fn rejects_a_non_http_response() {
        // What a TLS server sends back to a plaintext GET.
        let err = parse_probe("\u{15}\u{3}\u{1}\u{0}\u{2}\u{2}").unwrap_err();
        assert!(err.contains("not with HTTP"), "unexpected error: {err}");
    }

    #[test]
    fn detects_headers_that_forbid_embedding() {
        let deny = parse_probe("HTTP/1.1 200 OK\r\nX-Frame-Options: DENY\r\n\r\n").unwrap();
        assert_eq!(deny.blocked_by.as_deref(), Some("X-Frame-Options: DENY"));

        // Same-origin blocks us too: the app's origin is not the server's.
        let same = parse_probe("HTTP/1.1 200 OK\r\nx-frame-options: SAMEORIGIN\r\n\r\n").unwrap();
        assert_eq!(
            same.blocked_by.as_deref(),
            Some("X-Frame-Options: SAMEORIGIN")
        );

        let csp = parse_probe(
            "HTTP/1.1 200 OK\r\nContent-Security-Policy: default-src 'self'; frame-ancestors 'none'\r\n\r\n",
        )
        .unwrap();
        assert_eq!(
            csp.blocked_by.as_deref(),
            Some("Content-Security-Policy: frame-ancestors 'none'")
        );
    }

    #[test]
    fn allows_embedding_when_nothing_forbids_it() {
        assert_eq!(framing_block(None, None), None);
        // A CSP without a frame-ancestors directive says nothing about framing.
        assert_eq!(
            framing_block(None, Some("default-src 'self'; img-src *".into())),
            None
        );
        // An explicit wildcard is the one allow-list that includes us.
        assert_eq!(framing_block(None, Some("frame-ancestors *".into())), None);
        // Anything narrower does not.
        assert!(framing_block(None, Some("frame-ancestors https://app.example".into())).is_some());
    }

    #[test]
    fn recognizes_loopback_addresses() {
        assert!(is_loopback("127.0.0.1"));
        assert!(is_loopback("127.0.1.1"));
        assert!(is_loopback("::1"));
        assert!(is_loopback("::ffff:127.0.0.1"));
        assert!(!is_loopback("0.0.0.0"));
        assert!(!is_loopback("::"));
        assert!(!is_loopback("*"));
        assert!(!is_loopback("10.0.0.5"));
    }
}
