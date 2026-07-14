use std::collections::HashMap;
use std::sync::Mutex as StdMutex;
use tauri::State;
use tokio::sync::mpsc::UnboundedSender;

/// Commands routed from the frontend to a running terminal session's task,
/// regardless of whether that session is an SSH channel or a local PTY.
pub enum SessionCommand {
    Input(Vec<u8>),
    Resize { cols: u32, rows: u32 },
    Close,
}

#[derive(Clone, serde::Serialize)]
pub struct TermOutput {
    #[serde(rename = "sessionId")]
    pub session_id: String,
    pub data: Vec<u8>,
}

#[derive(Clone, serde::Serialize)]
pub struct TermClosed {
    #[serde(rename = "sessionId")]
    pub session_id: String,
    pub error: Option<String>,
}

/// Tracks live terminal sessions (SSH or local) by id so input/resize/close
/// commands can be routed to the right background task.
#[derive(Default)]
pub struct SessionManager {
    sessions: StdMutex<HashMap<String, UnboundedSender<SessionCommand>>>,
}

impl SessionManager {
    pub fn register(&self, session_id: String, tx: UnboundedSender<SessionCommand>) {
        self.sessions.lock().unwrap().insert(session_id, tx);
    }

    pub fn sender(&self, session_id: &str) -> Option<UnboundedSender<SessionCommand>> {
        self.sessions.lock().unwrap().get(session_id).cloned()
    }

    pub fn remove(&self, session_id: &str) {
        self.sessions.lock().unwrap().remove(session_id);
    }
}

#[tauri::command]
pub fn term_send_input(
    manager: State<SessionManager>,
    session_id: String,
    data: Vec<u8>,
) -> Result<(), String> {
    manager
        .sender(&session_id)
        .ok_or_else(|| "session not found".to_string())?
        .send(SessionCommand::Input(data))
        .map_err(|_| "session already closed".to_string())
}

#[tauri::command]
pub fn term_resize(
    manager: State<SessionManager>,
    session_id: String,
    cols: u32,
    rows: u32,
) -> Result<(), String> {
    manager
        .sender(&session_id)
        .ok_or_else(|| "session not found".to_string())?
        .send(SessionCommand::Resize { cols, rows })
        .map_err(|_| "session already closed".to_string())
}

#[tauri::command]
pub fn term_disconnect(manager: State<SessionManager>, session_id: String) -> Result<(), String> {
    if let Some(tx) = manager.sender(&session_id) {
        let _ = tx.send(SessionCommand::Close);
    }
    Ok(())
}
