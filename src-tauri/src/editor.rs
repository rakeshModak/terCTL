use crate::sftp::{failed_fatally, read_chunk, OpError, SftpConn, SftpManager};
use crate::store::Store;
use russh_sftp::protocol::{FileAttributes, OpenFlags, Packet, StatusCode};
use tauri::State;

pub(crate) const POSIX_RENAME: &str = "posix-rename@openssh.com";

const MAX_EDIT_BYTES: u64 = 4 * 1024 * 1024;
const BINARY_SNIFF_BYTES: usize = 8000;

#[derive(Clone, Copy, PartialEq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileStat {
    pub mtime: u64,
    pub size: u64,
}

#[derive(Clone, Copy, PartialEq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Eol {
    Lf,
    Crlf,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenedFile {
    pub path: String,
    pub content: String,
    pub eol: Eol,
    pub bom: bool,
    pub stat: FileStat,
}

fn stat_of(attrs: &FileAttributes) -> FileStat {
    FileStat {
        mtime: attrs.mtime.unwrap_or(0) as u64,
        size: attrs.size.unwrap_or(0),
    }
}

fn human_size(bytes: u64) -> String {
    if bytes >= 1024 * 1024 {
        format!("{:.1} MB", bytes as f64 / (1024.0 * 1024.0))
    } else {
        format!("{:.0} KB", bytes as f64 / 1024.0)
    }
}

async fn resolve(conn: &SftpConn, path: &str) -> Result<String, OpError> {
    let name = conn.sftp.realpath(path).await?;
    match name.files.first() {
        Some(f) => Ok(f.filename.clone()),
        None => Err(OpError::local(format!("could not resolve {path}"))),
    }
}

#[tauri::command]
pub async fn editor_read_file(
    store: State<'_, Store>,
    sftp: State<'_, SftpManager>,
    host_id: String,
    path: String,
) -> Result<OpenedFile, String> {
    sftp.with_conn(&store, &host_id, move |conn| async move {
        let path = resolve(&conn, &path).await?;
        let handle = conn
            .sftp
            .open(path.as_str(), OpenFlags::READ, FileAttributes::empty())
            .await?
            .handle;

        let result = read_text(&conn, &handle, &path).await;
        if !failed_fatally(&result) {
            let _ = conn.sftp.close(handle).await;
        }
        result
    })
    .await
}

async fn read_text(conn: &SftpConn, handle: &str, path: &str) -> Result<OpenedFile, OpError> {
    let attrs = conn.sftp.fstat(handle).await?.attrs;
    if attrs.is_dir() {
        return Err(OpError::local(format!("{path} is a directory")));
    }

    let stat = stat_of(&attrs);
    if stat.size > MAX_EDIT_BYTES {
        return Err(OpError::local(format!(
            "{path} is {} - too large to edit; fetch it from Transfer instead",
            human_size(stat.size)
        )));
    }

    let mut bytes: Vec<u8> = Vec::with_capacity(stat.size as usize);
    while (bytes.len() as u64) < stat.size {
        let want = ((stat.size - bytes.len() as u64) as usize).min(conn.max_read);
        let chunk = read_chunk(&conn.sftp, handle, bytes.len() as u64, want).await?;
        if chunk.is_empty() {
            break;
        }
        bytes.extend_from_slice(&chunk);
    }

    if bytes[..bytes.len().min(BINARY_SNIFF_BYTES)].contains(&0) {
        return Err(OpError::local(format!("{path} looks like a binary file")));
    }

    let bom = bytes.starts_with(&[0xEF, 0xBB, 0xBF]);
    if bom {
        bytes.drain(..3);
    }
    let text = String::from_utf8(bytes)
        .map_err(|_| OpError::local(format!("{path} is not valid UTF-8 text")))?;

    let eol = if text.contains("\r\n") {
        Eol::Crlf
    } else {
        Eol::Lf
    };
    let content = match eol {
        Eol::Crlf => text.replace("\r\n", "\n"),
        Eol::Lf => text,
    };

    Ok(OpenedFile {
        path: path.to_string(),
        content,
        eol,
        bom,
        stat,
    })
}

#[tauri::command]
pub async fn editor_write_file(
    store: State<'_, Store>,
    sftp: State<'_, SftpManager>,
    host_id: String,
    path: String,
    content: String,
    eol: Eol,
    bom: bool,
    expected: Option<FileStat>,
) -> Result<FileStat, String> {
    sftp.with_conn(&store, &host_id, move |conn| async move {
        let path = resolve(&conn, &path).await?;
        let attrs = conn.sftp.stat(path.as_str()).await?.attrs;

        if let Some(expected) = expected {
            if stat_of(&attrs) != expected {
                return Err(OpError::local(
                    "this file changed on the server since you opened it - reload it before saving",
                ));
            }
        }

        let mut bytes = Vec::with_capacity(content.len() + 3);
        if bom {
            bytes.extend_from_slice(&[0xEF, 0xBB, 0xBF]);
        }
        match eol {
            Eol::Lf => bytes.extend_from_slice(content.as_bytes()),
            Eol::Crlf => {
                let crlf = content.replace("\r\n", "\n").replace('\n', "\r\n");
                bytes.extend_from_slice(crlf.as_bytes());
            }
        }

        write_atomically(&conn, &path, &bytes, attrs.permissions).await?;
        Ok(stat_of(&conn.sftp.stat(path.as_str()).await?.attrs))
    })
    .await
}

async fn write_atomically(
    conn: &SftpConn,
    target: &str,
    bytes: &[u8],
    permissions: Option<u32>,
) -> Result<(), OpError> {
    let temp = temp_path(target);

    let attrs = FileAttributes {
        permissions: permissions.map(|p| p & 0o7777),
        ..FileAttributes::empty()
    };

    let handle = conn
        .sftp
        .open(
            temp.as_str(),
            OpenFlags::CREATE | OpenFlags::WRITE | OpenFlags::TRUNCATE | OpenFlags::EXCLUDE,
            attrs,
        )
        .await?
        .handle;

    let written = fill(conn, &handle, bytes).await;
    if !failed_fatally(&written) {
        let _ = conn.sftp.close(handle).await;
    }
    if let Err(e) = written {
        let _ = conn.sftp.remove(temp.as_str()).await;
        return Err(e);
    }

    let renamed = rename_over(conn, &temp, target).await;
    if renamed.is_err() {
        let _ = conn.sftp.remove(temp.as_str()).await;
    }
    renamed
}

fn temp_path(target: &str) -> String {
    let (dir, name) = match target.rsplit_once('/') {
        Some((d, n)) => (d, n),
        None => ("", target),
    };
    format!("{dir}/.{name}.terctl-{}", uuid::Uuid::new_v4().simple())
}

async fn fill(conn: &SftpConn, handle: &str, bytes: &[u8]) -> Result<(), OpError> {
    let chunk = conn.write_chunk(handle);
    let mut offset = 0usize;
    while offset < bytes.len() {
        let end = (offset + chunk).min(bytes.len());
        conn.sftp
            .write(handle, offset as u64, bytes[offset..end].to_vec())
            .await?;
        offset = end;
    }
    let _ = conn.sftp.fsync(handle).await;
    Ok(())
}

async fn rename_over(conn: &SftpConn, from: &str, to: &str) -> Result<(), OpError> {
    if conn.posix_rename {
        let data = russh_sftp::ser::to_bytes(&PosixRename {
            oldpath: from.to_string(),
            newpath: to.to_string(),
        })
        .map_err(OpError::local)?
        .to_vec();

        return match conn.sftp.extended(POSIX_RENAME, data).await? {
            Packet::Status(s) if s.status_code == StatusCode::Ok => Ok(()),
            Packet::Status(s) => Err(OpError::local(format!(
                "could not replace {to}: {}",
                s.error_message
            ))),
            _ => Err(OpError::local(format!("could not replace {to}"))),
        };
    }

    let backup = temp_path(to);
    conn.sftp.rename(to, backup.as_str()).await?;
    match conn.sftp.rename(from, to).await {
        Ok(_) => {
            let _ = conn.sftp.remove(backup.as_str()).await;
            Ok(())
        }
        Err(e) => {
            let _ = conn.sftp.rename(backup.as_str(), to).await;
            Err(e.into())
        }
    }
}

#[derive(serde::Serialize)]
struct PosixRename {
    oldpath: String,
    newpath: String,
}
