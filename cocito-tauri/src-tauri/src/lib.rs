//! Cocito · processo nativo (lado Rust).
//!
//! Tudo corre na máquina do utilizador. Sem servidores, sem cloud.
//! Os nomes dos submódulos vêm do Inferno — ver ../cocito-revival-plan.md §4.

mod config;
mod keychain;
mod modules;
mod secure_fs;
mod tray;

use crate::tray::cmd_tray_set_unread;

use tauri::Manager;
use tracing_subscriber::{fmt, EnvFilter};

use crate::config::ConfigState;
use crate::modules::{beatriz, caronte, cerbero, malebolge, messo, minos, scriptorium, sync, virgilio};
use crate::modules::minos::MinosState;
use crate::modules::virgilio::VirgilioState;

/// Ponto de entrada invocado pelo `main.rs`. Separado assim para podermos ter
/// a crate como `rlib` e reusar em testes.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    init_tracing();

    // Plugins removidos intencionalmente:
    //   · tauri-plugin-shell — injetava `shell.open` polyfill nas svc:* webviews,
    //     que tentava sobrescrever `window.open`; conflito com o nosso init-script.
    //   · tauri-plugin-notification — injetava `Notification` polyfill nas svc:*
    //     webviews, que tentava invocar `notification.is_permission_granted` sem
    //     permission. Notifs nativas vão por `notify-rust` directo no Cérbero.
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        // URI scheme custom — ponte JS(webview external) → Rust sem depender
        // de `window.__TAURI__` que só existe em webviews "Tauri-aware".
        .register_uri_scheme_protocol("cocito-ipc", cerbero::handle_ipc_request)
        .setup(|app| {
            let handle = app.handle().clone();

            // Menu nativo macOS — sem ele, o AppKit não restaura o key-event
            // chain que o WKWebView precisa para `interpretKeyEvents:` processar
            // dead keys (´+e → é). Sintoma: o primeiro acento de uma frase
            // desaparece em qualquer input dentro das svc:* webviews.
            #[cfg(target_os = "macos")]
            {
                use tauri::menu::{AboutMetadataBuilder, MenuBuilder, SubmenuBuilder};
                let about_meta = AboutMetadataBuilder::new()
                    .name(Some("Cocito"))
                    .version(Some(env!("CARGO_PKG_VERSION")))
                    .copyright(Some("© 2026 Fagner Cândido"))
                    .build();
                let app_menu = SubmenuBuilder::new(app, "Cocito")
                    .about(Some(about_meta))
                    .separator()
                    .services()
                    .separator()
                    .hide()
                    .hide_others()
                    .show_all()
                    .separator()
                    .quit()
                    .build()?;
                let edit_menu = SubmenuBuilder::new(app, "Edit")
                    .undo()
                    .redo()
                    .separator()
                    .cut()
                    .copy()
                    .paste()
                    .select_all()
                    .build()?;
                let menu = MenuBuilder::new(app)
                    .items(&[&app_menu, &edit_menu])
                    .build()?;
                app.set_menu(menu)?;
            }

            // Config do utilizador.
            let config = ConfigState::load_or_default(&handle)?;
            app.manage(config);

            // Regras do Minos (rules.json).
            let minos_state = MinosState::load_or_default(&handle)?;
            app.manage(minos_state);

            // Indexador Virgílio (SQLite, opcionalmente encriptado via SQLCipher).
            let cfg_snapshot = handle
                .state::<ConfigState>()
                .snapshot();
            let virgilio_state = if cfg_snapshot.virgilio.encryption_enabled {
                VirgilioState::open_encrypted(&handle)
                    .map_err(|e| {
                        tracing::error!("Virgílio · falha a abrir encriptado: {e}");
                        e
                    })?
            } else {
                VirgilioState::open(&handle)?
            };

            // Aplica retenção configurada (apaga eventos antigos no arranque).
            if let Some(days) = cfg_snapshot.virgilio.retention_days {
                if days > 0 {
                    match virgilio_state.prune(days) {
                        Ok(n) if n > 0 => tracing::info!("Virgílio · prune: {n} linhas antigas"),
                        Ok(_) => {}
                        Err(e) => tracing::warn!("Virgílio · prune falhou: {e}"),
                    }
                }
            }
            app.manage(virgilio_state);

            // Prepara a árvore de partitions (Malebolge).
            malebolge::ensure_root_dir(&handle)?;

            // Regista as event pipes do Cérbero (JS → Rust → subscritores).
            cerbero::install(&handle)?;

            // Discovery do Ollama (Messo) — mDNS + localhost fallback.
            messo::install(&handle);

            // Beatriz proativa: subscreve cerbero:event para detectar bursts.
            beatriz::install_proactive(&handle);

            // Sync watcher: deteta config/rules mudados externamente (Syncthing).
            if let Err(e) = sync::install_watcher(&handle) {
                tracing::warn!("Sync watcher falhou: {e}");
            }

            // Tray icon na bandeja do SO.
            tray::setup(&handle)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            config::cmd_get_config,
            config::cmd_set_appearance,
            config::cmd_list_services,
            config::cmd_add_instance,
            config::cmd_remove_instance,
            config::cmd_reorder_instances,
            config::cmd_set_active_instance,
            caronte::cmd_open_service,
            caronte::cmd_close_service,
            caronte::cmd_show_service,
            caronte::cmd_hide_service,
            caronte::cmd_reload_service,
            malebolge::cmd_partition_path,
            minos::cmd_list_rules,
            minos::cmd_rules_active_count,
            minos::cmd_save_rules,
            scriptorium::cmd_save_breadcrumb,
            scriptorium::cmd_save_quote,
            scriptorium::cmd_save_page_markdown,
            virgilio::cmd_virgilio_count,
            virgilio::cmd_virgilio_search,
            messo::cmd_messo_hosts,
            messo::cmd_messo_probe,
            beatriz::cmd_beatriz_list_models,
            beatriz::cmd_beatriz_generate,
            config::cmd_set_scriptorium_vault,
            config::cmd_set_downloads,
            config::cmd_set_unread,
            cmd_tray_set_unread,
            sync::cmd_sync_status,
            sync::cmd_sync_export,
            sync::cmd_sync_import,
            cerbero::cmd_emit_from_webview,
        ])
        .run(tauri::generate_context!())
        .expect("falha a arrancar o Cocito");
}

fn init_tracing() {
    let filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("info,cocito=debug"));

    fmt()
        .with_env_filter(filter)
        .with_target(true)
        .compact()
        .init();

    tracing::info!("Cocito · lado Rust pronto · {}", env!("CARGO_PKG_VERSION"));
}
