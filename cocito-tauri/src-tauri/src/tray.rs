//! Tray icon (bandeja do SO).
//!
//! Mostra o ícone do Cocito com um menu rápido: Abrir/Ocultar janela,
//! Preferências, Sair. Contagem de unreads fica para v1.1 (requer uma
//! forma de gerar ícones com badge em runtime).

use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager,
};

pub fn setup(app: &AppHandle) -> tauri::Result<()> {
    let open_item = MenuItem::with_id(app, "open", "Abrir Cocito", true, None::<&str>)?;
    let prefs_item = MenuItem::with_id(app, "prefs", "Preferências…", true, Some("Cmd+,"))?;
    let quit_item = MenuItem::with_id(app, "quit", "Sair", true, Some("Cmd+Q"))?;
    let separator = PredefinedMenuItem::separator(app)?;

    let menu = Menu::with_items(
        app,
        &[&open_item, &prefs_item, &separator, &quit_item],
    )?;

    let _tray: TrayIcon = TrayIconBuilder::with_id("cocito-tray")
        .tooltip("Cocito")
        .icon(app.default_window_icon().cloned().unwrap())
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open" => {
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.show();
                    let _ = win.set_focus();
                }
            }
            "prefs" => {
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.show();
                    let _ = win.set_focus();
                    let _ = win.emit("tray:open-preferences", ());
                }
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            // Clique esquerdo normal = toggle da janela principal.
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(win) = app.get_webview_window("main") {
                    if win.is_visible().unwrap_or(false) {
                        let _ = win.hide();
                    } else {
                        let _ = win.show();
                        let _ = win.set_focus();
                    }
                }
            }
        })
        .build(app)?;

    Ok(())
}

/// Atualiza o título visível do tray icon — no macOS aparece à direita do ícone.
/// Chamar com Some("12") mostra "12", com None limpa.
#[tauri::command]
pub fn cmd_tray_set_unread(handle: AppHandle, total: u32) -> Result<(), String> {
    if let Some(tray) = handle.tray_by_id("cocito-tray") {
        let title = if total == 0 {
            None
        } else if total > 99 {
            Some("99+".to_string())
        } else {
            Some(total.to_string())
        };
        tray.set_title(title.as_deref()).map_err(|e| e.to_string())?;
    }
    Ok(())
}
