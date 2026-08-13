use crate::ssh::ClientHandler;
use russh::client::Handle;
use russh::ChannelMsg;
use std::time::Duration;

/// One command, run once per host — the first time it connects.
///
/// `uname` covers every unix, and `/etc/os-release` narrows Linux down to a
/// distribution. Windows is inferred from the failure instead: there is no
/// single command that runs on cmd, PowerShell and sh alike, and the shell's
/// own "not recognized" complaint is a reliable enough tell.
const PROBE: &str = "uname -sr; cat /etc/os-release 2>/dev/null";

/// A probe that hasn't answered by now is not going to. It runs before the
/// shell opens, so this is time the user spends waiting to connect.
const PROBE_TIMEOUT: Duration = Duration::from_secs(5);

/// Generous for an `os-release`; past this we are reading something else.
const MAX_OUTPUT: usize = 8 * 1024;

/// Identify the remote operating system. `None` when it could not be told,
/// which leaves the host unmarked and retried on the next connect.
pub async fn detect_os(handle: &Handle<ClientHandler>) -> Option<String> {
    let output = tokio::time::timeout(PROBE_TIMEOUT, run_probe(handle))
        .await
        .ok()??;
    parse_os(&output).map(str::to_string)
}

async fn run_probe(handle: &Handle<ClientHandler>) -> Option<String> {
    let mut channel = handle.channel_open_session().await.ok()?;
    channel.exec(true, PROBE).await.ok()?;

    let mut out: Vec<u8> = Vec::new();
    while let Some(msg) = channel.wait().await {
        match msg {
            // stderr matters as much as stdout here: on Windows the error text
            // is the only signal we get.
            ChannelMsg::Data { data } | ChannelMsg::ExtendedData { data, .. } => {
                let room = MAX_OUTPUT.saturating_sub(out.len());
                if room > 0 {
                    out.extend_from_slice(&data[..data.len().min(room)]);
                }
            }
            ChannelMsg::Eof | ChannelMsg::Close => break,
            _ => {}
        }
    }
    Some(String::from_utf8_lossy(&out).into_owned())
}

/// Normalised identifier for the probe output, or `None` if unrecognisable.
///
/// Kept separate from the I/O so the interesting half can be tested without a
/// server.
fn parse_os(output: &str) -> Option<&'static str> {
    // os-release first: it names the distribution, where uname only ever says
    // "Linux".
    if let Some(id) = os_release_id(output) {
        return Some(distro_id(&id));
    }
    if let Some(line) = output.lines().map(str::trim).find(|l| !l.is_empty()) {
        if let Some(os) = kernel_id(line) {
            return Some(os);
        }
    }
    if looks_like_windows(output) {
        return Some("windows");
    }
    None
}

/// Pull `ID=` out of an `/etc/os-release` block, unquoted and lowercased.
fn os_release_id(output: &str) -> Option<String> {
    output
        .lines()
        .map(str::trim)
        .find_map(|line| line.strip_prefix("ID="))
        .map(|value| value.trim_matches(['"', '\'']).to_lowercase())
        .filter(|value| !value.is_empty())
}

/// Distributions that get their own icon; everything else with an os-release is
/// still Linux, so it falls back to the generic mark rather than going unknown.
fn distro_id(id: &str) -> &'static str {
    match id {
        "ubuntu" => "ubuntu",
        "debian" => "debian",
        "raspbian" => "raspbian",
        "fedora" => "fedora",
        "centos" => "centos",
        "rhel" | "redhat" | "redhatenterpriseserver" => "rhel",
        "rocky" => "rocky",
        "almalinux" | "alma" => "almalinux",
        "arch" | "archarm" | "manjaro" => "arch",
        "alpine" => "alpine",
        "kali" => "kali",
        other if other.starts_with("opensuse") || other == "sles" || other == "suse" => "suse",
        _ => "linux",
    }
}

/// First field of `uname -sr`.
fn kernel_id(line: &str) -> Option<&'static str> {
    let kernel = line.split_whitespace().next()?;
    Some(match kernel {
        "Darwin" => "macos",
        "Linux" => "linux",
        "FreeBSD" => "freebsd",
        "OpenBSD" => "openbsd",
        "NetBSD" => "netbsd",
        "SunOS" => "solaris",
        // Unix-alikes hosted on Windows still mean a Windows box.
        k if k.starts_with("CYGWIN") || k.starts_with("MINGW") || k.starts_with("MSYS") => "windows",
        _ => return None,
    })
}

fn looks_like_windows(output: &str) -> bool {
    let lower = output.to_lowercase();
    // cmd.exe: "'uname' is not recognized as an internal or external command"
    // PowerShell: "The term 'uname' is not recognized as the name of a cmdlet"
    lower.contains("not recognized")
        || lower.contains("windows_nt")
        || lower.contains("microsoft windows")
}

#[cfg(test)]
mod tests {
    use super::parse_os;

    #[test]
    fn reads_the_distribution_rather_than_the_kernel() {
        let out = "Linux 5.15.0-91-generic\n\
                   PRETTY_NAME=\"Ubuntu 22.04.3 LTS\"\n\
                   NAME=\"Ubuntu\"\n\
                   ID=ubuntu\n\
                   ID_LIKE=debian\n";
        assert_eq!(parse_os(out), Some("ubuntu"));
    }

    #[test]
    fn unquoted_and_quoted_ids_both_work() {
        assert_eq!(parse_os("Linux 6.1.0\nID=debian\n"), Some("debian"));
        assert_eq!(parse_os("Linux 6.1.0\nID=\"alpine\"\n"), Some("alpine"));
    }

    #[test]
    fn opensuse_variants_collapse_to_one_id() {
        assert_eq!(parse_os("Linux 6.4\nID=\"opensuse-leap\"\n"), Some("suse"));
        assert_eq!(parse_os("Linux 6.4\nID=opensuse-tumbleweed\n"), Some("suse"));
    }

    #[test]
    fn an_unknown_distribution_is_still_linux() {
        assert_eq!(parse_os("Linux 6.1.0\nID=linuxmint\n"), Some("linux"));
    }

    #[test]
    fn linux_without_os_release_falls_back_to_the_kernel() {
        assert_eq!(parse_os("Linux 4.19.0\n"), Some("linux"));
    }

    #[test]
    fn macos_and_the_bsds_come_from_uname() {
        assert_eq!(parse_os("Darwin 23.1.0\n"), Some("macos"));
        assert_eq!(parse_os("FreeBSD 14.0-RELEASE\n"), Some("freebsd"));
        assert_eq!(parse_os("OpenBSD 7.4\n"), Some("openbsd"));
    }

    #[test]
    fn windows_is_inferred_from_the_shell_complaining() {
        let cmd = "'uname' is not recognized as an internal or external command,\r\n\
                   operable program or batch file.\r\n";
        assert_eq!(parse_os(cmd), Some("windows"));

        let powershell = "The term 'uname' is not recognized as the name of a cmdlet, \
                          function, script file, or operable program.";
        assert_eq!(parse_os(powershell), Some("windows"));
    }

    #[test]
    fn git_bash_style_kernels_report_windows() {
        assert_eq!(parse_os("MINGW64_NT-10.0-19045 3.4.10\n"), Some("windows"));
    }

    #[test]
    fn nothing_recognisable_stays_unknown() {
        assert_eq!(parse_os(""), None);
        assert_eq!(parse_os("banner text from a locked-down shell\n"), None);
    }
}
