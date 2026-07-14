use crate::models::{Group, Host, NewHost};
use crate::store::Store;
use crate::vault::{self, SecretKind};
use tauri::State;

#[tauri::command]
pub fn list_hosts(store: State<Store>) -> Result<Vec<Host>, String> {
    store.list_hosts().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn add_host(store: State<Store>, new_host: NewHost) -> Result<Host, String> {
    store.add_host(new_host).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_host(store: State<Store>, host: Host) -> Result<(), String> {
    store.update_host(host).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_host(store: State<Store>, id: String) -> Result<(), String> {
    store.delete_host(&id).map_err(|e| e.to_string())?;
    vault::delete_all_secrets(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_tags(store: State<Store>) -> Result<Vec<String>, String> {
    store.list_tags().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_groups(store: State<Store>) -> Result<Vec<Group>, String> {
    store.list_groups().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn add_group(
    store: State<Store>,
    name: String,
    parent_id: Option<String>,
) -> Result<Group, String> {
    store
        .add_group(&name, parent_id.as_deref())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn rename_group(store: State<Store>, id: String, name: String) -> Result<(), String> {
    store.rename_group(&id, &name).map_err(|e| e.to_string())
}

/// Deletes a group and ungroups its hosts — it does not delete them.
#[tauri::command]
pub fn delete_group(store: State<Store>, id: String) -> Result<(), String> {
    store.delete_group(&id).map_err(|e| e.to_string())
}

fn parse_kind(kind: &str) -> Result<SecretKind, String> {
    SecretKind::from_str(kind).ok_or_else(|| format!("unknown secret kind: {kind}"))
}

/// Stores a secret in the OS keychain. The frontend sends the raw value once;
/// it is never returned by any command afterwards.
#[tauri::command]
pub fn save_credential(host_id: String, kind: String, value: String) -> Result<(), String> {
    let kind = parse_kind(&kind)?;
    vault::set_secret(&host_id, kind, &value).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn has_credential(host_id: String, kind: String) -> Result<bool, String> {
    let kind = parse_kind(&kind)?;
    vault::has_secret(&host_id, kind).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_credential(host_id: String, kind: String) -> Result<(), String> {
    let kind = parse_kind(&kind)?;
    vault::delete_secret(&host_id, kind).map_err(|e| e.to_string())
}

/// Temporary debug bridge: forwards frontend console/errors to this
/// process's stderr, since the WebView's own devtools console isn't
/// otherwise visible from outside the app.
#[tauri::command]
pub fn frontend_log(message: String) {
    eprintln!("[frontend] {message}");
}
