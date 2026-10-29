use crate::metrics::MetricsManager;
use crate::store::Store;
use russh::ChannelMsg;
use std::collections::HashSet;
use std::time::Duration;
use tauri::State;

/// One direct child of the scanned folder.
#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiskEntry {
    pub name: String,
    pub size_kb: u64,
    pub is_dir: bool,
    /// Something inside could not be read, so `size_kb` is a lower bound.
    pub partial: bool,
}

/// One level of the disk map. The UI asks for a folder at a time, so a click
/// costs one `du` over that subtree rather than a scan of the whole disk.
#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiskListing {
    pub path: String,
    /// Everything under `path` on this filesystem, as `du` counted it.
    pub total_kb: u64,
    /// The filesystem `path` lives on, for the usage bar.
    pub disk_used_kb: u64,
    pub disk_total_kb: u64,
    pub entries: Vec<DiskEntry>,
}

/// Hard stop for one level. `du` over a big `/` can take a while; past this
/// the scan is more likely hurting the server than helping the user.
const SCAN_SECS: u64 = 60;

/// The probe, with `__PATH__` replaced by the single-quoted folder.
///
/// Every line it prints is tagged so the parser never guesses:
///   `E\t<code>`        the folder can't be scanned at all
///   `D\t<used>\t<total>` df for the folder's filesystem, in KiB
///   `T\t./<name>`      a direct child that is a directory
///   `<kb>\t./<name>`   du's own size line (`.` is the folder's total)
///   `du: …`            du's complaints, i.e. unreadable subtrees
///   `F\t<status>`      du's exit status, printed once it has stopped
///
/// GNU and BusyBox du can list files and folders in one pass with `-a -d 1`.
/// BSD/macOS du refuses `-a` with `-d`, so there each child is passed by name
/// with `-s`; the cheap `/dev/null` probe picks the form without walking
/// anything. `nice` and an idle `ionice` keep the walk out of the way of the
/// server's real work; `ionice` is test-run first because some kernels refuse
/// the idle class to unprivileged users, and a refusal would skip `du`
/// entirely. The remote `timeout` matters because closing our channel does
/// not reliably stop a command that has no PTY.
const SCRIPT: &str = r#"LC_ALL=C; export LC_ALL
p=__PATH__
[ -d "$p" ] || { printf 'E\tnodir\n'; exit 0; }
cd -- "$p" 2>/dev/null && [ -r . ] || { printf 'E\tnoaccess\n'; exit 0; }
df -Pk . 2>/dev/null | awk 'NR==2{printf "D\t%s\t%s\n",$3,$2}'
find . -mindepth 1 -maxdepth 1 -type d 2>/dev/null | sed 's/^/T	/'
run=''
command -v timeout >/dev/null 2>&1 && run="timeout __SECS__"
command -v nice >/dev/null 2>&1 && run="$run nice -n 19"
ionice -c3 true >/dev/null 2>&1 && run="$run ionice -c3"
if du -ak -d 0 /dev/null >/dev/null 2>&1; then
  $run du -xak -d 1 . 2>&1
else
  set --
  for f in ./* ./.[!.]* ./..?*; do
    { [ -e "$f" ] || [ -L "$f" ]; } && set -- "$@" "$f"
  done
  [ $# -gt 0 ] && $run du -xks -- "$@" 2>&1
fi
printf 'F\t%s\n' "$?"
"#;

/// Quote for POSIX sh: inside single quotes nothing is special except the
/// quote itself, which is closed, escaped, and reopened.
fn sh_quote(s: &str) -> String {
    format!("'{}'", s.replace('\'', r"'\''"))
}

fn script_for(path: &str) -> Result<String, String> {
    if !path.starts_with('/') {
        return Err("Path must be absolute".into());
    }
    // A newline would end the `p=` assignment early; NUL can't be passed at all.
    if path.contains(['\n', '\r', '\0']) {
        return Err("Path contains a line break".into());
    }
    Ok(SCRIPT
        .replace("__PATH__", &sh_quote(path))
        .replace("__SECS__", &SCAN_SECS.to_string()))
}

/// The top-level child a `du:` complaint is about, from the `./name/...` path
/// it quotes. GNU, BusyBox and BSD word the message differently but all
/// include the path, so only that part is relied on.
fn complained_child(line: &str) -> Option<String> {
    let at = line.find("./")?;
    let rest = &line[at + 2..];
    let end = rest.find(['/', '\'', ':']).unwrap_or(rest.len());
    let name = &rest[..end];
    (!name.is_empty()).then(|| name.to_string())
}

fn parse_listing(path: &str, raw: &str) -> Result<DiskListing, String> {
    let mut disk = (0, 0);
    let mut dirs = HashSet::new();
    let mut partial = HashSet::new();
    let mut sizes = Vec::new();
    let mut total = None;
    // Until du reports how it stopped, assume it was cut off.
    let mut timed_out = true;

    for line in raw.lines() {
        if let Some(status) = line.strip_prefix("F\t") {
            // 124 is `timeout` firing; 128+ is du killed by a signal. Anything
            // else, including 1 for unreadable folders, means it finished.
            let status = status.trim().parse::<u32>().unwrap_or(0);
            timed_out = status == 124 || status >= 128;
            continue;
        }
        if let Some(code) = line.strip_prefix("E\t") {
            return Err(match code {
                "nodir" => format!("{path} is not a folder on this server"),
                "noaccess" => format!("Permission denied reading {path}"),
                other => format!("Couldn't scan {path} ({other})"),
            });
        }
        if let Some(rest) = line.strip_prefix("D\t") {
            let mut it = rest.split('\t').map(|n| n.trim().parse::<u64>());
            if let (Some(Ok(used)), Some(Ok(size))) = (it.next(), it.next()) {
                disk = (used, size);
            }
        } else if let Some(name) = line.strip_prefix("T\t./") {
            dirs.insert(name.to_string());
        } else if line.starts_with("du:") {
            if let Some(child) = complained_child(line) {
                partial.insert(child);
            }
        } else if let Some((kb, name)) = line.split_once('\t') {
            let Ok(kb) = kb.trim().parse::<u64>() else { continue };
            if name == "." {
                // Only the `-a -d 1` form prints the folder's own total; the
                // BSD form falls back to summing the children below.
                total = Some(kb);
            } else if let Some(name) = name.strip_prefix("./") {
                sizes.push((name.to_string(), kb));
            }
        }
    }

    if timed_out && sizes.is_empty() {
        return Err(format!(
            "Scanning {path} took longer than {SCAN_SECS}s. Try a smaller folder."
        ));
    }

    let mut entries: Vec<DiskEntry> = sizes
        .into_iter()
        .map(|(name, size_kb)| DiskEntry {
            is_dir: dirs.contains(&name),
            // A cut-off walk leaves every size short, not just the unreadable ones.
            partial: timed_out || partial.contains(&name),
            name,
            size_kb,
        })
        .collect();
    entries.sort_by(|a, b| b.size_kb.cmp(&a.size_kb).then(a.name.cmp(&b.name)));

    Ok(DiskListing {
        path: path.to_string(),
        total_kb: total.unwrap_or_else(|| entries.iter().map(|e| e.size_kb).sum()),
        disk_used_kb: disk.0,
        disk_total_kb: disk.1,
        entries,
    })
}

/// Sizes of `path`'s direct children on the remote, biggest first. Rides on the
/// metrics connection, which is already open while the inspector is showing.
#[tauri::command]
pub async fn disk_usage(
    store: State<'_, Store>,
    metrics: State<'_, MetricsManager>,
    host_id: String,
    path: String,
) -> Result<DiskListing, String> {
    let script = script_for(&path)?;
    let run = || async {
        let handle = metrics.connection(&store, &host_id).await?;
        let mut channel = handle
            .channel_open_session()
            .await
            .map_err(|e| e.to_string())?;
        channel.exec(true, script.as_str()).await.map_err(|e| e.to_string())?;
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

    // A little past the remote `timeout`, so that normally fires first and we
    // still get the partial output; this only catches a wedged connection.
    let limit = Duration::from_secs(SCAN_SECS + 10);
    match tokio::time::timeout(limit, run()).await {
        Ok(Ok(raw)) => parse_listing(&path, &raw),
        Ok(Err(e)) => {
            // Drop a stale/broken connection so the next try reconnects.
            metrics.drop_host(&host_id).await;
            Err(e)
        }
        Err(_) => {
            metrics.drop_host(&host_id).await;
            Err(format!("Scanning {path} timed out"))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn listing(raw: &str) -> DiskListing {
        parse_listing("/var", raw).expect("should parse")
    }

    #[test]
    fn parses_a_full_scan_biggest_first() {
        let raw = "D\t4000\t10000\n\
T\t./log\n\
T\t./lib\n\
120\t./cache.db\n\
900\t./log\n\
2500\t./lib\n\
3520\t.\n\
F\t0\n";
        let l = listing(raw);
        assert_eq!(l.total_kb, 3520);
        assert_eq!((l.disk_used_kb, l.disk_total_kb), (4000, 10000));
        let names: Vec<_> = l.entries.iter().map(|e| e.name.as_str()).collect();
        assert_eq!(names, ["lib", "log", "cache.db"]);
        assert!(l.entries[0].is_dir && l.entries[1].is_dir);
        assert!(!l.entries[2].is_dir);
        assert!(l.entries.iter().all(|e| !e.partial));
    }

    #[test]
    fn keeps_names_with_spaces_tabs_and_quotes() {
        let raw = "T\t./my dir\n10\t./my dir\n5\t./it's\there\n15\t.\nF\t0\n";
        let l = listing(raw);
        assert_eq!(l.entries[0].name, "my dir");
        assert!(l.entries[0].is_dir);
        assert_eq!(l.entries[1].name, "it's\there");
    }

    #[test]
    fn marks_unreadable_children_as_partial_whatever_du_says() {
        // GNU, BusyBox and BSD wording, each about a different child.
        let raw = "T\t./a\nT\t./b\nT\t./c\n\
du: cannot read directory './a/secret': Permission denied\n\
du: can't open './b': Permission denied\n\
du: ./c/x: Permission denied\n\
4\t./a\n4\t./b\n4\t./c\n4\t./d\n16\t.\nF\t1\n";
        let l = listing(raw);
        let partial: Vec<_> = l
            .entries
            .iter()
            .filter(|e| e.partial)
            .map(|e| e.name.as_str())
            .collect();
        assert_eq!(partial, ["a", "b", "c"]);
    }

    #[test]
    fn a_cut_off_walk_marks_everything_partial() {
        // `timeout` stopped du part-way, and a dropped channel that never
        // got as far as the status line counts the same.
        for raw in ["T\t./a\n40\t./a\n7\t./b\nF\t124\n", "T\t./a\n40\t./a\n7\t./b\n"] {
            let l = listing(raw);
            assert!(l.entries.iter().all(|e| e.partial));
            assert_eq!(l.total_kb, 47);
        }
    }

    #[test]
    fn a_walk_that_never_got_going_is_an_error() {
        assert!(parse_listing("/", "D\t1\t2\n").unwrap_err().contains("longer than"));
    }

    #[test]
    fn an_empty_folder_is_not_an_error() {
        // GNU prints a zero total; the BSD form runs no du and reports the
        // status of the skipped `[ $# -gt 0 ]` test instead.
        for raw in ["D\t1\t2\n0\t.\nF\t0\n", "D\t1\t2\nF\t1\n"] {
            let l = listing(raw);
            assert!(l.entries.is_empty());
            assert_eq!(l.total_kb, 0);
        }
    }

    #[test]
    fn reports_missing_and_unreadable_folders() {
        assert!(parse_listing("/nope", "E\tnodir\n").unwrap_err().contains("not a folder"));
        assert!(parse_listing("/root", "E\tnoaccess\n").unwrap_err().contains("Permission denied"));
    }

    #[test]
    fn sums_the_children_when_du_prints_no_total() {
        // The BSD/macOS form: one `-s` line per child, no `.` line.
        let l = listing("T\t./a\n30\t./a\n12\t./.hidden\nF\t0\n");
        assert_eq!(l.total_kb, 42);
        assert!(l.entries.iter().all(|e| !e.partial));
        assert_eq!(l.entries[1].name, ".hidden");
    }

    #[test]
    fn ignores_noise_lines() {
        let l = listing("garbage\n\nabc\t./x\n3\t./ok\n3\t.\nF\t0\n");
        assert_eq!(l.entries.len(), 1);
        assert_eq!(l.entries[0].name, "ok");
    }

    #[test]
    fn quoting_keeps_a_hostile_path_inert() {
        let s = script_for("/tmp/x'; rm -rf / #").unwrap();
        assert!(s.contains(r"p='/tmp/x'\''; rm -rf / #'"));
        assert!(!s.contains("__PATH__") && !s.contains("__SECS__"));
    }

    #[test]
    fn rejects_relative_and_multiline_paths() {
        assert!(script_for("var/log").is_err());
        assert!(script_for("/var\nreboot").is_err());
        assert!(script_for("/var\0").is_err());
    }
}
