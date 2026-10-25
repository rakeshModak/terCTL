//! Import hosts from an OpenSSH client config (`~/.ssh/config`).
//!
//! The file is read and resolved entirely in this process. The frontend sends a
//! path and the aliases the user ticked, and the import re-parses the file
//! rather than accepting host rows back from the UI — the same arrangement the
//! encrypted backup importer uses, so everything written to SQLite has been
//! validated here.
//!
//! Resolution follows `ssh_config(5)`: sections are read top to bottom and, for
//! each keyword, the first value from any section whose patterns match the alias
//! wins. That is what makes a trailing `Host *` a fallback rather than an
//! override. A `Host` line made only of patterns is a set of defaults, not a
//! server, and never becomes an entry of its own.
//!
//! Nothing secret is involved: a config names key *files*, never key material,
//! so this never touches the keychain.

use crate::backup::{
    check_required, check_text, MAX_HOSTNAME_LEN, MAX_HOSTS, MAX_LABEL_LEN, MAX_PATH_LEN,
    MAX_USERNAME_LEN,
};
use crate::models::{AuthKind, Host};
use crate::store::Store;
use serde::Serialize;
use std::collections::{HashMap, HashSet};
use std::fs;
use std::net::{IpAddr, ToSocketAddrs};
use std::path::{Path, PathBuf};
use std::sync::mpsc;
use std::time::{Duration, Instant};
use tauri::State;
use uuid::Uuid;

/// A real config is a few KiB; anything past this is not one.
const MAX_FILE_BYTES: u64 = 1024 * 1024;
/// OpenSSH's own limit on nested `Include`s.
const MAX_INCLUDE_DEPTH: usize = 16;
/// Bounds the walk when checking a jump chain for loops.
const MAX_JUMP_WALK: usize = 64;
/// How long the preview waits for name lookups before giving up on them.
/// Opening the dialog shouldn't stall on a slow resolver.
const RESOLVE_DEADLINE: Duration = Duration::from_secs(2);

/// Key files tried when a host names no `IdentityFile`. `ssh` offers all of
/// them, but TerCTL holds one key per host, so this picks the newest key type
/// first: it is the likeliest to be the one authorised, and it matches the
/// host form's own default.
const DEFAULT_KEYS: [&str; 3] = ["id_ed25519", "id_ecdsa", "id_rsa"];

// ---------------------------------------------------------------------------
// Wire types
// ---------------------------------------------------------------------------

#[derive(Serialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum EntryStatus {
    /// Can be imported.
    New,
    /// Same host, port and user already saved in TerCTL.
    Exists,
    /// Same host, port and user as an earlier entry in this file.
    Duplicate,
    /// Failed validation; see `notes`.
    Invalid,
}

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SshConfigEntry {
    pub alias: String,
    pub hostname: String,
    pub port: u16,
    pub username: String,
    pub key_ref: Option<String>,
    /// The bastion as written in `ProxyJump`, if any.
    pub jump: Option<String>,
    pub status: EntryStatus,
    /// A bare name (no dots, not an IP) that didn't resolve from this
    /// machine. Still importable, but not pre-ticked: it is usually a typo or
    /// a leftover entry.
    pub unresolved: bool,
    /// Why an entry can't be imported, or what was left out of it.
    pub notes: Vec<String>,
}

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SshConfigPreview {
    pub path: String,
    pub entries: Vec<SshConfigEntry>,
}

#[derive(Serialize, Default, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SshConfigImportSummary {
    pub hosts_added: usize,
    pub jumps_linked: usize,
    /// Ticked but not imported: already present, duplicated, or invalid.
    pub skipped: Vec<String>,
    /// Imported with no key file found, so they can't authenticate yet.
    pub needs_key: Vec<String>,
    /// `alias: message` for anything imported with a setting dropped.
    pub notes: Vec<String>,
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/// One `Keyword value…` line, with the keyword lowercased.
#[derive(Debug, Clone)]
struct Directive {
    key: String,
    args: Vec<String>,
}

/// A `Host` or `Match` section.
#[derive(Debug)]
struct Section {
    patterns: Vec<String>,
    settings: Vec<(String, Vec<String>)>,
    /// `Match` conditions — `exec`, `user`, `localnetwork` and the rest — depend
    /// on the live connection and can't be evaluated faithfully here, so those
    /// sections are skipped rather than guessed at.
    skip: bool,
}

/// Splits on whitespace, keeping double-quoted runs together so a path like
/// `"~/My Keys/id_ed25519"` survives as one argument.
fn tokenize(rest: &str) -> Vec<String> {
    let mut out = Vec::new();
    let mut current = String::new();
    let mut quoted = false;
    let mut in_token = false;
    for c in rest.chars() {
        match c {
            '"' => {
                quoted = !quoted;
                in_token = true;
            }
            c if c.is_whitespace() && !quoted => {
                if in_token {
                    out.push(std::mem::take(&mut current));
                    in_token = false;
                }
            }
            c => {
                current.push(c);
                in_token = true;
            }
        }
    }
    if in_token {
        out.push(current);
    }
    out
}

/// `Keyword value`, `Keyword=value` and `Keyword = value` are all valid.
fn parse_line(line: &str) -> Option<Directive> {
    let line = line.trim();
    if line.is_empty() || line.starts_with('#') {
        return None;
    }
    let (key, rest) = match line.find(|c: char| c.is_whitespace() || c == '=') {
        Some(i) => (&line[..i], line[i..].trim_start()),
        None => (line, ""),
    };
    let rest = rest.strip_prefix('=').map(str::trim_start).unwrap_or(rest);
    Some(Directive {
        key: key.to_ascii_lowercase(),
        args: tokenize(rest),
    })
}

fn parse_text(text: &str) -> Vec<Directive> {
    text.lines().filter_map(parse_line).collect()
}

fn sections(directives: Vec<Directive>) -> Vec<Section> {
    // Anything before the first `Host` applies to every host.
    let mut out = vec![Section {
        patterns: vec!["*".to_string()],
        settings: Vec::new(),
        skip: false,
    }];
    for d in directives {
        match d.key.as_str() {
            "host" => out.push(Section {
                patterns: d.args,
                settings: Vec::new(),
                skip: false,
            }),
            // `Match all` is exactly `Host *`; every other criterion is skipped.
            "match" => {
                let all = d.args.len() == 1 && d.args[0].eq_ignore_ascii_case("all");
                out.push(Section {
                    patterns: if all { vec!["*".to_string()] } else { Vec::new() },
                    settings: Vec::new(),
                    skip: !all,
                });
            }
            _ => out
                .last_mut()
                .expect("seeded with a global section")
                .settings
                .push((d.key, d.args)),
        }
    }
    out
}

// ---------------------------------------------------------------------------
// Patterns
// ---------------------------------------------------------------------------

/// `*` and `?` wildcards, as `ssh_config(5)` uses them.
fn wildcard(pattern: &str, text: &str) -> bool {
    let p: Vec<char> = pattern.chars().collect();
    let t: Vec<char> = text.chars().collect();
    let (mut pi, mut ti) = (0, 0);
    let mut star: Option<usize> = None;
    let mut mark = 0;
    while ti < t.len() {
        if pi < p.len() && (p[pi] == '?' || p[pi] == t[ti]) {
            pi += 1;
            ti += 1;
        } else if pi < p.len() && p[pi] == '*' {
            star = Some(pi);
            mark = ti;
            pi += 1;
        } else if let Some(s) = star {
            pi = s + 1;
            mark += 1;
            ti = mark;
        } else {
            return false;
        }
    }
    while pi < p.len() && p[pi] == '*' {
        pi += 1;
    }
    pi == p.len()
}

fn is_pattern(alias: &str) -> bool {
    alias.contains(['*', '?']) || alias.starts_with('!')
}

/// Host patterns match case-insensitively, and a negated pattern that matches
/// rules the section out however many positive ones also match.
fn section_matches(patterns: &[String], alias: &str) -> bool {
    let alias = alias.to_ascii_lowercase();
    let mut matched = false;
    for pattern in patterns {
        let (negated, pattern) = match pattern.strip_prefix('!') {
            Some(rest) => (true, rest),
            None => (false, pattern.as_str()),
        };
        if wildcard(&pattern.to_ascii_lowercase(), &alias) {
            if negated {
                return false;
            }
            matched = true;
        }
    }
    matched
}

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

#[derive(Default, Debug)]
struct Resolved {
    hostname: Option<String>,
    port: Option<String>,
    user: Option<String>,
    identity_file: Option<String>,
    proxy_jump: Option<String>,
    proxy_command: Option<String>,
}

fn resolve(alias: &str, sections: &[Section]) -> Resolved {
    let mut r = Resolved::default();
    for section in sections
        .iter()
        .filter(|s| !s.skip && section_matches(&s.patterns, alias))
    {
        for (key, args) in &section.settings {
            let slot = match key.as_str() {
                "hostname" => &mut r.hostname,
                "port" => &mut r.port,
                "user" => &mut r.user,
                "identityfile" => &mut r.identity_file,
                "proxyjump" => &mut r.proxy_jump,
                "proxycommand" => &mut r.proxy_command,
                _ => continue,
            };
            if slot.is_none() && !args.is_empty() {
                *slot = Some(if key == "proxycommand" {
                    args.join(" ")
                } else {
                    args[0].clone()
                });
            }
        }
    }
    r
}

/// Concrete aliases in file order: every `Host` name that isn't a pattern.
fn concrete_aliases(sections: &[Section]) -> Vec<String> {
    let mut seen = HashSet::new();
    let mut out = Vec::new();
    for section in sections.iter().filter(|s| !s.skip) {
        for alias in &section.patterns {
            if !is_pattern(alias) && seen.insert(alias.to_ascii_lowercase()) {
                out.push(alias.clone());
            }
        }
    }
    out
}

/// Expands `%`-tokens. An unknown token is left as written rather than
/// silently dropped.
fn expand_tokens(value: &str, tokens: &[(char, &str)]) -> String {
    let mut out = String::with_capacity(value.len());
    let mut chars = value.chars();
    while let Some(c) = chars.next() {
        if c != '%' {
            out.push(c);
            continue;
        }
        match chars.next() {
            Some('%') => out.push('%'),
            Some(t) => match tokens.iter().find(|(k, _)| *k == t) {
                Some((_, v)) => out.push_str(v),
                None => {
                    out.push('%');
                    out.push(t);
                }
            },
            None => out.push('%'),
        }
    }
    out
}

/// What the importer falls back to when a host doesn't say.
struct Defaults<'a> {
    user: &'a str,
    /// A key file that exists on this machine, in `~/.ssh/…` form.
    key: Option<&'a str>,
}

/// One concrete alias, resolved and validated.
#[derive(Debug, Clone)]
struct Candidate {
    alias: String,
    hostname: String,
    port: u16,
    username: String,
    key_ref: Option<String>,
    /// The last `ProxyJump` hop — the bastion that dials the host itself.
    jump: Option<String>,
    notes: Vec<String>,
    error: Option<String>,
}

fn candidate(alias: &str, sections: &[Section], defaults: &Defaults) -> Candidate {
    let r = resolve(alias, sections);
    let mut notes = Vec::new();

    let hostname = expand_tokens(
        r.hostname.as_deref().unwrap_or(alias),
        &[('h', alias), ('n', alias)],
    );
    let username = r.user.unwrap_or_else(|| defaults.user.to_string());

    let (port, port_error) = match r.port.as_deref() {
        None => (22, None),
        Some(raw) => match raw.parse::<u16>() {
            Ok(p) if p > 0 => (p, None),
            _ => (22, Some(format!("Port '{raw}' is not a valid port"))),
        },
    };

    // Stored as written — `~/…` included — the same way the host form stores
    // a key path, so imported hosts resolve keys exactly like hand-made ones.
    let key_ref = match r.identity_file {
        Some(file) => Some(expand_tokens(
            &file,
            &[
                ('d', "~"),
                ('h', &hostname),
                ('r', &username),
                ('u', defaults.user),
            ],
        )),
        None => defaults.key.map(str::to_string),
    };

    let jump = match r.proxy_jump.as_deref() {
        None => None,
        Some(v) if v.eq_ignore_ascii_case("none") => None,
        Some(v) => {
            let hops: Vec<&str> = v.split(',').map(str::trim).filter(|h| !h.is_empty()).collect();
            if hops.len() > 1 {
                notes.push(format!(
                    "ProxyJump has {} hops; only the last, {}, is linked",
                    hops.len(),
                    hops[hops.len() - 1]
                ));
            }
            hops.last().map(|h| h.to_string())
        }
    };
    if jump.is_none() {
        if let Some(cmd) = r.proxy_command.as_deref() {
            if !cmd.eq_ignore_ascii_case("none") {
                notes.push(
                    "uses ProxyCommand, which TerCTL can't run — imported without it".to_string(),
                );
            }
        }
    }

    let error = port_error
        .or_else(|| check_required(alias, MAX_LABEL_LEN, "alias").err())
        .or_else(|| check_required(&hostname, MAX_HOSTNAME_LEN, "HostName").err())
        .or_else(|| check_required(&username, MAX_USERNAME_LEN, "User").err())
        .or_else(|| {
            key_ref
                .as_deref()
                .and_then(|k| check_text(k, MAX_PATH_LEN, "IdentityFile").err())
        });

    Candidate {
        alias: alias.to_string(),
        hostname,
        port,
        username,
        key_ref,
        jump,
        notes,
        error,
    }
}

fn candidates(sections: &[Section], defaults: &Defaults) -> Result<Vec<Candidate>, String> {
    let aliases = concrete_aliases(sections);
    if aliases.len() > MAX_HOSTS {
        return Err(format!("config declares more than {MAX_HOSTS} hosts"));
    }
    Ok(aliases
        .iter()
        .map(|a| candidate(a, sections, defaults))
        .collect())
}

// ---------------------------------------------------------------------------
// Status and planning
// ---------------------------------------------------------------------------

type Endpoint = (String, u16, String);

/// The same identity rule the backup importer uses to spot a host that is
/// already saved under a different id.
fn endpoint(hostname: &str, port: u16, username: &str) -> Endpoint {
    (hostname.to_lowercase(), port, username.to_lowercase())
}

fn statuses(candidates: &[Candidate], existing: &[Host]) -> Vec<EntryStatus> {
    let saved: HashSet<Endpoint> = existing
        .iter()
        .map(|h| endpoint(&h.hostname, h.port, &h.username))
        .collect();
    let mut seen: HashSet<Endpoint> = HashSet::new();
    candidates
        .iter()
        .map(|c| {
            if c.error.is_some() {
                return EntryStatus::Invalid;
            }
            let key = endpoint(&c.hostname, c.port, &c.username);
            if saved.contains(&key) {
                EntryStatus::Exists
            } else if !seen.insert(key) {
                EntryStatus::Duplicate
            } else {
                EntryStatus::New
            }
        })
        .collect()
}

/// `unresolved` holds the hostnames that failed a lookup; the lookup itself
/// happens at the edge (`unresolvable`) so this stays deterministic.
fn preview_entries(
    candidates: Vec<Candidate>,
    existing: &[Host],
    unresolved: &HashSet<String>,
) -> Vec<SshConfigEntry> {
    let statuses = statuses(&candidates, existing);
    candidates
        .into_iter()
        .zip(statuses)
        .map(|(c, status)| {
            let mut notes = c.notes;
            if let Some(e) = c.error {
                notes.insert(0, e);
            }
            if status == EntryStatus::New && c.key_ref.is_none() {
                notes.push("no key file found — set one before connecting".to_string());
            }
            let unresolved = status == EntryStatus::New && unresolved.contains(&c.hostname);
            if unresolved {
                notes.push(format!(
                    "'{}' doesn't resolve from this machine — left unticked",
                    c.hostname
                ));
            }
            SshConfigEntry {
                alias: c.alias,
                hostname: c.hostname,
                port: c.port,
                username: c.username,
                key_ref: c.key_ref,
                jump: c.jump,
                status,
                unresolved,
                notes,
            }
        })
        .collect()
}

/// A bare name like `nas`: no dots, not an IP address, not
/// `localhost`. Only these are looked up, because a typo and a real host on
/// the local network look identical on paper — resolution is the one thing
/// that tells them apart. Dotted names are left alone: checking them would
/// mean a lookup per host and would untick real servers whenever a VPN is off.
fn is_short_name(host: &str) -> bool {
    !host.contains('.') && host.parse::<IpAddr>().is_err() && !host.eq_ignore_ascii_case("localhost")
}

/// Looks the names up in parallel and returns the ones that didn't resolve.
/// `ToSocketAddrs` has no timeout of its own, so each lookup runs on its own
/// thread and anything still pending at the deadline counts as unresolved;
/// the stragglers finish in the background and their answers are dropped.
fn unresolvable(hosts: &[String]) -> HashSet<String> {
    let unique: HashSet<String> = hosts.iter().cloned().collect();
    let (tx, rx) = mpsc::channel();
    for host in &unique {
        let (tx, host) = (tx.clone(), host.clone());
        std::thread::spawn(move || {
            let ok = (host.as_str(), 22)
                .to_socket_addrs()
                .map(|mut addrs| addrs.next().is_some())
                .unwrap_or(false);
            let _ = tx.send((host, ok));
        });
    }
    drop(tx);

    let deadline = Instant::now() + RESOLVE_DEADLINE;
    let mut resolved = HashSet::new();
    for _ in 0..unique.len() {
        match rx.recv_timeout(deadline.saturating_duration_since(Instant::now())) {
            Ok((host, true)) => {
                resolved.insert(host);
            }
            Ok((_, false)) => {}
            Err(_) => break,
        }
    }
    unique.into_iter().filter(|h| !resolved.contains(h)).collect()
}

/// `[user@]host[:port]`, including a bracketed IPv6 literal.
fn parse_hop(hop: &str, default_user: &str) -> (String, u16, String) {
    let (user, rest) = match hop.rsplit_once('@') {
        Some((u, r)) => (u.to_string(), r),
        None => (default_user.to_string(), hop),
    };
    let (host, port) = if let Some(inner) = rest.strip_prefix('[') {
        match inner.split_once(']') {
            Some((h, tail)) => (h, tail.strip_prefix(':')),
            None => (inner, None),
        }
    } else {
        match rest.rsplit_once(':') {
            // A bare IPv6 address has several colons; only one means a port.
            Some((h, p)) if !h.contains(':') => (h, Some(p)),
            _ => (rest, None),
        }
    };
    let port = port.and_then(|p| p.parse().ok()).unwrap_or(22);
    (host.to_string(), port, user)
}

/// Whether linking `from` → `to` would close a loop. `connect_host` refuses
/// to dial one anyway, but there's no reason to save a config that can never
/// connect.
fn closes_loop(jumps: &HashMap<String, Option<String>>, from: &str, to: &str) -> bool {
    let mut cursor = Some(to.to_string());
    for _ in 0..MAX_JUMP_WALK {
        match cursor {
            Some(id) if id == from => return true,
            Some(id) => cursor = jumps.get(&id).cloned().flatten(),
            None => return false,
        }
    }
    true
}

/// Builds the rows to insert. Ids are minted up front so a `ProxyJump` naming
/// another host in the same import can be linked before anything is written,
/// and the whole batch then lands in one transaction.
fn plan(
    candidates: &[Candidate],
    selected: &HashSet<String>,
    existing: &[Host],
    default_user: &str,
    mut new_id: impl FnMut() -> String,
) -> (Vec<Host>, SshConfigImportSummary) {
    let mut summary = SshConfigImportSummary::default();
    let statuses = statuses(candidates, existing);

    let mut hosts: Vec<Host> = Vec::new();
    let mut by_endpoint: HashMap<Endpoint, String> = existing
        .iter()
        .map(|h| (endpoint(&h.hostname, h.port, &h.username), h.id.clone()))
        .collect();
    let mut jumps: HashMap<String, Option<String>> = existing
        .iter()
        .map(|h| (h.id.clone(), h.jump_host_id.clone()))
        .collect();

    for (c, status) in candidates.iter().zip(&statuses) {
        if !selected.contains(&c.alias.to_ascii_lowercase()) {
            continue;
        }
        if *status != EntryStatus::New {
            summary.skipped.push(c.alias.clone());
            continue;
        }
        let id = new_id();
        by_endpoint.insert(endpoint(&c.hostname, c.port, &c.username), id.clone());
        jumps.insert(id.clone(), None);
        if c.key_ref.is_none() {
            summary.needs_key.push(c.alias.clone());
        }
        for note in &c.notes {
            summary.notes.push(format!("{}: {note}", c.alias));
        }
        hosts.push(Host {
            id,
            label: c.alias.clone(),
            hostname: c.hostname.clone(),
            port: c.port,
            username: c.username.clone(),
            auth_kind: AuthKind::Key,
            key_ref: c.key_ref.clone(),
            group_id: None,
            tags: Vec::new(),
            accent: None,
            term_scheme: None,
            os: None,
            jump_host_id: None,
            starred: false,
        });
    }

    // A hop is usually another alias in the file; resolve it through that
    // entry so its HostName, Port and User are honoured. Otherwise read it as
    // a literal `[user@]host[:port]`.
    let alias_endpoint: HashMap<String, Endpoint> = candidates
        .iter()
        .filter(|c| c.error.is_none())
        .map(|c| {
            (
                c.alias.to_ascii_lowercase(),
                endpoint(&c.hostname, c.port, &c.username),
            )
        })
        .collect();

    for host in &mut hosts {
        let hop = match candidates
            .iter()
            .find(|c| c.alias == host.label)
            .and_then(|c| c.jump.clone())
        {
            Some(hop) => hop,
            None => continue,
        };
        let target = alias_endpoint
            .get(&hop.to_ascii_lowercase())
            .cloned()
            .unwrap_or_else(|| {
                let (h, p, u) = parse_hop(&hop, default_user);
                endpoint(&h, p, &u)
            });

        match by_endpoint.get(&target) {
            Some(to) if *to == host.id => summary
                .notes
                .push(format!("{}: ProxyJump points at itself — imported without it", host.label)),
            Some(to) if closes_loop(&jumps, &host.id, to) => summary.notes.push(format!(
                "{}: ProxyJump {hop} would create a loop — imported without it",
                host.label
            )),
            Some(to) => {
                host.jump_host_id = Some(to.clone());
                jumps.insert(host.id.clone(), Some(to.clone()));
                summary.jumps_linked += 1;
            }
            None => summary.notes.push(format!(
                "{}: jump host {hop} is not in TerCTL or this import — imported without it",
                host.label
            )),
        }
    }

    summary.hosts_added = hosts.len();
    (hosts, summary)
}

// ---------------------------------------------------------------------------
// File access
// ---------------------------------------------------------------------------

fn home_dir() -> Result<PathBuf, String> {
    crate::sftp::local_home().map(PathBuf::from)
}

fn default_user() -> String {
    std::env::var("USER")
        .or_else(|_| std::env::var("USERNAME"))
        // The host form's own default when nothing better is known.
        .unwrap_or_else(|_| "root".to_string())
}

fn default_key(home: &Path) -> Option<String> {
    DEFAULT_KEYS
        .iter()
        .find(|name| home.join(".ssh").join(name).is_file())
        .map(|name| format!("~/.ssh/{name}"))
}

/// `~` and `~/…` against `home`; `ssh` allows `%d` for the same thing.
fn expand_home(path: &str, home: &Path) -> PathBuf {
    let path = expand_tokens(path, &[('d', &home.to_string_lossy())]);
    if path == "~" {
        home.to_path_buf()
    } else if let Some(rest) = path.strip_prefix("~/") {
        home.join(rest)
    } else {
        PathBuf::from(path)
    }
}

/// Resolves one `Include` argument. Relative paths are relative to `~/.ssh`,
/// as in `ssh`, and a wildcard is honoured in the final path component — the
/// `config.d/*` shape every real config uses. A missing file is skipped
/// silently, matching `ssh` itself.
fn include_targets(arg: &str, home: &Path) -> Vec<PathBuf> {
    let path = expand_home(arg, home);
    let path = if path.is_absolute() {
        path
    } else {
        home.join(".ssh").join(path)
    };
    let Some(name) = path.file_name().map(|n| n.to_string_lossy().to_string()) else {
        return Vec::new();
    };
    if !is_pattern(&name) {
        return if path.is_file() { vec![path] } else { Vec::new() };
    }
    let Some(dir) = path.parent() else {
        return Vec::new();
    };
    let Ok(read) = fs::read_dir(dir) else {
        return Vec::new();
    };
    let mut out: Vec<PathBuf> = read
        .filter_map(Result::ok)
        .map(|e| e.path())
        .filter(|p| p.is_file())
        .filter(|p| {
            p.file_name()
                .map(|n| wildcard(&name, &n.to_string_lossy()))
                .unwrap_or(false)
        })
        .collect();
    // `ssh` processes globbed includes in lexical order.
    out.sort();
    out
}

/// Reads a config, splicing each `Include` in at the point it appears.
fn load(
    path: &Path,
    home: &Path,
    depth: usize,
    seen: &mut HashSet<PathBuf>,
    out: &mut Vec<Directive>,
) -> Result<(), String> {
    if depth > MAX_INCLUDE_DEPTH {
        return Err(format!("Include is nested more than {MAX_INCLUDE_DEPTH} deep"));
    }
    // A file that includes itself, directly or round a longer loop, would
    // otherwise recurse until the depth limit.
    let canonical = fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf());
    if !seen.insert(canonical) {
        return Ok(());
    }
    let meta = fs::metadata(path).map_err(|e| format!("cannot read '{}': {e}", path.display()))?;
    if meta.len() > MAX_FILE_BYTES {
        return Err(format!("'{}' is too large to be an SSH config", path.display()));
    }
    let bytes = fs::read(path).map_err(|e| format!("cannot read '{}': {e}", path.display()))?;
    for directive in parse_text(&String::from_utf8_lossy(&bytes)) {
        if directive.key == "include" {
            for arg in &directive.args {
                for target in include_targets(arg, home) {
                    load(&target, home, depth + 1, seen, out)?;
                }
            }
        } else {
            out.push(directive);
        }
    }
    Ok(())
}

fn read_config(path: &Path, home: &Path) -> Result<Vec<Section>, String> {
    if !path.is_file() {
        return Err(format!("no SSH config found at {}", path.display()));
    }
    let mut directives = Vec::new();
    load(path, home, 0, &mut HashSet::new(), &mut directives)?;
    Ok(sections(directives))
}

fn config_path(path: Option<String>, home: &Path) -> PathBuf {
    match path {
        Some(p) if !p.trim().is_empty() => expand_home(&p, home),
        _ => home.join(".ssh").join("config"),
    }
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/// Parses the config and reports what an import would do. `path` defaults to
/// `~/.ssh/config`.
#[tauri::command]
pub async fn ssh_config_preview(
    store: State<'_, Store>,
    path: Option<String>,
) -> Result<SshConfigPreview, String> {
    let home = home_dir()?;
    let path = config_path(path, &home);
    let shown = path.display().to_string();

    // The lookups can block for up to RESOLVE_DEADLINE, so they run here on the
    // blocking pool alongside the file reads, never on the async runtime.
    let (found, unresolved) = tauri::async_runtime::spawn_blocking(move || {
        let sections = read_config(&path, &home)?;
        let user = default_user();
        let key = default_key(&home);
        let found = candidates(
            &sections,
            &Defaults {
                user: &user,
                key: key.as_deref(),
            },
        )?;
        let short: Vec<String> = found
            .iter()
            .filter(|c| c.error.is_none() && is_short_name(&c.hostname))
            .map(|c| c.hostname.clone())
            .collect();
        Ok::<_, String>((found, unresolvable(&short)))
    })
    .await
    .map_err(|e| e.to_string())??;

    let existing = store.list_hosts().map_err(|e| e.to_string())?;
    Ok(SshConfigPreview {
        path: shown,
        entries: preview_entries(found, &existing, &unresolved),
    })
}

/// Imports the ticked aliases. The file is parsed again here rather than
/// trusting rows sent back from the UI.
#[tauri::command]
pub async fn ssh_config_import(
    store: State<'_, Store>,
    path: String,
    aliases: Vec<String>,
) -> Result<SshConfigImportSummary, String> {
    let home = home_dir()?;
    let path = config_path(Some(path), &home);
    let user = default_user();

    let found = {
        let user = user.clone();
        tauri::async_runtime::spawn_blocking(move || {
            let sections = read_config(&path, &home)?;
            let key = default_key(&home);
            candidates(
                &sections,
                &Defaults {
                    user: &user,
                    key: key.as_deref(),
                },
            )
        })
        .await
        .map_err(|e| e.to_string())??
    };

    let selected: HashSet<String> = aliases.iter().map(|a| a.to_ascii_lowercase()).collect();
    let existing = store.list_hosts().map_err(|e| e.to_string())?;
    let (hosts, summary) = plan(&found, &selected, &existing, &user, || {
        Uuid::new_v4().to_string()
    });

    // No host key is known yet for any of these; it is pinned on first connect.
    let rows: Vec<(Host, Option<String>)> = hosts.into_iter().map(|h| (h, None)).collect();
    store
        .insert_imported(&rows, &[])
        .map_err(|e| format!("failed to write imported hosts: {e}"))?;
    Ok(summary)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    const DEFAULTS: Defaults = Defaults {
        user: "me",
        key: Some("~/.ssh/id_ed25519"),
    };

    fn parse(text: &str) -> Vec<Candidate> {
        candidates(&sections(parse_text(text)), &DEFAULTS).unwrap()
    }

    fn find<'a>(cs: &'a [Candidate], alias: &str) -> &'a Candidate {
        cs.iter().find(|c| c.alias == alias).expect("alias present")
    }

    fn saved(id: &str, hostname: &str, port: u16, username: &str) -> Host {
        Host {
            id: id.into(),
            label: id.into(),
            hostname: hostname.into(),
            port,
            username: username.into(),
            auth_kind: AuthKind::Key,
            key_ref: None,
            group_id: None,
            tags: Vec::new(),
            accent: None,
            term_scheme: None,
            os: None,
            jump_host_id: None,
            starred: false,
        }
    }

    fn select(aliases: &[&str]) -> HashSet<String> {
        aliases.iter().map(|a| a.to_ascii_lowercase()).collect()
    }

    fn ids() -> impl FnMut() -> String {
        let mut n = 0;
        move || {
            n += 1;
            format!("new-{n}")
        }
    }

    #[test]
    fn trailing_wildcard_section_is_a_fallback_not_an_override() {
        let cs = parse(
            "Host web\n  User root\nHost db\n  HostName 10.0.0.5\nHost *\n  User admin\n  Port 2222\n",
        );
        assert_eq!(find(&cs, "web").username, "root");
        assert_eq!(find(&cs, "db").username, "admin");
        assert_eq!(find(&cs, "db").port, 2222);
    }

    #[test]
    fn pattern_only_hosts_are_not_entries() {
        let cs = parse("Host *\n  User a\nHost prod-*\n  User b\nHost real\n");
        assert_eq!(cs.len(), 1);
        assert_eq!(cs[0].alias, "real");
        assert_eq!(cs[0].username, "a");
    }

    #[test]
    fn wildcard_sections_apply_to_matching_aliases() {
        let cs = parse("Host prod-api\nHost dev-api\nHost prod-*\n  User deploy\n");
        assert_eq!(find(&cs, "prod-api").username, "deploy");
        assert_eq!(find(&cs, "dev-api").username, "me");
    }

    #[test]
    fn a_negated_pattern_rules_a_section_out() {
        let cs = parse("Host bastion\nHost app\nHost * !bastion\n  ProxyJump bastion\n");
        assert_eq!(find(&cs, "bastion").jump, None);
        assert_eq!(find(&cs, "app").jump.as_deref(), Some("bastion"));
    }

    #[test]
    fn keywords_are_case_insensitive_and_accept_equals() {
        let cs = parse("HOST box\n  hostNAME=192.0.2.4\n  User = ops\n  PORT 2200\n");
        let c = find(&cs, "box");
        assert_eq!((c.hostname.as_str(), c.username.as_str(), c.port), ("192.0.2.4", "ops", 2200));
    }

    #[test]
    fn quoted_values_keep_their_spaces() {
        let cs = parse("Host box\n  IdentityFile \"~/My Keys/id_ed25519\"\n");
        assert_eq!(find(&cs, "box").key_ref.as_deref(), Some("~/My Keys/id_ed25519"));
    }

    #[test]
    fn hostname_token_expands_to_the_alias() {
        let cs = parse("Host web\nHost *\n  HostName %h.example.com\n");
        assert_eq!(find(&cs, "web").hostname, "web.example.com");
    }

    #[test]
    fn identity_tokens_are_expanded() {
        let cs = parse("Host web\n  HostName 192.0.2.4\n  User ops\n  IdentityFile %d/.ssh/%r_%h\n");
        assert_eq!(find(&cs, "web").key_ref.as_deref(), Some("~/.ssh/ops_192.0.2.4"));
    }

    #[test]
    fn match_sections_are_skipped_but_match_all_applies() {
        let cs = parse("Host box\nMatch exec \"true\"\n  User nobody\nMatch all\n  Port 2022\n");
        assert_eq!(find(&cs, "box").username, "me");
        assert_eq!(find(&cs, "box").port, 2022);
    }

    #[test]
    fn several_aliases_on_one_line_share_settings() {
        let cs = parse("Host a b\n  HostName 192.0.2.4\n");
        assert_eq!(cs.len(), 2);
        let st = statuses(&cs, &[]);
        assert_eq!(st, vec![EntryStatus::New, EntryStatus::Duplicate]);
    }

    #[test]
    fn an_invalid_port_is_reported_not_imported() {
        let cs = parse("Host box\n  Port 99999\n");
        assert!(find(&cs, "box").error.as_deref().unwrap().contains("99999"));
        let (hosts, summary) = plan(&cs, &select(&["box"]), &[], "me", ids());
        assert!(hosts.is_empty());
        assert_eq!(summary.skipped, vec!["box"]);
    }

    #[test]
    fn hosts_already_saved_are_marked_and_skipped() {
        let cs = parse("Host api\n  HostName 192.0.2.4\n  User Root\n");
        let existing = [saved("h1", "192.0.2.4", 22, "root")];
        assert_eq!(statuses(&cs, &existing), vec![EntryStatus::Exists]);
        let (hosts, summary) = plan(&cs, &select(&["api"]), &existing, "me", ids());
        assert!(hosts.is_empty());
        assert_eq!(summary.skipped, vec!["api"]);
    }

    #[test]
    fn only_ticked_aliases_are_imported() {
        let cs = parse("Host a\n  HostName 192.0.2.1\nHost b\n  HostName 192.0.2.2\n");
        let (hosts, _) = plan(&cs, &select(&["B"]), &[], "me", ids());
        assert_eq!(hosts.len(), 1);
        assert_eq!(hosts[0].label, "b");
    }

    #[test]
    fn proxyjump_links_a_host_in_the_same_import() {
        let cs = parse(
            "Host bastion\n  HostName 198.51.100.10\n  User root\n\
             Host app\n  HostName 203.0.113.20\n  User root\n  ProxyJump bastion\n",
        );
        let (hosts, summary) = plan(&cs, &select(&["bastion", "app"]), &[], "me", ids());
        let bastion = hosts.iter().find(|h| h.label == "bastion").unwrap();
        let api = hosts.iter().find(|h| h.label == "app").unwrap();
        assert_eq!(api.jump_host_id.as_deref(), Some(bastion.id.as_str()));
        assert_eq!(summary.jumps_linked, 1);
    }

    #[test]
    fn proxyjump_links_a_host_already_saved() {
        let cs = parse(
            "Host bastion\n  HostName 198.51.100.10\n  User root\n\
             Host app\n  HostName 203.0.113.20\n  ProxyJump bastion\n",
        );
        let existing = [saved("bastion-id", "198.51.100.10", 22, "root")];
        let (hosts, _) = plan(&cs, &select(&["app"]), &existing, "me", ids());
        assert_eq!(hosts[0].jump_host_id.as_deref(), Some("bastion-id"));
    }

    #[test]
    fn a_literal_hop_matches_a_saved_host_by_endpoint() {
        let cs = parse("Host app\n  HostName 10.0.0.9\n  ProxyJump ops@bastion.example.com:2222\n");
        let existing = [saved("b", "bastion.example.com", 2222, "ops")];
        let (hosts, _) = plan(&cs, &select(&["app"]), &existing, "me", ids());
        assert_eq!(hosts[0].jump_host_id.as_deref(), Some("b"));
    }

    #[test]
    fn an_unknown_jump_host_is_dropped_with_a_note() {
        let cs = parse("Host app\n  HostName 10.0.0.9\n  ProxyJump nowhere\n");
        let (hosts, summary) = plan(&cs, &select(&["app"]), &[], "me", ids());
        assert_eq!(hosts[0].jump_host_id, None);
        assert!(summary.notes[0].contains("nowhere"));
    }

    #[test]
    fn multi_hop_proxyjump_links_the_last_hop() {
        let cs = parse(
            "Host b1\n  HostName 192.0.2.1\nHost b2\n  HostName 192.0.2.2\n\
             Host app\n  HostName 192.0.2.3\n  ProxyJump b1,b2\n",
        );
        assert_eq!(find(&cs, "app").jump.as_deref(), Some("b2"));
        assert!(find(&cs, "app").notes[0].contains("2 hops"));
    }

    #[test]
    fn jump_loops_are_not_saved() {
        let cs = parse(
            "Host a\n  HostName 192.0.2.1\n  ProxyJump b\nHost b\n  HostName 192.0.2.2\n  ProxyJump a\n",
        );
        let (hosts, summary) = plan(&cs, &select(&["a", "b"]), &[], "me", ids());
        let linked = hosts.iter().filter(|h| h.jump_host_id.is_some()).count();
        assert_eq!(linked, 1);
        assert!(summary.notes.iter().any(|n| n.contains("loop")));
    }

    #[test]
    fn proxycommand_is_noted_as_unsupported() {
        let cs = parse("Host app\n  ProxyCommand ssh -W %h:%p bastion\n");
        assert!(find(&cs, "app").notes[0].contains("ProxyCommand"));
    }

    #[test]
    fn a_missing_key_is_flagged() {
        let cs = candidates(
            &sections(parse_text("Host app\n")),
            &Defaults { user: "me", key: None },
        )
        .unwrap();
        let (_, summary) = plan(&cs, &select(&["app"]), &[], "me", ids());
        assert_eq!(summary.needs_key, vec!["app"]);
    }

    #[test]
    fn hop_parsing_handles_users_ports_and_ipv6() {
        assert_eq!(parse_hop("h", "me"), ("h".into(), 22, "me".into()));
        assert_eq!(parse_hop("u@h:2200", "me"), ("h".into(), 2200, "u".into()));
        assert_eq!(parse_hop("[::1]:2200", "me"), ("::1".into(), 2200, "me".into()));
        assert_eq!(parse_hop("::1", "me"), ("::1".into(), 22, "me".into()));
    }

    #[test]
    fn only_bare_names_are_looked_up() {
        assert!(is_short_name("oldbox"));
        assert!(is_short_name("nas"));
        assert!(!is_short_name("web.example.com"));
        assert!(!is_short_name("203.0.113.20"));
        assert!(!is_short_name("::1"));
        assert!(!is_short_name("LocalHost"));
    }

    #[test]
    fn an_unresolved_bare_name_is_flagged_and_explained() {
        let cs = parse("Host oldbox\n  HostName oldbox\nHost web\n  HostName 192.0.2.4\n");
        let unresolved: HashSet<String> = ["oldbox".to_string()].into();
        let entries = preview_entries(cs, &[], &unresolved);
        let oldbox = entries.iter().find(|e| e.alias == "oldbox").unwrap();
        let web = entries.iter().find(|e| e.alias == "web").unwrap();
        assert!(oldbox.unresolved);
        assert!(oldbox.notes.iter().any(|n| n.contains("doesn't resolve")));
        // Still importable — unresolved only changes the default tick.
        assert_eq!(oldbox.status, EntryStatus::New);
        assert!(!web.unresolved);
    }

    #[test]
    fn hosts_that_cant_be_imported_are_not_also_flagged_unresolved() {
        let cs = parse("Host nas\n  HostName nas\n  User me\n");
        let existing = [saved("h1", "nas", 22, "me")];
        let unresolved: HashSet<String> = ["nas".to_string()].into();
        let entries = preview_entries(cs, &existing, &unresolved);
        assert_eq!(entries[0].status, EntryStatus::Exists);
        assert!(!entries[0].unresolved);
    }

    #[test]
    fn lookups_separate_real_names_from_ones_that_dont_resolve() {
        // `localhost` resolves from the hosts file with no network, and
        // `.invalid` is reserved never to resolve (RFC 6761), so this holds
        // offline as well as on.
        let missing = unresolvable(&[
            "localhost".to_string(),
            "terctl-nonexistent.invalid".to_string(),
        ]);
        assert_eq!(missing, ["terctl-nonexistent.invalid".to_string()].into());
    }

    fn scratch() -> PathBuf {
        let dir = std::env::temp_dir().join(format!("terctl-sshconfig-{}", Uuid::new_v4()));
        fs::create_dir_all(dir.join(".ssh").join("config.d")).unwrap();
        dir
    }

    #[test]
    fn includes_are_spliced_in_place_in_lexical_order() {
        let home = scratch();
        let ssh = home.join(".ssh");
        fs::write(ssh.join("config"), "Include config.d/*\nHost *\n  User fallback\n").unwrap();
        fs::write(ssh.join("config.d").join("b.conf"), "Host two\n  HostName 192.0.2.2\n").unwrap();
        fs::write(ssh.join("config.d").join("a.conf"), "Host one\n  HostName 192.0.2.1\n").unwrap();

        let secs = read_config(&ssh.join("config"), &home).unwrap();
        let cs = candidates(&secs, &DEFAULTS).unwrap();
        let aliases: Vec<&str> = cs.iter().map(|c| c.alias.as_str()).collect();
        assert_eq!(aliases, vec!["one", "two"]);
        assert_eq!(cs[0].username, "fallback");
        fs::remove_dir_all(home).ok();
    }

    #[test]
    fn a_self_including_config_terminates() {
        let home = scratch();
        let config = home.join(".ssh").join("config");
        fs::write(&config, "Include config\nHost box\n").unwrap();
        let secs = read_config(&config, &home).unwrap();
        assert_eq!(candidates(&secs, &DEFAULTS).unwrap().len(), 1);
        fs::remove_dir_all(home).ok();
    }

    #[test]
    fn a_missing_config_is_a_clear_error() {
        let home = scratch();
        let err = read_config(&home.join(".ssh").join("nope"), &home).unwrap_err();
        assert!(err.contains("no SSH config found"));
        fs::remove_dir_all(home).ok();
    }
}
