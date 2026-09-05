use crate::session::{SessionCommand, SessionManager, TermClosed, TermOutput};
use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use std::io::{Read, Write};
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::sync::mpsc;
use uuid::Uuid;

#[cfg(windows)]
fn shell_candidates() -> Vec<String> {
    // COMSPEC almost always points at cmd.exe, so using it as the default made
    // Windows behave differently from the intended PowerShell-first experience.
    // Keep it as the fallback because it is the system's authoritative cmd path.
    let mut candidates = vec!["powershell.exe".to_string()];
    if let Ok(comspec) = std::env::var("COMSPEC") {
        if !comspec.is_empty() {
            candidates.push(comspec);
        }
    }
    candidates.push("cmd.exe".to_string());
    candidates.dedup();
    candidates
}

#[cfg(not(windows))]
fn shell_candidates() -> Vec<String> {
    vec![std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string())]
}

fn shell_command(shell: String) -> CommandBuilder {
    let mut cmd = CommandBuilder::new(shell);
    #[cfg(windows)]
    // A profile can run arbitrary startup work (including prompts), which
    // blocks a non-visible ConPTY before the terminal has a chance to render.
    cmd.args(["-NoLogo", "-NoProfile"]);
    cmd.env("TERM", "xterm-256color");
    if let Ok(home) = std::env::var("HOME") {
        cmd.cwd(home);
    }
    cmd
}

/// Opens a local system shell in a PTY and streams it through the same
/// terminal plumbing (SessionManager + term:// events) that SSH sessions use,
/// so the frontend Terminal component works unchanged.
#[tauri::command]
pub async fn local_connect(
    app: AppHandle,
    manager: State<'_, SessionManager>,
) -> Result<String, String> {
    let pty = native_pty_system();
    let pair = pty
        .openpty(PtySize {
            rows: 24,
            cols: 80,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| e.to_string())?;

    let mut launch_errors = Vec::new();
    let child = shell_candidates()
        .into_iter()
        .find_map(
            |shell| match pair.slave.spawn_command(shell_command(shell.clone())) {
                Ok(child) => Some(child),
                Err(error) => {
                    launch_errors.push(format!("{shell}: {error}"));
                    None
                }
            },
        )
        .ok_or_else(|| {
            format!(
                "Unable to start a local shell. {}",
                launch_errors.join("; ")
            )
        })?;
    drop(pair.slave);

    let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
    let mut writer = pair.master.take_writer().map_err(|e| e.to_string())?;
    let master = pair.master;

    let session_id = Uuid::new_v4().to_string();
    let (cmd_tx, mut cmd_rx) = mpsc::unbounded_channel::<SessionCommand>();
    manager.register(session_id.clone(), cmd_tx);

    // Reader thread: stream PTY output to the frontend until the shell exits.
    let out_app = app.clone();
    let out_id = session_id.clone();
    std::thread::spawn(move || {
        let mut buf = [0u8; 4096];
        loop {
            match reader.read(&mut buf) {
                Ok(0) | Err(_) => break,
                Ok(n) => {
                    let _ = out_app.emit(
                        "term://output",
                        TermOutput {
                            session_id: out_id.clone(),
                            data: buf[..n].to_vec(),
                        },
                    );
                }
            }
        }
        out_app.state::<SessionManager>().remove(&out_id);
        let _ = out_app.emit(
            "term://closed",
            TermClosed {
                session_id: out_id,
                error: None,
            },
        );
    });

    // Command task: input / resize / close.
    tauri::async_runtime::spawn(async move {
        let mut child = child;
        while let Some(cmd) = cmd_rx.recv().await {
            match cmd {
                SessionCommand::Input(bytes) => {
                    let _ = writer.write_all(&bytes);
                    let _ = writer.flush();
                }
                SessionCommand::Resize { cols, rows } => {
                    let _ = master.resize(PtySize {
                        rows: rows as u16,
                        cols: cols as u16,
                        pixel_width: 0,
                        pixel_height: 0,
                    });
                }
                SessionCommand::Close => {
                    let _ = child.kill();
                    break;
                }
            }
        }
    });

    Ok(session_id)
}
