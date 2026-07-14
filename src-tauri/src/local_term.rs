use crate::session::{SessionCommand, SessionManager, TermClosed, TermOutput};
use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use std::io::{Read, Write};
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::sync::mpsc;
use uuid::Uuid;

#[cfg(windows)]
fn default_shell() -> String {
    std::env::var("COMSPEC").unwrap_or_else(|_| "powershell.exe".to_string())
}
#[cfg(not(windows))]
fn default_shell() -> String {
    std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string())
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

    let mut cmd = CommandBuilder::new(default_shell());
    cmd.env("TERM", "xterm-256color");
    if let Ok(home) = std::env::var("HOME") {
        cmd.cwd(home);
    }

    let child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;
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
