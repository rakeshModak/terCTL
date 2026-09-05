use crate::ssh::{connect_host, SshConnection};
use crate::store::Store;
use russh::ChannelMsg;
use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use tauri::State;
use tokio::sync::Mutex as AsyncMutex;

struct ServerSpec {
    id: &'static str,
    label: &'static str,
    bin: &'static str,
    requires_all: &'static [&'static str],
    requires_any: &'static [&'static str],
    install: &'static str,
    uninstall: &'static str,
    approx_mb: u32,
}

const PKG_INSTALL_CLANGD: &str = r#"set -e
SUDO=""; [ "$(id -u)" -ne 0 ] && SUDO="sudo -n"
if command -v apt-get >/dev/null 2>&1; then $SUDO apt-get install -y clangd
elif command -v dnf >/dev/null 2>&1; then $SUDO dnf install -y clang-tools-extra
elif command -v pacman >/dev/null 2>&1; then $SUDO pacman -S --noconfirm clang
elif command -v zypper >/dev/null 2>&1; then $SUDO zypper -n install clang-tools
elif command -v apk >/dev/null 2>&1; then $SUDO apk add clang-extra-tools
else echo "no supported package manager" >&2; exit 1
fi"#;

const PKG_REMOVE_CLANGD: &str = r#"set -e
SUDO=""; [ "$(id -u)" -ne 0 ] && SUDO="sudo -n"
if command -v apt-get >/dev/null 2>&1; then $SUDO apt-get remove -y clangd
elif command -v dnf >/dev/null 2>&1; then $SUDO dnf remove -y clang-tools-extra
elif command -v pacman >/dev/null 2>&1; then $SUDO pacman -Rs --noconfirm clang
elif command -v zypper >/dev/null 2>&1; then $SUDO zypper -n remove clang-tools
elif command -v apk >/dev/null 2>&1; then $SUDO apk del clang-extra-tools
else echo "no supported package manager" >&2; exit 1
fi"#;

const INSTALL_JDTLS: &str = r#"set -e
mkdir -p "$HOME/.local/share/jdtls" "$HOME/.local/bin"
curl -fsSL https://download.eclipse.org/jdtls/snapshots/jdt-language-server-latest.tar.gz \
  | tar -xz -C "$HOME/.local/share/jdtls"
printf '#!/bin/sh\nexec "$HOME/.local/share/jdtls/bin/jdtls" "$@"\n' > "$HOME/.local/bin/jdtls"
chmod +x "$HOME/.local/bin/jdtls""#;

const SERVERS: &[ServerSpec] = &[
    ServerSpec {
        id: "typescript",
        label: "TypeScript / JavaScript",
        bin: "typescript-language-server",
        requires_all: &["npm"],
        requires_any: &[],
        install: "npm install -g typescript-language-server typescript",
        uninstall: "npm uninstall -g typescript-language-server typescript",
        approx_mb: 70,
    },
    ServerSpec {
        id: "python",
        label: "Python (Pyright)",
        bin: "pyright-langserver",
        requires_all: &["npm"],
        requires_any: &[],
        install: "npm install -g pyright",
        uninstall: "npm uninstall -g pyright",
        approx_mb: 60,
    },
    ServerSpec {
        id: "clangd",
        label: "C / C++ (clangd)",
        bin: "clangd",
        requires_all: &[],
        requires_any: &["apt-get", "dnf", "pacman", "zypper", "apk"],
        install: PKG_INSTALL_CLANGD,
        uninstall: PKG_REMOVE_CLANGD,
        approx_mb: 120,
    },
    ServerSpec {
        id: "java",
        label: "Java (Eclipse JDT)",
        bin: "jdtls",
        requires_all: &["curl", "tar", "java"],
        requires_any: &[],
        install: INSTALL_JDTLS,
        uninstall: r#"rm -rf "$HOME/.local/share/jdtls" "$HOME/.local/bin/jdtls""#,
        approx_mb: 250,
    },
    ServerSpec {
        id: "go",
        label: "Go (gopls)",
        bin: "gopls",
        requires_all: &["go"],
        requires_any: &[],
        install: "go install golang.org/x/tools/gopls@latest",
        uninstall: r#"rm -f "$(command -v gopls)""#,
        approx_mb: 40,
    },
    ServerSpec {
        id: "rust",
        label: "Rust (rust-analyzer)",
        bin: "rust-analyzer",
        requires_all: &["rustup"],
        requires_any: &[],
        install: "rustup component add rust-analyzer",
        uninstall: "rustup component remove rust-analyzer",
        approx_mb: 45,
    },
    ServerSpec {
        id: "bash",
        label: "Shell",
        bin: "bash-language-server",
        requires_all: &["npm"],
        requires_any: &[],
        install: "npm install -g bash-language-server",
        uninstall: "npm uninstall -g bash-language-server",
        approx_mb: 30,
    },
    ServerSpec {
        id: "yaml",
        label: "YAML",
        bin: "yaml-language-server",
        requires_all: &["npm"],
        requires_any: &[],
        install: "npm install -g yaml-language-server",
        uninstall: "npm uninstall -g yaml-language-server",
        approx_mb: 25,
    },
];

fn spec(id: &str) -> Result<&'static ServerSpec, String> {
    SERVERS
        .iter()
        .find(|s| s.id == id)
        .ok_or_else(|| format!("unknown language server: {id}"))
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerStatus {
    pub id: String,
    pub label: String,
    pub bin: String,
    pub install_command: String,
    pub uninstall_command: String,
    pub approx_mb: u32,
    pub installed: bool,
    pub can_install: bool,
    pub missing: Vec<String>,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HostServers {
    pub free_kb: u64,
    pub servers: Vec<ServerStatus>,
}

#[derive(Default)]
pub struct LangServerManager {
    conns: AsyncMutex<HashMap<String, Arc<SshConnection>>>,
}

impl LangServerManager {
    async fn get(&self, store: &Store, host_id: &str) -> Result<Arc<SshConnection>, String> {
        if let Some(h) = self.conns.lock().await.get(host_id) {
            return Ok(h.clone());
        }
        let handle = Arc::new(connect_host(store, host_id).await?);
        self.conns
            .lock()
            .await
            .insert(host_id.to_string(), handle.clone());
        Ok(handle)
    }

    pub async fn drop_host(&self, host_id: &str) {
        self.conns.lock().await.remove(host_id);
    }
}

struct Output {
    code: i32,
    stdout: String,
    stderr: String,
}

async fn run(
    store: &Store,
    manager: &LangServerManager,
    host_id: &str,
    command: &str,
) -> Result<Output, String> {
    let attempt = || async {
        let handle = manager.get(store, host_id).await?;
        let mut channel = handle
            .channel_open_session()
            .await
            .map_err(|e| e.to_string())?;
        channel
            .exec(true, command)
            .await
            .map_err(|e| e.to_string())?;

        let mut stdout = Vec::new();
        let mut stderr = Vec::new();
        let mut code = 0i32;
        while let Some(msg) = channel.wait().await {
            match msg {
                ChannelMsg::Data { data } => stdout.extend_from_slice(&data),
                ChannelMsg::ExtendedData { data, .. } => stderr.extend_from_slice(&data),
                ChannelMsg::ExitStatus { exit_status } => code = exit_status as i32,
                ChannelMsg::Eof | ChannelMsg::Close => break,
                _ => {}
            }
        }
        Ok::<Output, String>(Output {
            code,
            stdout: String::from_utf8_lossy(&stdout).into_owned(),
            stderr: String::from_utf8_lossy(&stderr).into_owned(),
        })
    };

    match attempt().await {
        Ok(o) => Ok(o),
        Err(e) => {
            manager.drop_host(host_id).await;
            Err(e)
        }
    }
}

fn failure(out: Output, what: &str) -> String {
    let detail = if out.stderr.trim().is_empty() {
        out.stdout
    } else {
        out.stderr
    };
    let tail: String = detail
        .lines()
        .filter(|l| !l.trim().is_empty())
        .rev()
        .take(3)
        .collect::<Vec<_>>()
        .join(" · ");
    if tail.trim().is_empty() {
        format!("{what} failed (exit {})", out.code)
    } else {
        format!("{what} failed: {}", tail.trim())
    }
}

#[tauri::command]
pub async fn lsp_list(
    store: State<'_, Store>,
    manager: State<'_, LangServerManager>,
    host_id: String,
) -> Result<HostServers, String> {
    let mut tools: Vec<&str> = Vec::new();
    let mut seen = HashSet::new();
    for s in SERVERS {
        for t in std::iter::once(s.bin)
            .chain(s.requires_all.iter().copied())
            .chain(s.requires_any.iter().copied())
        {
            if seen.insert(t) {
                tools.push(t);
            }
        }
    }

    let probe = format!(
        r#"LC_ALL=C
for t in {}; do
  if command -v "$t" >/dev/null 2>&1; then echo "$t 1"; else echo "$t 0"; fi
done
echo "__free $(df -Pk "$HOME" 2>/dev/null | awk 'NR==2{{print $4+0}}')"
"#,
        tools.join(" ")
    );

    let out = run(&store, &manager, &host_id, &probe).await?;
    if out.code != 0 {
        return Err(failure(out, "checking the host"));
    }

    let mut present: HashMap<&str, bool> = HashMap::new();
    let mut free_kb = 0u64;
    for line in out.stdout.lines() {
        let Some((name, value)) = line.trim().split_once(' ') else {
            continue;
        };
        if name == "__free" {
            free_kb = value.trim().parse().unwrap_or(0);
        } else if let Some(tool) = tools.iter().find(|t| **t == name) {
            present.insert(tool, value.trim() == "1");
        }
    }

    let has = |t: &str| present.get(t).copied().unwrap_or(false);

    let servers = SERVERS
        .iter()
        .map(|s| {
            let mut missing: Vec<String> = s
                .requires_all
                .iter()
                .filter(|t| !has(t))
                .map(|t| t.to_string())
                .collect();
            if !s.requires_any.is_empty() && !s.requires_any.iter().any(|t| has(t)) {
                missing.push(s.requires_any.join(" or "));
            }

            ServerStatus {
                id: s.id.to_string(),
                label: s.label.to_string(),
                bin: s.bin.to_string(),
                install_command: s.install.to_string(),
                uninstall_command: s.uninstall.to_string(),
                approx_mb: s.approx_mb,
                installed: has(s.bin),
                can_install: missing.is_empty(),
                missing,
            }
        })
        .collect();

    Ok(HostServers { free_kb, servers })
}

#[tauri::command]
pub async fn lsp_install(
    store: State<'_, Store>,
    manager: State<'_, LangServerManager>,
    host_id: String,
    server_id: String,
) -> Result<String, String> {
    let spec = spec(&server_id)?;
    let out = run(&store, &manager, &host_id, spec.install).await?;
    if out.code != 0 {
        return Err(failure(out, &format!("installing {}", spec.label)));
    }
    Ok(spec.label.to_string())
}

#[tauri::command]
pub async fn lsp_uninstall(
    store: State<'_, Store>,
    manager: State<'_, LangServerManager>,
    host_id: String,
    server_id: String,
) -> Result<String, String> {
    let spec = spec(&server_id)?;
    let out = run(&store, &manager, &host_id, spec.uninstall).await?;
    if out.code != 0 {
        return Err(failure(out, &format!("removing {}", spec.label)));
    }
    Ok(spec.label.to_string())
}

#[tauri::command]
pub async fn lsp_disconnect(
    manager: State<'_, LangServerManager>,
    host_id: String,
) -> Result<(), String> {
    manager.drop_host(&host_id).await;
    Ok(())
}
