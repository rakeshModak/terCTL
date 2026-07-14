use crate::ssh::{connect_host, ClientHandler};
use crate::store::Store;
use russh::client::Handle;
use russh_sftp::client::SftpSession;
use std::collections::HashMap;
use std::path::Path;
use tauri::State;
use tokio::sync::Mutex as AsyncMutex;

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub is_link: bool,
    pub size: u64,
    pub modified: Option<u64>, // unix seconds
}

/// One live SFTP connection per host, kept open for the browsing session so we
/// don't re-authenticate on every list/transfer. The SSH handle is held to
/// keep the underlying connection alive.
struct SftpConn {
    _handle: Handle<ClientHandler>,
    sftp: SftpSession,
}

#[derive(Default)]
pub struct SftpManager {
    conns: AsyncMutex<HashMap<String, std::sync::Arc<SftpConn>>>,
}

impl SftpManager {
    async fn get(&self, store: &Store, host_id: &str) -> Result<std::sync::Arc<SftpConn>, String> {
        {
            let conns = self.conns.lock().await;
            if let Some(c) = conns.get(host_id) {
                return Ok(c.clone());
            }
        }
        let handle = connect_host(store, host_id).await?;
        let channel = handle
            .channel_open_session()
            .await
            .map_err(|e| e.to_string())?;
        channel
            .request_subsystem(true, "sftp")
            .await
            .map_err(|e| e.to_string())?;
        let sftp = SftpSession::new(channel.into_stream())
            .await
            .map_err(|e| e.to_string())?;
        let conn = std::sync::Arc::new(SftpConn {
            _handle: handle,
            sftp,
        });
        self.conns
            .lock()
            .await
            .insert(host_id.to_string(), conn.clone());
        Ok(conn)
    }

    pub async fn drop_host(&self, host_id: &str) {
        self.conns.lock().await.remove(host_id);
    }
}

fn join_remote(dir: &str, name: &str) -> String {
    if dir.ends_with('/') {
        format!("{dir}{name}")
    } else {
        format!("{dir}/{name}")
    }
}

#[tauri::command]
pub async fn sftp_home(
    store: State<'_, Store>,
    sftp: State<'_, SftpManager>,
    host_id: String,
) -> Result<String, String> {
    let conn = sftp.get(&store, &host_id).await?;
    conn.sftp.canonicalize(".").await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn sftp_list(
    store: State<'_, Store>,
    sftp: State<'_, SftpManager>,
    host_id: String,
    path: String,
) -> Result<Vec<FileEntry>, String> {
    let conn = sftp.get(&store, &host_id).await?;
    let read = conn.sftp.read_dir(&path).await.map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for entry in read {
        let name = entry.file_name();
        if name == "." || name == ".." {
            continue;
        }
        let meta = entry.metadata();
        out.push(FileEntry {
            path: join_remote(&path, &name),
            is_dir: meta.is_dir(),
            is_link: meta.is_symlink(),
            size: meta.size.unwrap_or(0),
            modified: meta.mtime.map(|t| t as u64),
            name,
        });
    }
    sort_entries(&mut out);
    Ok(out)
}

#[tauri::command]
pub async fn sftp_download(
    store: State<'_, Store>,
    sftp: State<'_, SftpManager>,
    host_id: String,
    remote_path: String,
    local_path: String,
) -> Result<(), String> {
    let conn = sftp.get(&store, &host_id).await?;
    let mut remote = conn.sftp.open(&remote_path).await.map_err(|e| e.to_string())?;
    let mut local = tokio::fs::File::create(&local_path)
        .await
        .map_err(|e| e.to_string())?;
    tokio::io::copy(&mut remote, &mut local)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn sftp_upload(
    store: State<'_, Store>,
    sftp: State<'_, SftpManager>,
    host_id: String,
    local_path: String,
    remote_path: String,
) -> Result<(), String> {
    let conn = sftp.get(&store, &host_id).await?;
    let mut local = tokio::fs::File::open(&local_path)
        .await
        .map_err(|e| e.to_string())?;
    let mut remote = conn.sftp.create(&remote_path).await.map_err(|e| e.to_string())?;
    tokio::io::copy(&mut local, &mut remote)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn sftp_mkdir(
    store: State<'_, Store>,
    sftp: State<'_, SftpManager>,
    host_id: String,
    path: String,
) -> Result<(), String> {
    let conn = sftp.get(&store, &host_id).await?;
    conn.sftp.create_dir(&path).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn sftp_rename(
    store: State<'_, Store>,
    sftp: State<'_, SftpManager>,
    host_id: String,
    from: String,
    to: String,
) -> Result<(), String> {
    let conn = sftp.get(&store, &host_id).await?;
    conn.sftp.rename(&from, &to).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn sftp_disconnect(sftp: State<'_, SftpManager>, host_id: String) -> Result<(), String> {
    sftp.drop_host(&host_id).await;
    Ok(())
}

// ----- local filesystem (this machine) -----

#[tauri::command]
pub fn local_home() -> Result<String, String> {
    std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map_err(|_| "could not resolve home directory".to_string())
}

#[tauri::command]
pub fn local_list(path: String) -> Result<Vec<FileEntry>, String> {
    let dir = Path::new(&path);
    let mut out = Vec::new();
    for entry in std::fs::read_dir(dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let name = entry.file_name().to_string_lossy().to_string();
        let ft = entry.file_type().map_err(|e| e.to_string())?;
        let meta = entry.metadata().ok();
        out.push(FileEntry {
            path: entry.path().to_string_lossy().to_string(),
            is_dir: ft.is_dir(),
            is_link: ft.is_symlink(),
            size: meta.as_ref().map(|m| m.len()).unwrap_or(0),
            modified: meta
                .and_then(|m| m.modified().ok())
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| d.as_secs()),
            name,
        });
    }
    sort_entries(&mut out);
    Ok(out)
}

#[tauri::command]
pub fn local_mkdir(path: String) -> Result<(), String> {
    std::fs::create_dir(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn local_rename(from: String, to: String) -> Result<(), String> {
    std::fs::rename(&from, &to).map_err(|e| e.to_string())
}

fn sort_entries(entries: &mut [FileEntry]) {
    entries.sort_by(|a, b| {
        b.is_dir
            .cmp(&a.is_dir)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });
}
