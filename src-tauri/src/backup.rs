//! Encrypted export/import of the full connection config.
//!
//! The exported file is a JSON envelope: a plaintext header (format, version,
//! KDF parameters, nonce) plus one AEAD-sealed blob holding every host, group,
//! and secret. Everything identifying — hostnames, usernames, labels — lives
//! *inside* the ciphertext, so a stolen file reveals only that it is a TerCTL
//! backup. The header is bound into the AEAD's associated data, which is what
//! stops an attacker from rewriting the KDF cost down to something crackable.
//!
//! The whole round trip runs in this process: the frontend hands over a
//! passphrase and a path and never sees plaintext secrets.

use crate::models::{AuthKind, Group, Host};
use crate::store::{HostRecord, Store};
use crate::vault::{self, SecretKind};
use argon2::{Algorithm, Argon2, Params, Version};
use base64::{engine::general_purpose::STANDARD as B64, Engine as _};
use chacha20poly1305::{
    aead::{Aead, KeyInit, Payload as AeadPayload},
    XChaCha20Poly1305, XNonce,
};
use rand::RngCore;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use tauri::State;
use zeroize::{Zeroize, Zeroizing};

const FORMAT: &str = "terctl.backup";
const VERSION: u32 = 1;
const CIPHER: &str = "xchacha20poly1305";
const KDF_ALGORITHM: &str = "argon2id";

const ARGON2_MEMORY_KIB: u32 = 262_144; // 256 MiB
const ARGON2_ITERATIONS: u32 = 3;
const ARGON2_PARALLELISM: u32 = 1;

const MIN_MEMORY_KIB: u32 = 8 * 1024; // 8 MiB
const MAX_MEMORY_KIB: u32 = 1024 * 1024; // 1 GiB
const MAX_ITERATIONS: u32 = 10;
const MAX_PARALLELISM: u32 = 4;

const SALT_LEN: usize = 16;
const NONCE_LEN: usize = 24;
const KEY_LEN: usize = 32;

const MAX_FILE_BYTES: u64 = 32 * 1024 * 1024;

const MAX_HOSTS: usize = 10_000;
const MAX_GROUPS: usize = 2_000;
const MAX_LABEL_LEN: usize = 200;
const MAX_HOSTNAME_LEN: usize = 255;
const MAX_USERNAME_LEN: usize = 64;
const MAX_TAGS: usize = 50;
const MAX_TAG_LEN: usize = 64;
const MAX_PATH_LEN: usize = 4096;
const MAX_SECRET_LEN: usize = 4096;
const MAX_PRIVATE_KEY_LEN: usize = 64 * 1024;

// ---------------------------------------------------------------------------
// Envelope
// ---------------------------------------------------------------------------

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct KdfParams {
    algorithm: String,
    memory_kib: u32,
    iterations: u32,
    parallelism: u32,
    salt_b64: String,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Envelope {
    format: String,
    version: u32,
    created_at_unix: u64,
    app_version: String,
    kdf: KdfParams,
    cipher: String,
    nonce_b64: String,
    ciphertext_b64: String,
}

fn associated_data(env: &Envelope) -> Vec<u8> {
    let mut buf = Vec::new();
    let mut push = |bytes: &[u8]| {
        buf.extend_from_slice(&(bytes.len() as u32).to_le_bytes());
        buf.extend_from_slice(bytes);
    };
    push(env.format.as_bytes());
    push(&env.version.to_le_bytes());
    push(&env.created_at_unix.to_le_bytes());
    push(env.app_version.as_bytes());
    push(env.kdf.algorithm.as_bytes());
    push(&env.kdf.memory_kib.to_le_bytes());
    push(&env.kdf.iterations.to_le_bytes());
    push(&env.kdf.parallelism.to_le_bytes());
    push(env.kdf.salt_b64.as_bytes());
    push(env.cipher.as_bytes());
    push(env.nonce_b64.as_bytes());
    buf
}

fn derive_key(
    passphrase: &str,
    salt: &[u8],
    params: &KdfParams,
) -> Result<Zeroizing<[u8; KEY_LEN]>, String> {
    let argon_params = Params::new(
        params.memory_kib,
        params.iterations,
        params.parallelism,
        Some(KEY_LEN),
    )
    .map_err(|e| format!("invalid KDF parameters: {e}"))?;
    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, argon_params);
    let mut key = Zeroizing::new([0u8; KEY_LEN]);
    argon2
        .hash_password_into(passphrase.as_bytes(), salt, key.as_mut())
        .map_err(|e| format!("key derivation failed: {e}"))?;
    Ok(key)
}

// ---------------------------------------------------------------------------
// Payload
// ---------------------------------------------------------------------------

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BackupHost {
    id: String,
    label: String,
    hostname: String,
    port: u16,
    username: String,
    auth_kind: AuthKind,
    key_ref: Option<String>,
    group_id: Option<String>,
    tags: Vec<String>,
    accent: Option<String>,
    term_scheme: Option<String>,
    host_key_fingerprint: Option<String>,
    #[serde(default)]
    password: Option<String>,
    #[serde(default)]
    passphrase: Option<String>,
    #[serde(default)]
    private_key: Option<String>,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BackupPayload {
    hosts: Vec<BackupHost>,
    groups: Vec<Group>,
}

impl std::fmt::Debug for BackupPayload {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("BackupPayload")
            .field("hosts", &self.hosts.len())
            .field("groups", &self.groups.len())
            .finish_non_exhaustive()
    }
}

impl BackupPayload {
    fn wipe_secrets(&mut self) {
        for host in &mut self.hosts {
            if let Some(s) = host.password.as_mut() {
                s.zeroize();
            }
            if let Some(s) = host.passphrase.as_mut() {
                s.zeroize();
            }
            if let Some(s) = host.private_key.as_mut() {
                s.zeroize();
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Summaries returned to the UI
// ---------------------------------------------------------------------------

#[derive(Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct BackupPreview {
    pub hosts: usize,
    pub groups: usize,
    pub passwords: usize,
    pub passphrases: usize,
    pub key_auth_hosts: usize,
}

#[derive(Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ExportSummary {
    pub path: String,
    pub hosts: usize,
    pub groups: usize,
    pub passwords: usize,
    pub passphrases: usize,
    pub private_keys: usize,
    pub unreadable_keys: Vec<String>,
}

#[derive(Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ImportSummary {
    pub hosts_added: usize,
    pub groups_added: usize,
    pub secrets_restored: usize,
    pub private_keys_restored: usize,
    pub hosts_skipped_existing: usize,
    pub hosts_skipped_duplicate: Vec<String>,
    pub fingerprint_conflicts: Vec<String>,
    pub needs_credentials: Vec<String>,
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

fn check_text(value: &str, max: usize, field: &str) -> Result<(), String> {
    if value.chars().count() > max {
        return Err(format!("{field} exceeds {max} characters"));
    }
    if value.chars().any(char::is_control) {
        return Err(format!("{field} contains control characters"));
    }
    Ok(())
}

fn check_required(value: &str, max: usize, field: &str) -> Result<(), String> {
    if value.trim().is_empty() {
        return Err(format!("{field} is empty"));
    }
    check_text(value, max, field)
}

fn validate_payload(payload: &BackupPayload) -> Result<(), String> {
    if payload.hosts.len() > MAX_HOSTS {
        return Err(format!("file declares more than {MAX_HOSTS} hosts"));
    }
    if payload.groups.len() > MAX_GROUPS {
        return Err(format!("file declares more than {MAX_GROUPS} groups"));
    }

    let mut group_ids = HashSet::new();
    for group in &payload.groups {
        check_required(&group.id, 128, "group id")?;
        check_required(&group.name, MAX_LABEL_LEN, "group name")?;
        if !group_ids.insert(group.id.as_str()) {
            return Err(format!("duplicate group id: {}", group.id));
        }
    }
    for group in &payload.groups {
        if let Some(parent) = &group.parent_id {
            if !group_ids.contains(parent.as_str()) {
                return Err(format!("group '{}' references a missing parent", group.name));
            }
            if parent == &group.id {
                return Err(format!("group '{}' is its own parent", group.name));
            }
        }
    }
    detect_group_cycle(&payload.groups)?;

    let mut host_ids = HashSet::new();
    for host in &payload.hosts {
        check_required(&host.id, 128, "host id")?;
        check_required(&host.label, MAX_LABEL_LEN, "host label")?;
        check_required(&host.hostname, MAX_HOSTNAME_LEN, "hostname")?;
        check_required(&host.username, MAX_USERNAME_LEN, "username")?;
        if host.hostname.chars().any(char::is_whitespace) {
            return Err(format!("hostname '{}' contains whitespace", host.hostname));
        }
        if host.port == 0 {
            return Err(format!("host '{}' has port 0", host.label));
        }
        if !host_ids.insert(host.id.as_str()) {
            return Err(format!("duplicate host id: {}", host.id));
        }
        if host.tags.len() > MAX_TAGS {
            return Err(format!("host '{}' has more than {MAX_TAGS} tags", host.label));
        }
        for tag in &host.tags {
            check_text(tag, MAX_TAG_LEN, "tag")?;
        }
        if let Some(key_ref) = &host.key_ref {
            check_text(key_ref, MAX_PATH_LEN, "key path")?;
        }
        if let Some(accent) = &host.accent {
            check_text(accent, 64, "accent")?;
        }
        if let Some(scheme) = &host.term_scheme {
            check_text(scheme, 64, "terminal scheme")?;
        }
        if let Some(fp) = &host.host_key_fingerprint {
            check_text(fp, 128, "host key fingerprint")?;
        }
        if let Some(group_id) = &host.group_id {
            if !group_ids.contains(group_id.as_str()) {
                return Err(format!("host '{}' references a missing group", host.label));
            }
        }
        for (secret, field) in [
            (&host.password, "password"),
            (&host.passphrase, "passphrase"),
        ] {
            if let Some(value) = secret {
                if value.len() > MAX_SECRET_LEN {
                    return Err(format!("{field} for '{}' is too long", host.label));
                }
            }
        }
        if let Some(pem) = &host.private_key {
            if pem.len() > MAX_PRIVATE_KEY_LEN {
                return Err(format!("private key for '{}' is too long", host.label));
            }
            if !pem.contains("PRIVATE KEY") {
                return Err(format!(
                    "private key for '{}' is not in PEM format",
                    host.label
                ));
            }
        }
    }
    Ok(())
}

fn detect_group_cycle(groups: &[Group]) -> Result<(), String> {
    let parents: HashMap<&str, Option<&str>> = groups
        .iter()
        .map(|g| (g.id.as_str(), g.parent_id.as_deref()))
        .collect();
    for group in groups {
        let mut seen = HashSet::new();
        let mut cursor = Some(group.id.as_str());
        while let Some(id) = cursor {
            if !seen.insert(id) {
                return Err(format!("group '{}' is part of a cycle", group.name));
            }
            cursor = parents.get(id).copied().flatten();
        }
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn backup_preview(store: State<'_, Store>) -> Result<BackupPreview, String> {
    let records = store.list_host_records().map_err(|e| e.to_string())?;
    let groups = store.list_groups().map_err(|e| e.to_string())?;

    tauri::async_runtime::spawn_blocking(move || {
        let mut preview = BackupPreview {
            hosts: records.len(),
            groups: groups.len(),
            ..Default::default()
        };
        for record in &records {
            if vault::has_secret(&record.host.id, SecretKind::Password).unwrap_or(false) {
                preview.passwords += 1;
            }
            if vault::has_secret(&record.host.id, SecretKind::Passphrase).unwrap_or(false) {
                preview.passphrases += 1;
            }
            if record.host.auth_kind == AuthKind::Key {
                preview.key_auth_hosts += 1;
            }
        }
        preview
    })
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn export_config(
    store: State<'_, Store>,
    path: String,
    passphrase: String,
    include_private_keys: bool,
) -> Result<ExportSummary, String> {
    if passphrase.is_empty() {
        return Err("an export passphrase is required".to_string());
    }
    let records = store.list_host_records().map_err(|e| e.to_string())?;
    let groups = store.list_groups().map_err(|e| e.to_string())?;

    tauri::async_runtime::spawn_blocking(move || {
        let passphrase = Zeroizing::new(passphrase);
        export_blocking(records, groups, &path, &passphrase, include_private_keys)
    })
    .await
    .map_err(|e| e.to_string())?
}

fn export_blocking(
    records: Vec<HostRecord>,
    groups: Vec<Group>,
    path: &str,
    passphrase: &str,
    include_private_keys: bool,
) -> Result<ExportSummary, String> {
    let mut summary = ExportSummary {
        path: path.to_string(),
        hosts: records.len(),
        groups: groups.len(),
        ..Default::default()
    };

    let mut hosts = Vec::with_capacity(records.len());
    for record in records {
        let host = record.host;
        let password = vault::get_secret(&host.id, SecretKind::Password).map_err(|e| e.to_string())?;
        let passphrase_secret =
            vault::get_secret(&host.id, SecretKind::Passphrase).map_err(|e| e.to_string())?;
        if password.is_some() {
            summary.passwords += 1;
        }
        if passphrase_secret.is_some() {
            summary.passphrases += 1;
        }

        let private_key = if include_private_keys && host.auth_kind == AuthKind::Key {
            match read_private_key(&host) {
                Some(pem) => {
                    summary.private_keys += 1;
                    Some(pem)
                }
                None => {
                    summary.unreadable_keys.push(host.label.clone());
                    None
                }
            }
        } else {
            None
        };

        hosts.push(BackupHost {
            id: host.id,
            label: host.label,
            hostname: host.hostname,
            port: host.port,
            username: host.username,
            auth_kind: host.auth_kind,
            key_ref: host.key_ref,
            group_id: host.group_id,
            tags: host.tags,
            accent: host.accent,
            term_scheme: host.term_scheme,
            host_key_fingerprint: record.host_key_fingerprint,
            password,
            passphrase: passphrase_secret,
            private_key,
        });
    }

    let mut payload = BackupPayload { hosts, groups };
    let plaintext = Zeroizing::new(
        serde_json::to_vec(&payload).map_err(|e| format!("failed to serialize backup: {e}"))?,
    );
    payload.wipe_secrets();

    let mut salt = [0u8; SALT_LEN];
    let mut nonce_bytes = [0u8; NONCE_LEN];
    rand::rng().fill_bytes(&mut salt);
    rand::rng().fill_bytes(&mut nonce_bytes);

    let kdf = KdfParams {
        algorithm: KDF_ALGORITHM.to_string(),
        memory_kib: ARGON2_MEMORY_KIB,
        iterations: ARGON2_ITERATIONS,
        parallelism: ARGON2_PARALLELISM,
        salt_b64: B64.encode(salt),
    };

    let mut envelope = Envelope {
        format: FORMAT.to_string(),
        version: VERSION,
        created_at_unix: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0),
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        kdf: kdf.clone(),
        cipher: CIPHER.to_string(),
        nonce_b64: B64.encode(nonce_bytes),
        ciphertext_b64: String::new(),
    };

    let key = derive_key(passphrase, &salt, &kdf)?;
    let cipher = XChaCha20Poly1305::new_from_slice(key.as_ref())
        .map_err(|e| format!("failed to initialize cipher: {e}"))?;
    let ciphertext = cipher
        .encrypt(
            XNonce::from_slice(&nonce_bytes),
            AeadPayload {
                msg: plaintext.as_ref(),
                aad: &associated_data(&envelope),
            },
        )
        .map_err(|_| "encryption failed".to_string())?;
    drop(plaintext);
    envelope.ciphertext_b64 = B64.encode(&ciphertext);

    let json = serde_json::to_vec_pretty(&envelope)
        .map_err(|e| format!("failed to serialize backup envelope: {e}"))?;
    write_private_atomic(Path::new(path), &json)
        .map_err(|e| format!("failed to write '{path}': {e}"))?;

    Ok(summary)
}

/// Reads the key file backing a host, preferring material already restored
/// into the keychain over the on-disk path.
fn read_private_key(host: &Host) -> Option<String> {
    if let Ok(Some(pem)) = vault::get_secret(&host.id, SecretKind::PrivateKey) {
        return Some(pem);
    }
    let key_ref = host.key_ref.as_deref()?;
    let path = expand_tilde(key_ref);
    let contents = fs::read(&path).ok()?;
    let text = String::from_utf8(contents).ok()?;
    text.contains("PRIVATE KEY").then_some(text)
}

fn expand_tilde(path: &str) -> PathBuf {
    match path.strip_prefix("~/") {
        Some(rest) => match std::env::var("HOME") {
            Ok(home) => PathBuf::from(home).join(rest),
            Err(_) => PathBuf::from(path),
        },
        None => PathBuf::from(path),
    }
}

/// Writes owner-only and atomically: a crash or a full disk leaves either the
/// previous file or nothing, never a truncated backup that looks importable.
fn write_private_atomic(path: &Path, bytes: &[u8]) -> std::io::Result<()> {
    let dir = path.parent().filter(|p| !p.as_os_str().is_empty());
    let dir = dir.unwrap_or_else(|| Path::new("."));
    let mut suffix = [0u8; 8];
    rand::rng().fill_bytes(&mut suffix);
    let tmp = dir.join(format!(".terctl-backup-{}.tmp", B64.encode(suffix).replace('/', "_")));

    let mut options = fs::OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }

    let result = (|| {
        let mut file = options.open(&tmp)?;
        file.write_all(bytes)?;
        file.sync_all()?;
        drop(file);
        fs::rename(&tmp, path)
    })();

    if result.is_err() {
        let _ = fs::remove_file(&tmp);
    }
    result
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupInfo {
    pub version: u32,
    pub created_at_unix: u64,
    pub app_version: String,
}

/// Confirms a picked file really is a TerCTL backup before the UI asks for a
/// passphrase. Reads only the plaintext header — it cannot and must not reveal
/// anything about the hosts inside, which is why there is no richer preview.
#[tauri::command]
pub async fn inspect_backup(path: String) -> Result<BackupInfo, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let path = Path::new(&path);
        let metadata =
            fs::metadata(path).map_err(|e| format!("cannot read '{}': {e}", path.display()))?;
        if metadata.len() > MAX_FILE_BYTES {
            return Err("file is too large to be a TerCTL backup".to_string());
        }
        let raw = fs::read(path).map_err(|e| format!("cannot read '{}': {e}", path.display()))?;
        let envelope: Envelope = serde_json::from_slice(&raw)
            .map_err(|_| "this file is not a TerCTL backup".to_string())?;
        if envelope.format != FORMAT {
            return Err("this file is not a TerCTL backup".to_string());
        }
        if envelope.version > VERSION {
            return Err(format!(
                "this backup was written by a newer version of TerCTL (format {})",
                envelope.version
            ));
        }
        Ok(BackupInfo {
            version: envelope.version,
            created_at_unix: envelope.created_at_unix,
            app_version: envelope.app_version,
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn import_config(
    store: State<'_, Store>,
    path: String,
    passphrase: String,
) -> Result<ImportSummary, String> {
    if passphrase.is_empty() {
        return Err("the decryption passphrase is required".to_string());
    }

    let mut payload = tauri::async_runtime::spawn_blocking(move || {
        let passphrase = Zeroizing::new(passphrase);
        decrypt_file(Path::new(&path), &passphrase)
    })
    .await
    .map_err(|e| e.to_string())??;

    let existing_hosts = store.list_host_records().map_err(|e| e.to_string())?;
    let existing_groups = store.list_groups().map_err(|e| e.to_string())?;

    let mut plan = plan_import(&payload, &existing_hosts, &existing_groups);

    store
        .insert_imported(&plan.hosts, &plan.groups)
        .map_err(|e| format!("failed to write imported hosts: {e}"))?;

    // The keychain is not part of the SQLite transaction, so a failure here
    // would leave hosts that exist but can never authenticate. Roll the rows
    // back rather than leaving that behind.
    let secrets = std::mem::take(&mut plan.secrets);
    let inserted_ids: Vec<String> = plan.hosts.iter().map(|(h, _)| h.id.clone()).collect();
    let written = tauri::async_runtime::spawn_blocking(move || write_secrets(secrets))
        .await
        .map_err(|e| e.to_string())?;

    payload.wipe_secrets();

    match written {
        Ok(()) => Ok(plan.summary),
        Err(e) => {
            let _ = store.delete_hosts(&inserted_ids);
            Err(format!("failed to store secrets in the OS keychain: {e}"))
        }
    }
}

fn write_secrets(secrets: Vec<(String, SecretKind, String)>) -> Result<(), String> {
    for (host_id, kind, value) in secrets {
        let value = Zeroizing::new(value);
        vault::set_secret(&host_id, kind, &value).map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn decrypt_file(path: &Path, passphrase: &str) -> Result<BackupPayload, String> {
    let metadata = fs::metadata(path).map_err(|e| format!("cannot read '{}': {e}", path.display()))?;
    if metadata.len() > MAX_FILE_BYTES {
        return Err("file is too large to be a TerCTL backup".to_string());
    }
    let raw = fs::read(path).map_err(|e| format!("cannot read '{}': {e}", path.display()))?;
    let envelope: Envelope = serde_json::from_slice(&raw)
        .map_err(|_| "this file is not a TerCTL backup".to_string())?;

    if envelope.format != FORMAT {
        return Err("this file is not a TerCTL backup".to_string());
    }
    if envelope.version > VERSION {
        return Err(format!(
            "this backup was written by a newer version of TerCTL (format {})",
            envelope.version
        ));
    }
    if envelope.cipher != CIPHER {
        return Err(format!("unsupported cipher: {}", envelope.cipher));
    }
    if envelope.kdf.algorithm != KDF_ALGORITHM {
        return Err(format!("unsupported KDF: {}", envelope.kdf.algorithm));
    }
    if !(MIN_MEMORY_KIB..=MAX_MEMORY_KIB).contains(&envelope.kdf.memory_kib)
        || !(1..=MAX_ITERATIONS).contains(&envelope.kdf.iterations)
        || !(1..=MAX_PARALLELISM).contains(&envelope.kdf.parallelism)
    {
        return Err("backup declares unusable KDF parameters".to_string());
    }

    let salt = B64
        .decode(&envelope.kdf.salt_b64)
        .map_err(|_| "backup header is malformed".to_string())?;
    let nonce = B64
        .decode(&envelope.nonce_b64)
        .map_err(|_| "backup header is malformed".to_string())?;
    let ciphertext = B64
        .decode(&envelope.ciphertext_b64)
        .map_err(|_| "backup body is malformed".to_string())?;
    if salt.len() != SALT_LEN || nonce.len() != NONCE_LEN {
        return Err("backup header is malformed".to_string());
    }

    let key = derive_key(passphrase, &salt, &envelope.kdf)?;
    let cipher = XChaCha20Poly1305::new_from_slice(key.as_ref())
        .map_err(|e| format!("failed to initialize cipher: {e}"))?;
    // Indistinguishable from a corrupted or tampered file, deliberately.
    let plaintext = Zeroizing::new(
        cipher
            .decrypt(
                XNonce::from_slice(&nonce),
                AeadPayload {
                    msg: &ciphertext,
                    aad: &associated_data(&envelope),
                },
            )
            .map_err(|_| "wrong passphrase, or the file has been modified".to_string())?,
    );

    let payload: BackupPayload = serde_json::from_slice(plaintext.as_ref())
        .map_err(|e| format!("backup contents are malformed: {e}"))?;
    validate_payload(&payload)?;
    Ok(payload)
}

struct ImportPlan {
    hosts: Vec<(Host, Option<String>)>,
    groups: Vec<Group>,
    secrets: Vec<(String, SecretKind, String)>,
    summary: ImportSummary,
}

/// Additive merge. A host already present — by id, or by the same
/// host/port/user under a different id — is left completely untouched, which
/// is also what keeps an existing pinned host key from being overwritten.
fn plan_import(
    payload: &BackupPayload,
    existing_hosts: &[HostRecord],
    existing_groups: &[Group],
) -> ImportPlan {
    let mut summary = ImportSummary::default();

    let existing_ids: HashSet<&str> = existing_hosts
        .iter()
        .map(|r| r.host.id.as_str())
        .collect();
    let existing_endpoints: HashMap<(String, u16, String), &HostRecord> = existing_hosts
        .iter()
        .map(|r| {
            (
                (
                    r.host.hostname.to_lowercase(),
                    r.host.port,
                    r.host.username.to_lowercase(),
                ),
                r,
            )
        })
        .collect();

    // Groups first: reuse a local group with the same id, or the same name
    // under the same parent, so repeated imports don't stack up duplicates.
    let mut group_map: HashMap<String, String> = HashMap::new();
    let mut new_groups = Vec::new();
    let existing_group_ids: HashSet<&str> = existing_groups.iter().map(|g| g.id.as_str()).collect();

    for group in order_groups(&payload.groups) {
        let mapped_parent = group
            .parent_id
            .as_ref()
            .and_then(|p| group_map.get(p).cloned());

        if existing_group_ids.contains(group.id.as_str()) {
            group_map.insert(group.id.clone(), group.id.clone());
            continue;
        }
        let twin = existing_groups
            .iter()
            .find(|g| g.name == group.name && g.parent_id == mapped_parent);
        if let Some(twin) = twin {
            group_map.insert(group.id.clone(), twin.id.clone());
            continue;
        }
        group_map.insert(group.id.clone(), group.id.clone());
        new_groups.push(Group {
            id: group.id.clone(),
            name: group.name.clone(),
            parent_id: mapped_parent,
        });
    }
    summary.groups_added = new_groups.len();

    let mut new_hosts = Vec::new();
    let mut secrets = Vec::new();

    for host in &payload.hosts {
        if existing_ids.contains(host.id.as_str()) {
            summary.hosts_skipped_existing += 1;
            continue;
        }
        let endpoint = (
            host.hostname.to_lowercase(),
            host.port,
            host.username.to_lowercase(),
        );
        if let Some(local) = existing_endpoints.get(&endpoint) {
            summary.hosts_skipped_duplicate.push(host.label.clone());
            let differs = match (&local.host_key_fingerprint, &host.host_key_fingerprint) {
                (Some(a), Some(b)) => a != b,
                _ => false,
            };
            if differs {
                summary.fingerprint_conflicts.push(host.label.clone());
            }
            continue;
        }

        if let Some(password) = &host.password {
            secrets.push((host.id.clone(), SecretKind::Password, password.clone()));
        }
        if let Some(passphrase) = &host.passphrase {
            secrets.push((host.id.clone(), SecretKind::Passphrase, passphrase.clone()));
        }
        if let Some(pem) = &host.private_key {
            secrets.push((host.id.clone(), SecretKind::PrivateKey, pem.clone()));
            summary.private_keys_restored += 1;
        } else if host.auth_kind == AuthKind::Key {
            summary.needs_credentials.push(host.label.clone());
        }
        summary.secrets_restored +=
            usize::from(host.password.is_some()) + usize::from(host.passphrase.is_some());

        new_hosts.push((
            Host {
                id: host.id.clone(),
                label: host.label.clone(),
                hostname: host.hostname.clone(),
                port: host.port,
                username: host.username.clone(),
                auth_kind: host.auth_kind.clone(),
                key_ref: host.key_ref.clone(),
                group_id: host
                    .group_id
                    .as_ref()
                    .and_then(|g| group_map.get(g).cloned()),
                tags: host.tags.clone(),
                accent: host.accent.clone(),
                term_scheme: host.term_scheme.clone(),
                os: None,
            },
            host.host_key_fingerprint.clone(),
        ));
    }
    summary.hosts_added = new_hosts.len();

    ImportPlan {
        hosts: new_hosts,
        groups: new_groups,
        secrets,
        summary,
    }
}

/// Parents before children, so a group's mapped parent id is always known by
/// the time the child is processed.
fn order_groups(groups: &[Group]) -> Vec<&Group> {
    let by_id: HashMap<&str, &Group> = groups.iter().map(|g| (g.id.as_str(), g)).collect();
    let depth = |group: &Group| {
        let mut depth = 0usize;
        let mut cursor = group.parent_id.as_deref();
        while let Some(id) = cursor {
            depth += 1;
            if depth > MAX_GROUPS {
                break;
            }
            cursor = by_id.get(id).and_then(|g| g.parent_id.as_deref());
        }
        depth
    };
    let mut ordered: Vec<&Group> = groups.iter().collect();
    ordered.sort_by_key(|g| depth(g));
    ordered
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_payload() -> BackupPayload {
        BackupPayload {
            hosts: vec![BackupHost {
                id: "host-1".into(),
                label: "Prod".into(),
                hostname: "10.0.0.5".into(),
                port: 22,
                username: "deploy".into(),
                auth_kind: AuthKind::Password,
                key_ref: None,
                group_id: None,
                tags: vec!["prod".into()],
                accent: None,
                term_scheme: None,
                host_key_fingerprint: Some("SHA256:abc".into()),
                password: Some("hunter2".into()),
                passphrase: None,
                private_key: None,
            }],
            groups: vec![],
        }
    }

    fn seal(payload: &BackupPayload, passphrase: &str) -> Envelope {
        let plaintext = serde_json::to_vec(payload).unwrap();
        let salt = [7u8; SALT_LEN];
        let nonce = [9u8; NONCE_LEN];
        let kdf = KdfParams {
            algorithm: KDF_ALGORITHM.into(),
            memory_kib: MIN_MEMORY_KIB,
            iterations: 1,
            parallelism: 1,
            salt_b64: B64.encode(salt),
        };
        let mut envelope = Envelope {
            format: FORMAT.into(),
            version: VERSION,
            created_at_unix: 1_700_000_000,
            app_version: "test".into(),
            kdf: kdf.clone(),
            cipher: CIPHER.into(),
            nonce_b64: B64.encode(nonce),
            ciphertext_b64: String::new(),
        };
        let key = derive_key(passphrase, &salt, &kdf).unwrap();
        let cipher = XChaCha20Poly1305::new_from_slice(key.as_ref()).unwrap();
        let ct = cipher
            .encrypt(
                XNonce::from_slice(&nonce),
                AeadPayload {
                    msg: &plaintext,
                    aad: &associated_data(&envelope),
                },
            )
            .unwrap();
        envelope.ciphertext_b64 = B64.encode(ct);
        envelope
    }

    fn write_temp(envelope: &Envelope, name: &str) -> PathBuf {
        let path = std::env::temp_dir().join(name);
        fs::write(&path, serde_json::to_vec(envelope).unwrap()).unwrap();
        path
    }

    #[test]
    fn round_trip_recovers_secrets() {
        let path = write_temp(&seal(&sample_payload(), "correct horse"), "terctl-rt.json");
        let out = decrypt_file(&path, "correct horse").unwrap();
        assert_eq!(out.hosts.len(), 1);
        assert_eq!(out.hosts[0].password.as_deref(), Some("hunter2"));
        fs::remove_file(&path).ok();
    }

    #[test]
    fn wrong_passphrase_is_rejected() {
        let path = write_temp(&seal(&sample_payload(), "correct horse"), "terctl-wp.json");
        assert!(decrypt_file(&path, "wrong horse").is_err());
        fs::remove_file(&path).ok();
    }

    #[test]
    fn kdf_downgrade_is_rejected() {
        // The classic attack: rewrite the cost parameters in the plaintext
        // header so the file can be cracked cheaply. The AAD binding must
        // make the ciphertext undecryptable rather than merely weaker.
        let mut envelope = seal(&sample_payload(), "correct horse");
        envelope.kdf.iterations = 1;
        envelope.kdf.memory_kib = MIN_MEMORY_KIB * 2;
        let path = write_temp(&envelope, "terctl-dg.json");
        let err = decrypt_file(&path, "correct horse").unwrap_err();
        assert!(err.contains("modified"), "unexpected error: {err}");
        fs::remove_file(&path).ok();
    }

    #[test]
    fn tampered_hostname_is_rejected() {
        let mut envelope = seal(&sample_payload(), "correct horse");
        let mut ct = B64.decode(&envelope.ciphertext_b64).unwrap();
        ct[10] ^= 0x01;
        envelope.ciphertext_b64 = B64.encode(ct);
        let path = write_temp(&envelope, "terctl-tp.json");
        assert!(decrypt_file(&path, "correct horse").is_err());
        fs::remove_file(&path).ok();
    }

    #[test]
    fn absurd_kdf_parameters_are_clamped_before_use() {
        let mut envelope = seal(&sample_payload(), "correct horse");
        envelope.kdf.memory_kib = 4 * 1024 * 1024; // 4 GiB
        let path = write_temp(&envelope, "terctl-oom.json");
        let err = decrypt_file(&path, "correct horse").unwrap_err();
        assert!(err.contains("unusable KDF"), "unexpected error: {err}");
        fs::remove_file(&path).ok();
    }

    #[test]
    fn control_characters_in_labels_are_rejected() {
        let mut payload = sample_payload();
        payload.hosts[0].label = "prod\u{1b}[2Jwiped".into();
        assert!(validate_payload(&payload).is_err());
    }

    #[test]
    fn group_cycles_are_rejected() {
        let payload = BackupPayload {
            hosts: vec![],
            groups: vec![
                Group {
                    id: "a".into(),
                    name: "A".into(),
                    parent_id: Some("b".into()),
                },
                Group {
                    id: "b".into(),
                    name: "B".into(),
                    parent_id: Some("a".into()),
                },
            ],
        };
        assert!(validate_payload(&payload).is_err());
    }

    #[test]
    fn import_skips_hosts_that_already_exist() {
        let payload = sample_payload();
        let existing = vec![HostRecord {
            host: Host {
                id: "different-id".into(),
                label: "Prod (local)".into(),
                hostname: "10.0.0.5".into(),
                port: 22,
                username: "deploy".into(),
                auth_kind: AuthKind::Password,
                key_ref: None,
                group_id: None,
                tags: vec![],
                accent: None,
                term_scheme: None,
                os: None,
            },
            host_key_fingerprint: Some("SHA256:different".into()),
        }];

        let plan = plan_import(&payload, &existing, &[]);
        assert_eq!(plan.hosts.len(), 0);
        assert_eq!(plan.summary.hosts_skipped_duplicate, vec!["Prod".to_string()]);
        assert_eq!(plan.summary.fingerprint_conflicts, vec!["Prod".to_string()]);
        assert!(plan.secrets.is_empty(), "skipped hosts must not touch the keychain");
    }

    #[test]
    fn import_adds_new_hosts_with_their_secrets() {
        let plan = plan_import(&sample_payload(), &[], &[]);
        assert_eq!(plan.hosts.len(), 1);
        assert_eq!(plan.hosts[0].1.as_deref(), Some("SHA256:abc"));
        assert_eq!(plan.secrets.len(), 1);
        assert_eq!(plan.secrets[0].1, SecretKind::Password);
    }

    #[test]
    fn key_auth_without_material_is_flagged() {
        let mut payload = sample_payload();
        payload.hosts[0].auth_kind = AuthKind::Key;
        payload.hosts[0].password = None;
        payload.hosts[0].key_ref = Some("~/.ssh/id_ed25519".into());
        let plan = plan_import(&payload, &[], &[]);
        assert_eq!(plan.summary.needs_credentials, vec!["Prod".to_string()]);
    }

    #[test]
    fn nested_groups_reuse_local_twins_by_name() {
        let payload = BackupPayload {
            hosts: vec![],
            groups: vec![
                Group {
                    id: "imported-root".into(),
                    name: "Production".into(),
                    parent_id: None,
                },
                Group {
                    id: "imported-child".into(),
                    name: "Databases".into(),
                    parent_id: Some("imported-root".into()),
                },
            ],
        };
        let existing = vec![Group {
            id: "local-root".into(),
            name: "Production".into(),
            parent_id: None,
        }];

        let plan = plan_import(&payload, &[], &existing);
        assert_eq!(plan.groups.len(), 1, "only the child should be new");
        assert_eq!(plan.groups[0].name, "Databases");
        assert_eq!(
            plan.groups[0].parent_id.as_deref(),
            Some("local-root"),
            "child must reparent onto the existing local group"
        );
    }
}
