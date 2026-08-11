mod backup;
mod commands;
mod local_term;
mod metrics;
mod models;
mod session;
mod sftp;
mod ssh;
mod store;
mod vault;

use metrics::MetricsManager;
use session::SessionManager;
use sftp::SftpManager;
use store::Store;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("failed to resolve app data dir");
            std::fs::create_dir_all(&app_data_dir).expect("failed to create app data dir");
            let store = Store::new(&app_data_dir.join("terctl.db"))
                .expect("failed to initialize host store");
            app.manage(store);
            app.manage(SessionManager::default());
            app.manage(SftpManager::default());
            app.manage(MetricsManager::default());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::list_hosts,
            commands::add_host,
            commands::update_host,
            commands::delete_host,
            commands::list_tags,
            commands::list_groups,
            commands::add_group,
            commands::rename_group,
            commands::delete_group,
            commands::save_credential,
            commands::has_credential,
            commands::delete_credential,
            commands::frontend_log,
            backup::backup_preview,
            backup::inspect_backup,
            backup::export_config,
            backup::import_config,
            ssh::ssh_connect,
            local_term::local_connect,
            session::term_send_input,
            session::term_resize,
            session::term_disconnect,
            sftp::sftp_home,
            sftp::sftp_list,
            sftp::sftp_download,
            sftp::sftp_upload,
            sftp::sftp_mkdir,
            sftp::sftp_rename,
            sftp::sftp_remove,
            sftp::sftp_cancel_transfer,
            sftp::sftp_disconnect,
            sftp::local_home,
            sftp::local_list,
            sftp::local_mkdir,
            sftp::local_rename,
            sftp::local_remove,
            metrics::ssh_metrics,
            metrics::metrics_disconnect,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
