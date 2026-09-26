//! Making a forwarded page renderable inside the browser pane.
//!
//! Plenty of real services — MinIO, Grafana, Jenkins, anything behind a
//! hardened nginx — answer with `X-Frame-Options: DENY` or a CSP
//! `frame-ancestors` list. Those headers exist to stop a *hostile* site from
//! framing them, and the app's own origin will never be on anyone's allow
//! list, so the pane would show nothing but a refusal.
//!
//! The forward already belongs to the person browsing it: it is their server,
//! reached over their SSH session, bound to their loopback and nobody else's.
//! So on the one request that loads the framed page, the relay asks for
//! `Connection: close` and strips the framing headers off the reply.
//!
//! Everything else is copied byte for byte. That matters — this forward also
//! carries WebSockets, TLS and databases, none of which are HTTP. The relay
//! inspects only until it can tell (a request line it recognises, or not),
//! then gets out of the way for the life of the connection.

use russh::client::Msg;
use russh::Channel;
use std::io;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tokio::io::{AsyncRead, AsyncReadExt, AsyncWrite, AsyncWriteExt};
use tokio::net::TcpStream;
use tokio::sync::watch;

/// Give up inspecting past this much of a single head. Real ones run to a few
/// kilobytes; past this the bytes are not a head we understand.
const MAX_HEAD: usize = 64 * 1024;

const READ_SIZE: usize = 16 * 1024;

/// Request methods a browser sends. The trailing space is part of the match:
/// it is what separates a method from a body that merely starts with letters.
const METHODS: [&str; 9] = [
    "GET ", "POST ", "HEAD ", "PUT ", "DELETE ", "PATCH ", "OPTIONS ", "CONNECT ", "TRACE ",
];

/// Whether a buffer has reached a head we can act on.
#[derive(Debug, PartialEq)]
enum Head {
    /// Not this protocol — copy the connection through untouched from here on.
    Foreign,
    /// Could still become one; read more.
    Partial,
    /// Ends at this byte offset, terminator included.
    Ends(usize),
}

/// Relay one browser connection to the forwarded port.
pub async fn relay(tcp: TcpStream, channel: Channel<Msg>, mut stop: watch::Receiver<bool>) {
    let (mut from_browser, mut to_browser) = tcp.into_split();
    let (mut from_server, mut to_server) = tokio::io::split(channel.into_stream());

    // Raised by the request side the moment it forwards the page load, and
    // lowered by the response side when it takes the reply apart.
    let unframe = Arc::new(AtomicBool::new(false));
    let raised = unframe.clone();

    let upstream = async move {
        let _ = forward_requests(&mut from_browser, &mut to_server, &raised).await;
        // Pass the browser's half-close on, or a server waiting on the body
        // of a request that will never finish just hangs.
        let _ = to_server.shutdown().await;
    };
    let downstream = async move {
        let _ = forward_responses(&mut from_server, &mut to_browser, &unframe).await;
        let _ = to_browser.shutdown().await;
    };

    tokio::select! {
        _ = async { tokio::join!(upstream, downstream) } => {}
        _ = stop.changed() => {}
    }
}

/// Copy the browser's requests to the server, watching for the one that loads
/// the framed page.
async fn forward_requests<R, W>(
    reader: &mut R,
    writer: &mut W,
    unframe: &AtomicBool,
) -> io::Result<()>
where
    R: AsyncRead + Unpin,
    W: AsyncWrite + Unpin,
{
    let mut pending = Vec::new();
    let mut inspecting = true;
    let mut chunk = vec![0u8; READ_SIZE];

    loop {
        let n = reader.read(&mut chunk).await?;
        if n == 0 {
            if !pending.is_empty() {
                writer.write_all(&pending).await?;
            }
            return Ok(());
        }

        if !inspecting {
            writer.write_all(&chunk[..n]).await?;
            continue;
        }

        pending.extend_from_slice(&chunk[..n]);

        // A single read can carry more than one request, so keep taking heads
        // off the front for as long as it is safe to.
        while inspecting {
            match scan_request(&pending) {
                Head::Partial if pending.len() <= MAX_HEAD => break,
                Head::Partial | Head::Foreign => inspecting = false,
                Head::Ends(end) => {
                    let rest = pending.split_off(end);
                    let head = String::from_utf8_lossy(&pending).into_owned();

                    if is_frame_navigation(&head) {
                        // Raised before the request goes out, so it is already
                        // up by the time the reply can arrive.
                        unframe.store(true, Ordering::SeqCst);
                        writer.write_all(force_connection_close(&head).as_bytes()).await?;
                    } else {
                        writer.write_all(head.as_bytes()).await?;
                    }

                    pending = rest;
                    // Only a bodiless, unupgraded request leaves the stream at
                    // a place where the next head is sure to start. Anything
                    // else — a POST body, a WebSocket handshake — could be
                    // mistaken for one, so stop looking.
                    inspecting = !has_body(&head) && !is_upgrade(&head);
                }
            }
        }

        if !inspecting && !pending.is_empty() {
            writer.write_all(&pending).await?;
            pending.clear();
        }
    }
}

/// Copy the server's replies back, unframing the one the request side flagged.
async fn forward_responses<R, W>(
    reader: &mut R,
    writer: &mut W,
    unframe: &AtomicBool,
) -> io::Result<()>
where
    R: AsyncRead + Unpin,
    W: AsyncWrite + Unpin,
{
    let mut pending = Vec::new();
    let mut capturing = false;
    let mut chunk = vec![0u8; READ_SIZE];

    loop {
        let n = reader.read(&mut chunk).await?;
        if n == 0 {
            if !pending.is_empty() {
                writer.write_all(&pending).await?;
            }
            return Ok(());
        }

        // Browsers do not pipeline, so a connection is idle between the reply
        // it just finished and the request it sends next. Arriving here with
        // the flag up therefore means these bytes start the flagged reply.
        if !capturing && unframe.swap(false, Ordering::SeqCst) {
            capturing = true;
            pending.clear();
        }

        if !capturing {
            writer.write_all(&chunk[..n]).await?;
            continue;
        }

        pending.extend_from_slice(&chunk[..n]);
        match scan_response(&pending) {
            Head::Partial if pending.len() <= MAX_HEAD => {}
            Head::Partial | Head::Foreign => {
                capturing = false;
                writer.write_all(&pending).await?;
                pending.clear();
            }
            Head::Ends(end) => {
                let rest = pending.split_off(end);
                let head = String::from_utf8_lossy(&pending).into_owned();
                writer.write_all(allow_framing(&head).as_bytes()).await?;
                writer.write_all(&rest).await?;
                // We asked for `Connection: close`, so this reply is the last
                // thing on the connection; the body streams through raw.
                capturing = false;
                pending.clear();
            }
        }
    }
}

// ---- head parsing (pure) ----

/// Offset just past the blank line ending a head. Tolerates bare LF, which a
/// hand-rolled dev server occasionally emits.
fn head_end(buf: &[u8]) -> Option<usize> {
    let crlf = buf.windows(4).position(|w| w == b"\r\n\r\n").map(|i| i + 4);
    let lf = buf.windows(2).position(|w| w == b"\n\n").map(|i| i + 2);
    match (crlf, lf) {
        (Some(a), Some(b)) => Some(a.min(b)),
        (found, none) => found.or(none),
    }
}

/// Does this buffer start with one of `prefixes`, or could it still?
fn starts_with_any(buf: &[u8], prefixes: &[&str]) -> Head {
    let mut truncated = false;
    for prefix in prefixes {
        let bytes = prefix.as_bytes();
        if buf.len() >= bytes.len() {
            if buf.starts_with(bytes) {
                return Head::Ends(0); // matched; the caller looks for the end
            }
        } else if bytes.starts_with(buf) {
            truncated = true;
        }
    }
    if truncated {
        Head::Partial
    } else {
        Head::Foreign
    }
}

fn scan_request(buf: &[u8]) -> Head {
    match starts_with_any(buf, &METHODS) {
        Head::Ends(_) => head_end(buf).map_or(Head::Partial, Head::Ends),
        verdict => verdict,
    }
}

fn scan_response(buf: &[u8]) -> Head {
    match starts_with_any(buf, &["HTTP/1."]) {
        Head::Ends(_) => head_end(buf).map_or(Head::Partial, Head::Ends),
        verdict => verdict,
    }
}

/// The header lines of a head, without the start line or the blank terminator.
fn header_lines(head: &str) -> impl Iterator<Item = &str> {
    head.lines().skip(1).filter(|line| !line.trim().is_empty())
}

fn is_header(line: &str, name: &str) -> bool {
    line.split_once(':')
        .is_some_and(|(key, _)| key.trim().eq_ignore_ascii_case(name))
}

fn header_value<'a>(head: &'a str, name: &str) -> Option<&'a str> {
    header_lines(head)
        .find(|line| is_header(line, name))
        .and_then(|line| line.split_once(':'))
        .map(|(_, value)| value.trim())
}

/// Heads are uniform in practice, so the first terminator seen sets the style
/// a rewrite is rebuilt in.
fn line_ending(head: &str) -> &'static str {
    if head.contains("\r\n") {
        "\r\n"
    } else {
        "\n"
    }
}

fn rebuild(start_line: &str, headers: Vec<String>, eol: &str) -> String {
    let mut out = String::with_capacity(start_line.len() + headers.len() * 40 + 8);
    out.push_str(start_line);
    out.push_str(eol);
    for header in headers {
        out.push_str(&header);
        out.push_str(eol);
    }
    out.push_str(eol);
    out
}

/// Is this the request that loads the page the pane frames?
///
/// `Sec-Fetch-Dest` answers it outright on any current engine. Where it is
/// missing, a GET that asks for HTML is a page load and a script, stylesheet
/// or fetch is not — which has been true since long before the header existed.
fn is_frame_navigation(head: &str) -> bool {
    if let Some(dest) = header_value(head, "sec-fetch-dest") {
        return matches!(
            dest.to_ascii_lowercase().as_str(),
            "iframe" | "frame" | "document"
        );
    }
    head.starts_with("GET ")
        && header_value(head, "accept")
            .is_some_and(|accept| accept.to_ascii_lowercase().contains("text/html"))
}

fn has_body(head: &str) -> bool {
    if header_value(head, "transfer-encoding").is_some() {
        return true;
    }
    header_value(head, "content-length")
        .and_then(|len| len.parse::<u64>().ok())
        .is_some_and(|len| len > 0)
}

fn is_upgrade(head: &str) -> bool {
    header_value(head, "upgrade").is_some()
}

/// Ask for exactly one reply on this connection, so the response side knows
/// which head it is looking at without having to track message framing.
fn force_connection_close(head: &str) -> String {
    let eol = line_ending(head);
    let mut headers: Vec<String> = header_lines(head)
        .filter(|line| !is_header(line, "connection") && !is_header(line, "keep-alive"))
        .map(str::to_string)
        .collect();
    headers.push("Connection: close".to_string());
    rebuild(head.lines().next().unwrap_or(""), headers, eol)
}

/// Drop the headers that would stop the reply rendering in the pane, and
/// nothing else — a CSP keeps every directive but `frame-ancestors`.
fn allow_framing(head: &str) -> String {
    let eol = line_ending(head);
    let headers = header_lines(head)
        .filter_map(|line| {
            if is_header(line, "x-frame-options") {
                return None;
            }
            if !is_header(line, "content-security-policy")
                && !is_header(line, "content-security-policy-report-only")
            {
                return Some(line.to_string());
            }
            let (name, value) = line.split_once(':')?;
            let kept: Vec<&str> = value
                .split(';')
                .map(str::trim)
                .filter(|directive| !directive.is_empty() && !is_frame_ancestors(directive))
                .collect();
            // A policy that said nothing else goes away with the directive.
            (!kept.is_empty()).then(|| format!("{}: {}", name.trim(), kept.join("; ")))
        })
        .collect();
    rebuild(head.lines().next().unwrap_or(""), headers, eol)
}

fn is_frame_ancestors(directive: &str) -> bool {
    let lower = directive.to_ascii_lowercase();
    lower == "frame-ancestors" || lower.starts_with("frame-ancestors ")
}

#[cfg(test)]
mod tests {
    use super::*;

    const NAV: &str = "GET /console HTTP/1.1\r\n\
Host: 127.0.0.1:52341\r\n\
Connection: keep-alive\r\n\
Sec-Fetch-Dest: iframe\r\n\
Accept: text/html,application/xhtml+xml\r\n\r\n";

    #[test]
    fn finds_the_end_of_a_head() {
        assert_eq!(head_end(b"GET / HTTP/1.1\r\n\r\nbody"), Some(18));
        assert_eq!(head_end(b"GET / HTTP/1.1\n\nbody"), Some(16));
        assert_eq!(head_end(b"GET / HTTP/1.1\r\nHost: x\r\n"), None);
    }

    /// The relay carries TLS, WebSocket frames and database wire protocols as
    /// well as HTTP. Mistaking any of those for a head would corrupt them, so
    /// anything unrecognised has to be spotted from the very first bytes.
    #[test]
    fn leaves_other_protocols_alone() {
        assert_eq!(scan_request(&[0x16, 0x03, 0x01, 0x00]), Head::Foreign);
        assert_eq!(scan_request(b"\x00\x00\x00\x08postgres"), Head::Foreign);
        assert_eq!(scan_response(b"\x16\x03\x03\x00\x7a"), Head::Foreign);
        // A method-shaped prefix is not yet a decision either way.
        assert_eq!(scan_request(b"GE"), Head::Partial);
        assert_eq!(scan_request(b"GET /"), Head::Partial);
        // …but a word that only looks like one is.
        assert_eq!(scan_request(b"GETTY sub"), Head::Foreign);
    }

    #[test]
    fn recognizes_the_page_load() {
        assert!(is_frame_navigation(NAV));
        assert!(is_frame_navigation(
            "GET /x HTTP/1.1\r\nSec-Fetch-Dest: document\r\n\r\n"
        ));
        // A subresource on the same page is not the page.
        assert!(!is_frame_navigation(
            "GET /app.js HTTP/1.1\r\nSec-Fetch-Dest: script\r\nAccept: */*\r\n\r\n"
        ));
        // Without Sec-Fetch-*, asking for HTML is the signal.
        assert!(is_frame_navigation(
            "GET / HTTP/1.1\r\nAccept: text/html,*/*;q=0.8\r\n\r\n"
        ));
        assert!(!is_frame_navigation(
            "GET /api HTTP/1.1\r\nAccept: application/json\r\n\r\n"
        ));
        assert!(!is_frame_navigation("POST / HTTP/1.1\r\nAccept: text/html\r\n\r\n"));
    }

    #[test]
    fn asks_for_a_single_reply() {
        let out = force_connection_close(NAV);
        assert!(out.starts_with("GET /console HTTP/1.1\r\n"));
        assert!(out.contains("Connection: close\r\n"));
        assert!(!out.contains("keep-alive"), "the old value must be gone: {out}");
        // Untouched headers survive, and the head still ends in a blank line.
        assert!(out.contains("Host: 127.0.0.1:52341\r\n"));
        assert!(out.ends_with("\r\n\r\n"));
    }

    #[test]
    fn strips_x_frame_options() {
        let head = "HTTP/1.1 200 OK\r\n\
Content-Type: text/html\r\n\
X-Frame-Options: DENY\r\n\
Content-Length: 42\r\n\r\n";
        let out = allow_framing(head);
        assert!(!out.to_ascii_lowercase().contains("x-frame-options"));
        // Body framing must be preserved exactly, or the stream desyncs.
        assert!(out.contains("Content-Length: 42\r\n"));
        assert!(out.contains("Content-Type: text/html\r\n"));
    }

    #[test]
    fn strips_only_frame_ancestors_from_a_policy() {
        let head = "HTTP/1.1 200 OK\r\n\
Content-Security-Policy: default-src 'self'; frame-ancestors 'none'; img-src *\r\n\r\n";
        let out = allow_framing(head);
        assert!(out.contains("default-src 'self'"));
        assert!(out.contains("img-src *"));
        assert!(!out.to_ascii_lowercase().contains("frame-ancestors"));
    }

    #[test]
    fn drops_a_policy_that_said_nothing_else() {
        let head = "HTTP/1.1 200 OK\r\nContent-Security-Policy: frame-ancestors 'self'\r\n\r\n";
        assert_eq!(allow_framing(head), "HTTP/1.1 200 OK\r\n\r\n");
    }

    /// A directive that merely begins with the same letters is a different
    /// directive and must survive.
    #[test]
    fn keeps_unrelated_directives() {
        let head = "HTTP/1.1 200 OK\r\nContent-Security-Policy: frame-src 'self'\r\n\r\n";
        assert!(allow_framing(head).contains("frame-src 'self'"));
    }

    #[test]
    fn preserves_bare_lf_heads() {
        let head = "HTTP/1.1 200 OK\nX-Frame-Options: SAMEORIGIN\nServer: tiny\n\n";
        let out = allow_framing(head);
        assert_eq!(out, "HTTP/1.1 200 OK\nServer: tiny\n\n");
    }

    #[test]
    fn spots_requests_that_carry_a_body() {
        assert!(!has_body(NAV));
        assert!(has_body("POST / HTTP/1.1\r\nContent-Length: 12\r\n\r\n"));
        assert!(has_body("POST / HTTP/1.1\r\nTransfer-Encoding: chunked\r\n\r\n"));
        // An explicit zero is still no body.
        assert!(!has_body("POST / HTTP/1.1\r\nContent-Length: 0\r\n\r\n"));
    }

    #[test]
    fn spots_a_websocket_handshake() {
        assert!(is_upgrade(
            "GET /ws HTTP/1.1\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n"
        ));
        assert!(!is_upgrade(NAV));
    }

    /// Header names are case-insensitive on the wire, and servers disagree.
    #[test]
    fn matches_headers_whatever_their_case() {
        let head = "HTTP/1.1 200 OK\r\nx-frame-options: deny\r\nCONTENT-SECURITY-POLICY: frame-ancestors 'none'; default-src 'self'\r\n\r\n";
        let out = allow_framing(head).to_ascii_lowercase();
        assert!(!out.contains("x-frame-options"));
        assert!(!out.contains("frame-ancestors"));
        assert!(out.contains("default-src 'self'"));
    }
}
