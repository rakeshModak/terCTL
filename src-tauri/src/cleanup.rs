use crate::metrics::MetricsManager;
use crate::store::Store;
use russh::ChannelMsg;
use std::collections::HashSet;
use std::time::Duration;
use tauri::State;

// Server cleanup for the disk map. The set of things it can do is fixed here:
// the frontend picks cleanups by id and, for the two that take arguments,
// passes volume names or log paths that are validated again below and once
// more on the server. Nothing the user typed or clicked in the map is ever
// handed to `rm`.

/// How much the journal is allowed to keep after a vacuum.
const JOURNAL_KEEP_KB: u64 = 200 * 1024;

/// A live log at least this big is offered for truncation.
const BIG_LOG_KB: u64 = 500 * 1024;

const SCAN_SECS: u64 = 60;
const RUN_SECS: u64 = 300;

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BigFile {
    pub path: String,
    pub size_kb: u64,
}

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanupItem {
    pub id: String,
    /// What running it would free, best estimate.
    pub frees_kb: u64,
    /// Files, images or containers it would remove, where that's countable.
    pub count: Option<u64>,
    /// The command, as shown to the user before anything runs.
    pub command: String,
    /// `docker_volumes`: the unused volumes, each opted into by name.
    pub names: Vec<String>,
    /// `truncate_logs`: the big live logs, each opted into by path.
    pub files: Vec<BigFile>,
}

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanupScan {
    /// `root`, `sudo` (passwordless) or `none`.
    pub privilege: String,
    pub items: Vec<CleanupItem>,
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanupAction {
    pub id: String,
    #[serde(default)]
    pub names: Vec<String>,
    #[serde(default)]
    pub paths: Vec<String>,
}

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanupOutcome {
    pub id: String,
    pub ok: bool,
    /// The last lines the command printed, for the result list.
    pub message: String,
}

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanupReport {
    pub outcomes: Vec<CleanupOutcome>,
    /// Drop in `/` usage across the whole run, as df saw it.
    pub freed_kb: u64,
}

/// Shared by both scripts: pick how to get root and how to reach Docker.
/// `sudo -n` never prompts, so a sudo that wants a password reads as `none`
/// instead of hanging the channel. Docker is tried without sudo first, since
/// a user in the `docker` group can clean it up without root.
const PRELUDE: &str = r#"LC_ALL=C; export LC_ALL
if [ "$(id -u)" = 0 ]; then S=''; P=root
elif sudo -n true 2>/dev/null; then S='sudo -n'; P=sudo
else S=''; P=none; fi
D=''
if command -v docker >/dev/null 2>&1; then
  if docker info >/dev/null 2>&1; then D='docker'
  elif [ -n "$S" ] && $S docker info >/dev/null 2>&1; then D="$S docker"; fi
fi
# PM2 keeps logs per user under ~/.pm2/logs. Your own are always looked at;
# with root, every home's too. Found again on the server at run time, so the
# frontend never names a path here.
pm2dirs() { for d in "$HOME/.pm2/logs" /root/.pm2/logs /home/*/.pm2/logs; do
    $S test -d "$d" 2>/dev/null && printf '%s\n' "$d"; done | sort -u; }
PM=''
if command -v apt-get >/dev/null 2>&1; then PM=apt
elif command -v dnf >/dev/null 2>&1; then PM=dnf
elif command -v yum >/dev/null 2>&1; then PM=yum; fi
"#;

// Rotated logs: compressed, numbered or `.old` copies logrotate leaves behind.
// The journal has its own cleanup, so its directory is pruned out.
const ROTATED: &str = r#"\( -name '*.gz' -o -name '*.xz' -o -name '*.bz2' -o -name '*.zst' -o -name '*.old' -o -name '*.[0-9]' -o -name '*.[0-9].log' \)"#;

/// Tagged lines, one fact each, so the parser never guesses:
///   `P\t<privilege>`  `PM\t<apt|dnf|yum>`  `J\t<kb>` journal size
///   `G\t<kb>\t<n>` rotated logs  `K\t<kb>` package cache
///   `XS\t<type>\t<reclaimable>` docker system df  `XI\t<size>` dangling image
///   `XC\t<size>` stopped container  `XV\t<name>` unused volume
///   `L\t<kb>\t<path>` big live log  `M\t<kb>\t<n>` PM2 logs
fn scan_script() -> String {
    let body = r#"
printf 'P\t%s\n' "$P"
[ -n "$PM" ] && printf 'PM\t%s\n' "$PM"
if command -v journalctl >/dev/null 2>&1 && [ -d /var/log/journal ]; then
  $S du -sk /var/log/journal 2>/dev/null | awk '{printf "J\t%s\n",$1}'
fi
$S find /var/log -xdev -path /var/log/journal -prune -o -type f __ROTATED__ -mtime +7 -exec du -k {} + 2>/dev/null \
  | awk '{s+=$1;n++} END{printf "G\t%d\t%d\n",s,n}'
case "$PM" in
  apt) c=/var/cache/apt/archives ;;
  dnf) c=/var/cache/dnf ;;
  yum) c=/var/cache/yum ;;
  *) c='' ;;
esac
[ -n "$c" ] && [ -d "$c" ] && $S du -sk "$c" 2>/dev/null | awk '{printf "K\t%s\n",$1}'
if [ -n "$D" ]; then
  $D system df --format '{{.Type}}	{{.Reclaimable}}' 2>/dev/null | sed 's/^/XS	/'
  $D images -f dangling=true --format '{{.Size}}' 2>/dev/null | sed 's/^/XI	/'
  $D ps -a -f status=exited -f status=created --format '{{.Size}}' 2>/dev/null | sed 's/^/XC	/'
  $D volume ls -qf dangling=true 2>/dev/null | sed 's/^/XV	/'
fi
pm2dirs | while IFS= read -r d; do
  $S find "$d" -maxdepth 1 -type f -name '*.log' -exec du -k {} + 2>/dev/null
done | awk '{s+=$1;n++} END{if(n) printf "M\t%d\t%d\n",s,n}'
$S find /var/log /var/lib/docker/containers -xdev -type f -size +__BIGK__k \
  ! -path '/var/log/journal/*' ! __ROTATED__ -exec du -k {} + 2>/dev/null | sed 's/^/L	/'
"#;
    let body = body
        .replace("__ROTATED__", ROTATED)
        .replace("__BIGK__", &BIG_LOG_KB.to_string());
    format!("{PRELUDE}{body}")
}

/// Quote for POSIX sh: inside single quotes nothing is special except the
/// quote itself, which is closed, escaped, and reopened.
fn sh_quote(s: &str) -> String {
    format!("'{}'", s.replace('\'', r"'\''"))
}

/// Docker's own rule for volume names, so anything else is refused outright.
fn valid_volume(name: &str) -> bool {
    let mut chars = name.chars();
    matches!(chars.next(), Some(c) if c.is_ascii_alphanumeric())
        && chars.all(|c| c.is_ascii_alphanumeric() || matches!(c, '_' | '.' | '-'))
}

fn is_hex_id(s: &str) -> bool {
    s.len() == 64 && s.bytes().all(|b| b.is_ascii_hexdigit())
}

/// Only live logs may be truncated: anything under /var/log except the
/// journal (binary, managed by journald), or a container's own json log.
fn valid_log(path: &str) -> bool {
    if path.contains(['\n', '\r', '\0'])
        || path.split('/').any(|seg| seg == ".." || seg == ".")
        || path.contains("//")
    {
        return false;
    }
    if let Some(rest) = path.strip_prefix("/var/log/") {
        return !rest.is_empty() && !path.starts_with("/var/log/journal/");
    }
    if let Some(rest) = path.strip_prefix("/var/lib/docker/containers/") {
        let parts: Vec<&str> = rest.split('/').collect();
        return parts.len() == 2
            && is_hex_id(parts[0])
            && parts[1] == format!("{}-json.log", parts[0]);
    }
    false
}

/// One `step <id> <command…>` line per action. `step` runs the command,
/// keeps its last three lines and prints `R\t<id>\t<status>\t<output>`.
/// `dstep` does the same for a docker subcommand, `fstep` for a shell function.
fn run_script(actions: &[CleanupAction]) -> Result<String, String> {
    let mut seen = HashSet::new();
    let mut steps = String::new();
    for a in actions {
        if !seen.insert(a.id.as_str()) {
            continue;
        }
        let line = match a.id.as_str() {
            "journal" => "step journal $S journalctl --vacuum-size=200M".to_string(),
            "rotated_logs" => format!(
                "step rotated_logs $S find /var/log -xdev -path /var/log/journal -prune -o -type f {ROTATED} -mtime +7 -exec rm -f {{}} +"
            ),
            "package_cache" => r#"case "$PM" in
  apt) step package_cache $S apt-get clean ;;
  dnf) step package_cache $S dnf clean packages ;;
  yum) step package_cache $S yum clean packages ;;
  *) printf 'R\tpackage_cache\t1\tno package manager found\n' ;;
esac"#
                .to_string(),
            // `fstep`: pm2clean is a shell function, which `timeout` can't run.
            "pm2_logs" => "fstep pm2_logs pm2clean".to_string(),
            "docker_build_cache" => "dstep docker_build_cache builder prune -f".to_string(),
            "docker_images" => "dstep docker_images image prune -f".to_string(),
            "docker_containers" => "dstep docker_containers container prune -f".to_string(),
            "docker_volumes" => {
                if a.names.is_empty() {
                    continue;
                }
                if let Some(bad) = a.names.iter().find(|n| !valid_volume(n)) {
                    return Err(format!("Not a valid volume name: {bad}"));
                }
                // By name, never `volume prune`: newer Docker prunes only
                // anonymous volumes and older Docker prunes every unused one,
                // so naming them removes exactly the list the user ticked.
                // Docker itself refuses any that came into use since the scan.
                let names: Vec<String> = a.names.iter().map(|n| sh_quote(n)).collect();
                format!("dstep docker_volumes volume rm -- {}", names.join(" "))
            }
            "truncate_logs" => {
                if a.paths.is_empty() {
                    continue;
                }
                if let Some(bad) = a.paths.iter().find(|p| !valid_log(p)) {
                    return Err(format!("Not a log TerCTL can truncate: {bad}"));
                }
                let paths: Vec<String> = a.paths.iter().map(|p| sh_quote(p)).collect();
                // `fstep`, not `step`: `timeout` runs programs and can't call a
                // shell function, and truncating is instant anyway.
                format!("fstep truncate_logs trunc {}", paths.join(" "))
            }
            other => return Err(format!("Unknown cleanup: {other}")),
        };
        steps.push_str(&line);
        steps.push('\n');
    }
    if steps.is_empty() {
        return Err("Nothing selected to clean".into());
    }

    // `trunc` re-checks on the server what valid_log checked here: a regular
    // file, not a symlink that could point somewhere that isn't a log.
    let helpers = r#"T=''
command -v timeout >/dev/null 2>&1 && T="timeout __SECS__"
report() { printf 'R\t%s\t%s\t' "$1" "$2"; printf '%s' "$3" | tail -n 3 | tr '\t\n' '  '; printf '\n'; }
step() { id=$1; shift; out=$($T "$@" 2>&1); report "$id" $? "$out"; }
fstep() { id=$1; shift; out=$("$@" 2>&1); report "$id" $? "$out"; }
dstep() { id=$1; shift
  if [ -z "$D" ]; then printf 'R\t%s\t1\tcannot reach docker\n' "$id"; return; fi
  step "$id" $D "$@"; }
trunc() { rc=0; for f in "$@"; do
    if $S test -f "$f" && ! $S test -h "$f"; then $S truncate -s 0 -- "$f" || rc=1
    else echo "skipped $f: not a regular file"; rc=1; fi
  done; return $rc; }
# What `pm2 flush` does, for every PM2 user at once: empty the live logs
# (PM2 keeps writing to the same files) and drop pm2-logrotate's dated
# copies (`app-out__2024-01-01_00-00-00.log`). -type f never follows links.
pm2clean() { pm2dirs | { rc=0; while IFS= read -r d; do
    $S find "$d" -maxdepth 1 -type f -name '*__*.log' -exec rm -f {} + || rc=1
    $S find "$d" -maxdepth 1 -type f -name '*.log' ! -name '*__*.log' -exec truncate -s 0 {} + || rc=1
  done; exit $rc; }; }
used() { df -Pk / 2>/dev/null | awk 'NR==2{print $3}'; }
printf 'B\t%s\n' "$(used)"
"#
    .replace("__SECS__", &RUN_SECS.to_string());
    Ok(format!("{PRELUDE}{helpers}{steps}printf 'A\\t%s\\n' \"$(used)\"\n"))
}

/// Docker prints SI sizes (`1.2GB`, `512kB`, `0B`), sometimes followed by a
/// note in brackets: `12.3kB (virtual 100MB)`, `1.2GB (40%)`. Returns KiB.
fn docker_kb(s: &str) -> Option<u64> {
    let head = s.split_whitespace().next()?;
    let split = head.find(|c: char| c.is_ascii_alphabetic())?;
    let (num, unit) = head.split_at(split);
    let n: f64 = num.parse().ok()?;
    let mult = match unit {
        "B" => 1.0,
        "kB" | "KB" => 1e3,
        "MB" => 1e6,
        "GB" => 1e9,
        "TB" => 1e12,
        _ => return None,
    };
    Some((n * mult / 1024.0).round() as u64)
}

fn parse_scan(raw: &str) -> CleanupScan {
    let mut privilege = "none".to_string();
    let mut pm = String::new();
    let mut journal = None;
    let mut rotated = (0, 0);
    let mut pkg = None;
    let mut build_cache = None;
    let (mut images, mut image_kb) = (0u64, 0u64);
    let (mut containers, mut container_kb) = (0u64, 0u64);
    let mut volumes_kb = None;
    let mut volumes = Vec::new();
    let mut big = Vec::new();
    let mut pm2 = (0, 0);

    for line in raw.lines() {
        let mut f = line.splitn(3, '\t');
        let (tag, a, b) = (f.next().unwrap_or(""), f.next(), f.next());
        let num = |s: Option<&str>| s.and_then(|v| v.trim().parse::<u64>().ok());
        match tag {
            "P" => privilege = a.unwrap_or("none").to_string(),
            "PM" => pm = a.unwrap_or("").to_string(),
            "J" => journal = num(a),
            "G" => rotated = (num(a).unwrap_or(0), num(b).unwrap_or(0)),
            "K" => pkg = num(a),
            "M" => pm2 = (num(a).unwrap_or(0), num(b).unwrap_or(0)),
            "XS" => {
                let kb = b.and_then(docker_kb);
                match a {
                    Some("Build Cache") => build_cache = kb,
                    Some("Local Volumes") => volumes_kb = kb,
                    _ => {}
                }
            }
            "XI" => {
                images += 1;
                image_kb += a.and_then(docker_kb).unwrap_or(0);
            }
            "XC" => {
                containers += 1;
                container_kb += a.and_then(docker_kb).unwrap_or(0);
            }
            "XV" => {
                if let Some(name) = a.filter(|n| valid_volume(n)) {
                    volumes.push(name.to_string());
                }
            }
            "L" => {
                if let (Some(kb), Some(path)) = (num(a), b) {
                    if valid_log(path) {
                        big.push(BigFile { path: path.to_string(), size_kb: kb });
                    }
                }
            }
            _ => {}
        }
    }

    let item = |id: &str, frees_kb: u64, count: Option<u64>, command: &str| CleanupItem {
        id: id.to_string(),
        frees_kb,
        count,
        command: command.to_string(),
        names: Vec::new(),
        files: Vec::new(),
    };

    let mut items = Vec::new();
    if let Some(kb) = journal {
        items.push(item(
            "journal",
            kb.saturating_sub(JOURNAL_KEEP_KB),
            None,
            "journalctl --vacuum-size=200M",
        ));
    }
    if rotated.1 > 0 {
        items.push(item(
            "rotated_logs",
            rotated.0,
            Some(rotated.1),
            "find /var/log -name '*.gz' -o -name '*.1' … -mtime +7 -delete",
        ));
    }
    if let Some(kb) = pkg {
        let cmd = match pm.as_str() {
            "dnf" => "dnf clean packages",
            "yum" => "yum clean packages",
            _ => "apt-get clean",
        };
        items.push(item("package_cache", kb, None, cmd));
    }
    if let Some(kb) = build_cache {
        items.push(item("docker_build_cache", kb, None, "docker builder prune -f"));
    }
    if images > 0 {
        items.push(item("docker_images", image_kb, Some(images), "docker image prune -f"));
    }
    if containers > 0 {
        items.push(item(
            "docker_containers",
            container_kb,
            Some(containers),
            "docker container prune -f",
        ));
    }
    if !volumes.is_empty() {
        let mut v = item(
            "docker_volumes",
            volumes_kb.unwrap_or(0),
            Some(volumes.len() as u64),
            "docker volume rm <name>…",
        );
        v.names = volumes;
        items.push(v);
    }
    if pm2.1 > 0 {
        items.push(item(
            "pm2_logs",
            pm2.0,
            Some(pm2.1),
            "empty ~/.pm2/logs/*.log (like pm2 flush)",
        ));
    }
    if !big.is_empty() {
        big.sort_by(|a, b| b.size_kb.cmp(&a.size_kb));
        let mut t = item(
            "truncate_logs",
            big.iter().map(|f| f.size_kb).sum(),
            Some(big.len() as u64),
            "truncate -s 0 <file>",
        );
        t.files = big;
        items.push(t);
    }

    CleanupScan { privilege, items }
}

fn parse_run(raw: &str) -> CleanupReport {
    let mut before = None;
    let mut after = None;
    let mut outcomes = Vec::new();
    for line in raw.lines() {
        if let Some(v) = line.strip_prefix("B\t") {
            before = v.trim().parse::<u64>().ok();
        } else if let Some(v) = line.strip_prefix("A\t") {
            after = v.trim().parse::<u64>().ok();
        } else if let Some(rest) = line.strip_prefix("R\t") {
            let mut f = rest.splitn(3, '\t');
            let id = f.next().unwrap_or("").to_string();
            let status = f.next().and_then(|s| s.trim().parse::<i32>().ok());
            let message = f.next().unwrap_or("").trim().to_string();
            outcomes.push(CleanupOutcome {
                id,
                ok: status == Some(0),
                message: match status {
                    Some(124) => "Stopped: took longer than 5 minutes".into(),
                    _ => message,
                },
            });
        }
    }
    let freed_kb = match (before, after) {
        (Some(b), Some(a)) => b.saturating_sub(a),
        _ => 0,
    };
    CleanupReport { outcomes, freed_kb }
}

async fn exec(
    store: &Store,
    metrics: &MetricsManager,
    host_id: &str,
    script: &str,
    limit: Duration,
) -> Result<String, String> {
    let run = || async {
        let handle = metrics.connection(store, host_id).await?;
        let mut channel = handle
            .channel_open_session()
            .await
            .map_err(|e| e.to_string())?;
        channel.exec(true, script).await.map_err(|e| e.to_string())?;
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
    match tokio::time::timeout(limit, run()).await {
        Ok(Ok(raw)) => Ok(raw),
        Ok(Err(e)) => {
            // Drop a stale/broken connection so the next try reconnects.
            metrics.drop_host(host_id).await;
            Err(e)
        }
        Err(_) => {
            metrics.drop_host(host_id).await;
            Err("The server stopped responding".into())
        }
    }
}

/// What can be cleaned on the host and roughly how much each would free.
/// Read-only: it only measures.
#[tauri::command]
pub async fn disk_cleanup_scan(
    store: State<'_, Store>,
    metrics: State<'_, MetricsManager>,
    host_id: String,
) -> Result<CleanupScan, String> {
    let raw = exec(
        &store,
        &metrics,
        &host_id,
        &scan_script(),
        Duration::from_secs(SCAN_SECS),
    )
    .await?;
    Ok(parse_scan(&raw))
}

/// Runs the chosen cleanups one after another and reports each.
#[tauri::command]
pub async fn disk_cleanup_run(
    store: State<'_, Store>,
    metrics: State<'_, MetricsManager>,
    host_id: String,
    actions: Vec<CleanupAction>,
) -> Result<CleanupReport, String> {
    let script = run_script(&actions)?;
    // Each step has its own remote `timeout`; this only catches a wedged
    // connection, so it allows for every step running long.
    let limit = Duration::from_secs(RUN_SECS * actions.len().max(1) as u64 + 30);
    let raw = exec(&store, &metrics, &host_id, &script, limit).await?;
    Ok(parse_run(&raw))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn action(id: &str) -> CleanupAction {
        CleanupAction { id: id.into(), names: vec![], paths: vec![] }
    }

    #[test]
    fn reads_docker_sizes() {
        assert_eq!(docker_kb("0B"), Some(0));
        assert_eq!(docker_kb("2.048kB"), Some(2));
        assert_eq!(docker_kb("1.5GB (40%)"), Some(1_464_844));
        assert_eq!(docker_kb("12.3MB (virtual 1GB)"), Some(12_012));
        assert_eq!(docker_kb("lots"), None);
        assert_eq!(docker_kb(""), None);
    }

    #[test]
    fn parses_a_full_scan() {
        let raw = "P\tsudo\nPM\tapt\n\
J\t512000\n\
G\t3000\t12\n\
K\t80000\n\
XS\tImages\t1.2GB (40%)\n\
XS\tBuild Cache\t500MB\n\
XS\tLocal Volumes\t2GB (100%)\n\
XI\t100MB\nXI\t50MB\n\
XC\t1MB (virtual 300MB)\n\
XV\tpg_data\nXV\tbad name\n\
M\t40000\t6\n\
L\t900000\t/var/log/app.log\n\
L\t700000\t/etc/passwd\n";
        let s = parse_scan(raw);
        assert_eq!(s.privilege, "sudo");
        let ids: Vec<_> = s.items.iter().map(|i| i.id.as_str()).collect();
        assert_eq!(
            ids,
            [
                "journal",
                "rotated_logs",
                "package_cache",
                "docker_build_cache",
                "docker_images",
                "docker_containers",
                "docker_volumes",
                "pm2_logs",
                "truncate_logs"
            ]
        );
        // Journal keeps 200 MiB, so only the rest counts as freed.
        assert_eq!(s.items[0].frees_kb, 512000 - JOURNAL_KEEP_KB);
        assert_eq!(s.items[1].count, Some(12));
        assert_eq!(s.items[4].count, Some(2));
        // A name docker wouldn't accept, and a path outside the log dirs, are dropped.
        assert_eq!(s.items[6].names, ["pg_data"]);
        assert_eq!((s.items[7].frees_kb, s.items[7].count), (40000, Some(6)));
        assert_eq!(s.items[8].files.len(), 1);
        assert_eq!(s.items[8].files[0].path, "/var/log/app.log");
    }

    #[test]
    fn a_bare_server_offers_nothing() {
        let s = parse_scan("P\tnone\nG\t0\t0\n");
        assert_eq!(s.privilege, "none");
        assert!(s.items.is_empty());
    }

    #[test]
    fn a_small_journal_frees_nothing_rather_than_underflowing() {
        let s = parse_scan("J\t1000\n");
        assert_eq!(s.items[0].frees_kb, 0);
    }

    #[test]
    fn log_paths_are_checked() {
        assert!(valid_log("/var/log/nginx/access.log"));
        assert!(valid_log("/var/log/syslog"));
        let id = "a".repeat(64);
        assert!(valid_log(&format!("/var/lib/docker/containers/{id}/{id}-json.log")));

        assert!(!valid_log("/var/log/"));
        assert!(!valid_log("/var/log/journal/x/system.journal"));
        assert!(!valid_log("/var/log/../../etc/passwd"));
        assert!(!valid_log("/var/log/./x"));
        assert!(!valid_log("/var/log//x"));
        assert!(!valid_log("/etc/passwd"));
        assert!(!valid_log("/var/log/x\nreboot"));
        assert!(!valid_log(&format!("/var/lib/docker/containers/{id}/config.v2.json")));
        assert!(!valid_log("/var/lib/docker/containers/abc/abc-json.log"));
    }

    #[test]
    fn volume_names_are_checked() {
        assert!(valid_volume("pg_data"));
        assert!(valid_volume("3f2a.vol-1"));
        assert!(!valid_volume("-rf"));
        assert!(!valid_volume("a b"));
        assert!(!valid_volume("x;reboot"));
        assert!(!valid_volume(""));
    }

    #[test]
    fn the_run_script_only_contains_known_commands() {
        let s = run_script(&[
            action("journal"),
            action("docker_images"),
            action("pm2_logs"),
            action("journal"),
        ])
        .unwrap();
        assert!(s.contains("fstep pm2_logs pm2clean"));
        assert_eq!(s.matches("step journal").count(), 1, "duplicates collapse");
        assert!(s.contains("dstep docker_images image prune -f"));
        assert!(s.starts_with("LC_ALL=C"));
        assert!(s.trim_end().ends_with(r#"printf 'A\t%s\n' "$(used)""#));
    }

    #[test]
    fn rejects_unknown_ids_and_bad_arguments() {
        assert!(run_script(&[action("rm_everything")]).is_err());
        assert!(run_script(&[]).is_err());
        let bad_volume = CleanupAction {
            id: "docker_volumes".into(),
            names: vec!["x; reboot".into()],
            paths: vec![],
        };
        assert!(run_script(&[bad_volume]).is_err());
        let bad_path = CleanupAction {
            id: "truncate_logs".into(),
            names: vec![],
            paths: vec!["/etc/shadow".into()],
        };
        assert!(run_script(&[bad_path]).is_err());
    }

    #[test]
    fn volumes_and_logs_are_quoted_one_by_one() {
        let s = run_script(&[
            CleanupAction {
                id: "docker_volumes".into(),
                names: vec!["a".into(), "b.c".into()],
                paths: vec![],
            },
            CleanupAction {
                id: "truncate_logs".into(),
                names: vec![],
                paths: vec!["/var/log/it's.log".into()],
            },
        ])
        .unwrap();
        assert!(s.contains("dstep docker_volumes volume rm -- 'a' 'b.c'"));
        assert!(s.contains(r"fstep truncate_logs trunc '/var/log/it'\''s.log'"));
    }

    #[test]
    fn empty_argument_lists_are_skipped_not_run() {
        let empty = CleanupAction { id: "docker_volumes".into(), names: vec![], paths: vec![] };
        assert!(run_script(&[empty]).is_err(), "nothing left to run");
    }

    #[test]
    fn parses_a_run_report() {
        let raw = "B\t9000000\n\
R\tjournal\t0\tVacuuming done, freing 1.2G\n\
R\tdocker_images\t1\tcannot reach docker\n\
R\trotated_logs\t124\t\n\
A\t7500000\n";
        let r = parse_run(raw);
        assert_eq!(r.freed_kb, 1_500_000);
        assert_eq!(r.outcomes.len(), 3);
        assert!(r.outcomes[0].ok);
        assert!(!r.outcomes[1].ok);
        assert_eq!(r.outcomes[1].message, "cannot reach docker");
        assert!(r.outcomes[2].message.contains("5 minutes"));
    }

    #[test]
    fn usage_growing_during_the_run_reports_zero_not_an_underflow() {
        let r = parse_run("B\t100\nA\t200\n");
        assert_eq!(r.freed_kb, 0);
    }
}
