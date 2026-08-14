use crate::ssh::{connect_host, SshConnection};
use crate::store::Store;
use russh_sftp::client::error::Error as SftpError;
use russh_sftp::client::rawsession::Limits;
use russh_sftp::client::{Config as SftpConfig, RawSftpSession};
use russh_sftp::extensions;
use russh_sftp::protocol::{FileAttributes, OpenFlags, StatusCode};
use std::collections::{HashMap, VecDeque};
use std::future::Future;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex as StdMutex};
use std::time::{Duration, Instant};
use tauri::async_runtime::JoinHandle;
use tauri::{AppHandle, Emitter, State};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
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

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TransferResult {
    pub bytes: u64,
    pub cancelled: bool,
}

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct TransferProgress {
    id: String,
    transferred: u64,
    total: u64,
    bytes_per_sec: f64,
}

const TARGET_IN_FLIGHT: usize = 8 * 1024 * 1024;
const MAX_IN_FLIGHT: usize = 64;
const FALLBACK_CHUNK: usize = 32 * 1024;
const MAX_PACKET_LEN: u32 = 256 * 1024;
const READ_OVERHEAD: usize = 9;
const WRITE_OVERHEAD: usize = 21;
const REQUEST_TIMEOUT_SECS: u64 = 60;
const PROGRESS_INTERVAL: Duration = Duration::from_millis(120);

struct OpError {
    message: String,
    fatal: bool,
}

impl OpError {
    fn local(e: impl std::fmt::Display) -> Self {
        Self {
            message: e.to_string(),
            fatal: false,
        }
    }
}

impl From<SftpError> for OpError {
    fn from(e: SftpError) -> Self {
        Self {
            fatal: !matches!(e, SftpError::Status(_) | SftpError::Limited(_)),
            message: e.to_string(),
        }
    }
}

struct SftpConn {
    _handle: SshConnection,
    sftp: Arc<RawSftpSession>,
    max_read: usize,
    max_write: usize,
    max_packet: usize,
}

impl SftpConn {
    fn write_chunk(&self, handle: &str) -> usize {
        self.max_write
            .min(self.max_packet.saturating_sub(WRITE_OVERHEAD + handle.len()))
            .max(FALLBACK_CHUNK.min(self.max_write))
    }
}

fn pipeline_depth(chunk: usize) -> usize {
    (TARGET_IN_FLIGHT / chunk.max(1)).clamp(4, MAX_IN_FLIGHT)
}

#[derive(Default)]
pub struct SftpManager {
    conns: AsyncMutex<HashMap<String, Arc<SftpConn>>>,
    cancels: StdMutex<HashMap<String, Arc<AtomicBool>>>,
}

impl SftpManager {
    async fn get(&self, store: &Store, host_id: &str) -> Result<Arc<SftpConn>, String> {
        {
            let conns = self.conns.lock().await;
            if let Some(c) = conns.get(host_id) {
                return Ok(c.clone());
            }
        }
        let conn = Arc::new(open_conn(store, host_id).await?);
        self.conns
            .lock()
            .await
            .insert(host_id.to_string(), conn.clone());
        Ok(conn)
    }

    pub async fn drop_host(&self, host_id: &str) {
        self.conns.lock().await.remove(host_id);
    }

    async fn with_conn<T, F, Fut>(&self, store: &Store, host_id: &str, op: F) -> Result<T, String>
    where
        F: FnOnce(Arc<SftpConn>) -> Fut,
        Fut: Future<Output = Result<T, OpError>>,
    {
        let conn = self.get(store, host_id).await?;
        match op(conn).await {
            Ok(v) => Ok(v),
            Err(e) => {
                if e.fatal {
                    self.drop_host(host_id).await;
                }
                Err(e.message)
            }
        }
    }

    fn register_transfer(&self, transfer_id: &str) -> Arc<AtomicBool> {
        let flag = Arc::new(AtomicBool::new(false));
        self.cancels
            .lock()
            .unwrap()
            .insert(transfer_id.to_string(), flag.clone());
        flag
    }

    fn finish_transfer(&self, transfer_id: &str) {
        self.cancels.lock().unwrap().remove(transfer_id);
    }
}

async fn open_conn(store: &Store, host_id: &str) -> Result<SftpConn, String> {
    let handle = connect_host(store, host_id).await?;
    let channel = handle
        .channel_open_session()
        .await
        .map_err(|e| e.to_string())?;
    channel
        .request_subsystem(true, "sftp")
        .await
        .map_err(|e| e.to_string())?;

    let mut session = RawSftpSession::new_with_config(
        channel.into_stream(),
        SftpConfig {
            max_packet_len: MAX_PACKET_LEN,
            max_concurrent_writes: 1,
            request_timeout_secs: REQUEST_TIMEOUT_SECS,
        },
    );

    let version = session.init().await.map_err(|e| e.to_string())?;

    let mut max_packet = MAX_PACKET_LEN as usize;
    let mut max_read = FALLBACK_CHUNK;
    let mut max_write = FALLBACK_CHUNK;

    if version
        .extensions
        .get(extensions::LIMITS)
        .is_some_and(|v| v == "1")
    {
        if let Ok(reported) = session.limits().await {
            let limits = Limits::from(reported);
            session.set_limits(limits);
            if let Some(p) = limits.packet_len {
                max_packet = max_packet.min(p as usize);
            }
            if let Some(r) = limits.read_len {
                max_read = r as usize;
            }
            if let Some(w) = limits.write_len {
                max_write = w as usize;
            }
        }
    }

    max_read = max_read.min(max_packet.saturating_sub(READ_OVERHEAD));
    max_write = max_write.min(max_packet.saturating_sub(WRITE_OVERHEAD + 64));

    Ok(SftpConn {
        _handle: handle,
        sftp: Arc::new(session),
        max_read,
        max_write,
        max_packet,
    })
}

struct Progress {
    app: AppHandle,
    id: String,
    total: u64,
    done: u64,
    last_emit: Instant,
    last_done: u64,
    rate: f64,
}

impl Progress {
    fn new(app: AppHandle, id: String, total: u64) -> Self {
        let p = Self {
            app,
            id,
            total,
            done: 0,
            last_emit: Instant::now(),
            last_done: 0,
            rate: 0.0,
        };
        p.send();
        p
    }

    fn advance(&mut self, bytes: u64) {
        self.done += bytes;
        if self.last_emit.elapsed() >= PROGRESS_INTERVAL {
            self.emit();
        }
    }

    fn emit(&mut self) {
        let elapsed = self.last_emit.elapsed().as_secs_f64();
        if elapsed > 0.0 {
            let instant = (self.done - self.last_done) as f64 / elapsed;
            self.rate = if self.rate == 0.0 {
                instant
            } else {
                self.rate * 0.6 + instant * 0.4
            };
        }
        self.last_emit = Instant::now();
        self.last_done = self.done;
        self.send();
    }

    fn send(&self) {
        let _ = self.app.emit(
            "transfer://progress",
            TransferProgress {
                id: self.id.clone(),
                transferred: self.done,
                total: self.total,
                bytes_per_sec: self.rate,
            },
        );
    }
}

fn join_remote(dir: &str, name: &str) -> String {
    if dir.ends_with('/') {
        format!("{dir}{name}")
    } else {
        format!("{dir}/{name}")
    }
}

async fn read_dir_raw(
    sftp: &RawSftpSession,
    path: &str,
) -> Result<Vec<(String, FileAttributes)>, OpError> {
    let handle = sftp.opendir(path).await?.handle;
    let mut out = Vec::new();
    let result = loop {
        match sftp.readdir(handle.as_str()).await {
            Ok(name) => out.extend(
                name.files
                    .into_iter()
                    .filter(|f| f.filename != "." && f.filename != "..")
                    .map(|f| (f.filename, f.attrs)),
            ),
            Err(SftpError::Status(s)) if s.status_code == StatusCode::Eof => break Ok(out),
            Err(e) => break Err(e.into()),
        }
    };
    if !failed_fatally(&result) {
        let _ = sftp.close(handle).await;
    }
    result
}

fn failed_fatally<T>(result: &Result<T, OpError>) -> bool {
    result.as_ref().err().is_some_and(|e| e.fatal)
}

#[tauri::command]
pub async fn sftp_home(
    store: State<'_, Store>,
    sftp: State<'_, SftpManager>,
    host_id: String,
) -> Result<String, String> {
    sftp.with_conn(&store, &host_id, move |conn| async move {
        let name = conn.sftp.realpath(".").await?;
        match name.files.first() {
            Some(f) => Ok(f.filename.clone()),
            None => Err(OpError::local("server returned no path for the home folder")),
        }
    })
    .await
}

#[tauri::command]
pub async fn sftp_list(
    store: State<'_, Store>,
    sftp: State<'_, SftpManager>,
    host_id: String,
    path: String,
) -> Result<Vec<FileEntry>, String> {
    sftp.with_conn(&store, &host_id, move |conn| async move {
        let entries = read_dir_raw(&conn.sftp, &path).await?;
        let mut out: Vec<FileEntry> = entries
            .into_iter()
            .map(|(name, attrs)| FileEntry {
                path: join_remote(&path, &name),
                is_dir: attrs.is_dir(),
                is_link: attrs.is_symlink(),
                size: attrs.size.unwrap_or(0),
                modified: attrs.mtime.map(|t| t as u64),
                name,
            })
            .collect();
        sort_entries(&mut out);
        Ok(out)
    })
    .await
}

async fn read_chunk(
    sftp: &RawSftpSession,
    handle: &str,
    offset: u64,
    len: usize,
) -> Result<Vec<u8>, OpError> {
    let mut buf = Vec::with_capacity(len);
    while buf.len() < len {
        let want = (len - buf.len()) as u32;
        match sftp.read(handle, offset + buf.len() as u64, want).await {
            Ok(data) if data.data.is_empty() => break,
            Ok(data) => buf.extend_from_slice(&data.data),
            Err(SftpError::Status(s)) if s.status_code == StatusCode::Eof => break,
            Err(e) => return Err(e.into()),
        }
    }
    Ok(buf)
}

async fn stream_download(
    conn: &SftpConn,
    handle: &str,
    local_path: &str,
    total: u64,
    mut progress: Progress,
    cancel: &AtomicBool,
) -> Result<TransferResult, OpError> {
    let mut local = tokio::fs::File::create(local_path)
        .await
        .map_err(OpError::local)?;

    let chunk = conn.max_read;
    let depth = pipeline_depth(chunk);
    let mut inflight: VecDeque<(JoinHandle<Result<Vec<u8>, OpError>>, usize)> = VecDeque::new();
    let mut next = 0u64;
    let mut cancelled = false;

    loop {
        if cancel.load(Ordering::Relaxed) {
            for (task, _) in inflight.drain(..) {
                task.abort();
            }
            cancelled = true;
            break;
        }

        while inflight.len() < depth {
            let want = if total > 0 {
                total.saturating_sub(next).min(chunk as u64) as usize
            } else {
                chunk
            };
            if want == 0 {
                break;
            }
            let sftp = conn.sftp.clone();
            let file_handle = handle.to_string();
            let at = next;
            inflight.push_back((
                tauri::async_runtime::spawn(async move {
                    read_chunk(&sftp, &file_handle, at, want).await
                }),
                want,
            ));
            next += want as u64;
        }

        let Some((task, want)) = inflight.pop_front() else {
            break;
        };
        let data = task.await.map_err(OpError::local)??;
        let got = data.len();
        if got > 0 {
            local.write_all(&data).await.map_err(OpError::local)?;
            progress.advance(got as u64);
        }
        if got < want {
            for (task, _) in inflight.drain(..) {
                task.abort();
            }
            break;
        }
    }

    local.flush().await.map_err(OpError::local)?;
    drop(local);
    progress.emit();

    if cancelled {
        let _ = tokio::fs::remove_file(local_path).await;
    }

    Ok(TransferResult {
        bytes: progress.done,
        cancelled,
    })
}

async fn read_local_chunk(file: &mut tokio::fs::File, len: usize) -> Result<Vec<u8>, OpError> {
    let mut buf = vec![0u8; len];
    let mut filled = 0;
    while filled < len {
        let n = file.read(&mut buf[filled..]).await.map_err(OpError::local)?;
        if n == 0 {
            break;
        }
        filled += n;
    }
    buf.truncate(filled);
    Ok(buf)
}

async fn stream_upload(
    conn: &SftpConn,
    handle: &str,
    local: &mut tokio::fs::File,
    mut progress: Progress,
    cancel: &AtomicBool,
) -> Result<TransferResult, OpError> {
    let chunk = conn.write_chunk(handle);
    let depth = pipeline_depth(chunk);
    let mut inflight: VecDeque<(JoinHandle<Result<(), OpError>>, usize)> = VecDeque::new();
    let mut offset = 0u64;
    let mut drained = false;
    let mut cancelled = false;

    loop {
        if cancel.load(Ordering::Relaxed) {
            for (task, _) in inflight.drain(..) {
                task.abort();
            }
            cancelled = true;
            break;
        }

        while !drained && inflight.len() < depth {
            let data = read_local_chunk(local, chunk).await?;
            if data.is_empty() {
                drained = true;
                break;
            }
            let n = data.len();
            let sftp = conn.sftp.clone();
            let file_handle = handle.to_string();
            let at = offset;
            inflight.push_back((
                tauri::async_runtime::spawn(async move {
                    sftp.write(file_handle, at, data)
                        .await
                        .map(|_| ())
                        .map_err(OpError::from)
                }),
                n,
            ));
            offset += n as u64;
        }

        let Some((task, n)) = inflight.pop_front() else {
            break;
        };
        task.await.map_err(OpError::local)??;
        progress.advance(n as u64);
    }

    progress.emit();
    Ok(TransferResult {
        bytes: progress.done,
        cancelled,
    })
}

#[tauri::command]
pub async fn sftp_download(
    app: AppHandle,
    store: State<'_, Store>,
    sftp: State<'_, SftpManager>,
    host_id: String,
    remote_path: String,
    local_path: String,
    transfer_id: String,
) -> Result<TransferResult, String> {
    let cancel = sftp.register_transfer(&transfer_id);
    let id = transfer_id.clone();
    let result = sftp
        .with_conn(&store, &host_id, move |conn| async move {
            let handle = conn
                .sftp
                .open(remote_path.as_str(), OpenFlags::READ, FileAttributes::empty())
                .await?
                .handle;
            let total = conn
                .sftp
                .fstat(handle.as_str())
                .await
                .ok()
                .and_then(|a| a.attrs.size)
                .unwrap_or(0);

            let outcome = stream_download(
                &conn,
                &handle,
                &local_path,
                total,
                Progress::new(app, id, total),
                &cancel,
            )
            .await;

            // Hand the handle back whether or not the copy worked; servers cap
            // how many a session may hold open.
            if !failed_fatally(&outcome) {
                let _ = conn.sftp.close(handle).await;
            }
            if outcome.is_err() {
                let _ = tokio::fs::remove_file(&local_path).await;
            }
            outcome
        })
        .await;
    sftp.finish_transfer(&transfer_id);
    result
}

#[tauri::command]
pub async fn sftp_upload(
    app: AppHandle,
    store: State<'_, Store>,
    sftp: State<'_, SftpManager>,
    host_id: String,
    local_path: String,
    remote_path: String,
    transfer_id: String,
) -> Result<TransferResult, String> {
    let cancel = sftp.register_transfer(&transfer_id);
    let id = transfer_id.clone();
    let result = sftp
        .with_conn(&store, &host_id, move |conn| async move {
            let mut local = tokio::fs::File::open(&local_path)
                .await
                .map_err(OpError::local)?;
            let total = local.metadata().await.map(|m| m.len()).unwrap_or(0);

            let handle = conn
                .sftp
                .open(
                    remote_path.as_str(),
                    OpenFlags::CREATE | OpenFlags::TRUNCATE | OpenFlags::WRITE,
                    FileAttributes::empty(),
                )
                .await?
                .handle;

            let outcome = stream_upload(
                &conn,
                &handle,
                &mut local,
                Progress::new(app, id, total),
                &cancel,
            )
            .await;
            if !failed_fatally(&outcome) {
                let _ = conn.sftp.close(handle).await;
                if outcome.as_ref().map(|r| r.cancelled).unwrap_or(true) {
                    let _ = conn.sftp.remove(remote_path.as_str()).await;
                }
            }
            outcome
        })
        .await;
    sftp.finish_transfer(&transfer_id);
    result
}

#[tauri::command]
pub async fn sftp_cancel_transfer(
    sftp: State<'_, SftpManager>,
    transfer_id: String,
) -> Result<(), String> {
    if let Some(flag) = sftp.cancels.lock().unwrap().get(&transfer_id) {
        flag.store(true, Ordering::Relaxed);
    }
    Ok(())
}

#[tauri::command]
pub async fn sftp_mkdir(
    store: State<'_, Store>,
    sftp: State<'_, SftpManager>,
    host_id: String,
    path: String,
) -> Result<(), String> {
    sftp.with_conn(&store, &host_id, move |conn| async move {
        conn.sftp.mkdir(path, FileAttributes::empty()).await?;
        Ok(())
    })
    .await
}

#[tauri::command]
pub async fn sftp_rename(
    store: State<'_, Store>,
    sftp: State<'_, SftpManager>,
    host_id: String,
    from: String,
    to: String,
) -> Result<(), String> {
    sftp.with_conn(&store, &host_id, move |conn| async move {
        conn.sftp.rename(from, to).await?;
        Ok(())
    })
    .await
}

/// Remove a remote file or directory. Directories are removed recursively —
/// SFTP has no recursive remove, so the tree is walked depth-first.
#[tauri::command]
pub async fn sftp_remove(
    store: State<'_, Store>,
    sftp: State<'_, SftpManager>,
    host_id: String,
    path: String,
    is_dir: bool,
) -> Result<(), String> {
    sftp.with_conn(&store, &host_id, move |conn| async move {
        if is_dir {
            remove_dir_recursive(&conn.sftp, &path).await
        } else {
            conn.sftp.remove(path).await?;
            Ok(())
        }
    })
    .await
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

/// Depth-first removal: SFTP's rmdir only succeeds on an empty directory, so
/// the tree has to be emptied from the leaves up.
///
/// Box::pin because an async fn that awaits itself needs a boxed future — the
/// return type would otherwise be infinitely sized.
async fn remove_dir_recursive(sftp: &RawSftpSession, path: &str) -> Result<(), OpError> {
    for (name, attrs) in read_dir_raw(sftp, path).await? {
        let child = join_remote(path, &name);
        if attrs.is_dir() {
            Box::pin(remove_dir_recursive(sftp, &child)).await?;
        } else {
            sftp.remove(child).await?;
        }
    }
    sftp.rmdir(path).await?;
    Ok(())
}

#[tauri::command]
pub fn local_remove(path: String, is_dir: bool) -> Result<(), String> {
    if is_dir {
        std::fs::remove_dir_all(&path).map_err(|e| e.to_string())
    } else {
        std::fs::remove_file(&path).map_err(|e| e.to_string())
    }
}

fn sort_entries(entries: &mut [FileEntry]) {
    entries.sort_by(|a, b| {
        b.is_dir
            .cmp(&a.is_dir)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });
}
