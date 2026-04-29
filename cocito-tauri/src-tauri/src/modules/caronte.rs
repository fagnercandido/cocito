//! Caronte · lifecycle das WebViews.
//!
//! "Caron dimonio, con occhi di bragia, / loro accennando, tutte le raccoglie."
//! — Inferno · III · 109–110
//!
//! Caronte transporta o utilizador entre bolgie. Em Tauri, é o módulo que
//! cria/destrói WebViews, aplica UA spoofing per-service, e gere show/hide
//! para o layout Franz-style (uma janela, N WebViews empilhadas).
//!
//! **Chave arquitetural:** cada WebView recebe o seu `data_directory` vindo
//! do Malebolge. Isso isola cookies/storage nativamente — é a forma mais
//! robusta de isolamento que o Tauri 2 oferece.

use std::path::PathBuf;
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::{
    webview::{DownloadEvent, WebviewBuilder},
    AppHandle, LogicalPosition, LogicalSize, Manager, WebviewUrl,
};

use crate::config::ConfigState;
use crate::modules::malebolge;

/// Init-script universal do Cérbero (Notification interception).
/// Empacotado no binário em build-time via `include_str!`.
const INIT_SCRIPT: &str = include_str!("../../../init-scripts/notification-intercept.js");

// ─── Payload vindo do frontend ───────────────────────────────────────

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenRequest {
    /// ID único da instância (ex: `slack-work`, `gmail-personal`).
    pub instance_id: String,
    /// URL inicial do serviço.
    pub url: String,
    /// UA a aplicar (cobre browsers que redirecionam Safari/WebView para versões reduzidas).
    pub user_agent: String,
    /// Posição e tamanho dentro da janela principal. O frontend passa o bounding-box
    /// da área central (o `<main>` que envolve a WebView), em pixels lógicos.
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

// ─── State local (qual instância está visível) ───────────────────────

#[derive(Default)]
struct CaronteState {
    active: Option<String>,
}

fn state(handle: &AppHandle) -> &'static Mutex<CaronteState> {
    use std::sync::OnceLock;
    static STATE: OnceLock<Mutex<CaronteState>> = OnceLock::new();
    STATE.get_or_init(|| Mutex::new(CaronteState::default()));
    // `handle` reservado para futuro; por ora state global basta.
    let _ = handle;
    STATE.get().unwrap()
}

// ─── Commands ────────────────────────────────────────────────────────

/// Cria a WebView para um serviço se ainda não existir e coloca-a na posição
/// pedida. Se já existir, atualiza tamanho/posição e traz à frente.
#[tauri::command]
pub fn cmd_open_service(handle: AppHandle, req: OpenRequest) -> Result<(), String> {
    if !is_safe_instance_id(&req.instance_id) {
        return Err("instance_id inválido".into());
    }
    // Validar URL: só http/https/file de instances do catálogo (futuro: app://).
    let scheme_ok = req.url.starts_with("http://") || req.url.starts_with("https://");
    if !scheme_ok {
        return Err(format!("URL com scheme não permitido: {}", req.url));
    }
    let label = webview_label(&req.instance_id);

    // Malebolge: partition isolado para esta instância.
    let partition = malebolge::partition_dir(&handle, &req.instance_id)
        .map_err(|e| format!("a preparar partition: {e}"))?;

    let main_window = handle
        .get_window("main")
        .ok_or_else(|| "janela main não encontrada".to_string())?;

    // Se já existe, só reposiciona e mostra.
    if let Some(existing) = handle.get_webview(&label) {
        existing
            .set_position(LogicalPosition::new(req.x, req.y))
            .map_err(|e| e.to_string())?;
        existing
            .set_size(LogicalSize::new(req.width, req.height))
            .map_err(|e| e.to_string())?;
        existing.show().map_err(|e| e.to_string())?;
        remember_active(&handle, &req.instance_id);
        return Ok(());
    }

    // Cria a WebView embedded na janela principal.
    let parsed = tauri::Url::parse(&req.url).map_err(|e| format!("URL inválida: {e}"))?;
    let url = WebviewUrl::External(parsed);
    let dl_handle = handle.clone();
    let mut builder = WebviewBuilder::new(&label, url)
        .user_agent(&req.user_agent)
        .initialization_script(INIT_SCRIPT)
        .auto_resize()
        // Gmail/Outlook/Slack precisam: copy/paste, drag-drop de imagens, etc.
        .enable_clipboard_access()
        // Hook de downloads — vê `resolve_download_destination` para a
        // política de pasta (auto / fixed / ask).
        .on_download(move |_webview, event| match event {
            DownloadEvent::Requested { url, destination } => {
                if let Some(new_dest) = resolve_download_destination(&dl_handle, &destination) {
                    *destination = new_dest;
                }
                tracing::info!("Caronte · download {} → {}", url, destination.display());
                true
            }
            DownloadEvent::Finished { url, path, success } => {
                tracing::info!(
                    "Caronte · download finished url={} path={:?} ok={}",
                    url,
                    path,
                    success
                );
                true
            }
            _ => true,
        });

    // Isolamento de session.
    //
    // - **Linux / Windows**: `data_directory` → Malebolge.
    // - **macOS**: WKWebView ignora `data_directory`. A única forma de ter
    //   cookies/IndexedDB isolados é `data_store_identifier` (macOS 14+),
    //   que faz `WKWebsiteDataStore::dataStoreForIdentifier`. Sem isto, todas
    //   as instâncias caem no `defaultDataStore` global e partilham sessão.
    //   O UUID é v5 (determinístico a partir do `instance_id`), por isso
    //   permanece estável entre launches.
    #[cfg(not(target_os = "macos"))]
    {
        builder = builder.data_directory(partition);
    }
    #[cfg(target_os = "macos")]
    {
        let _ = partition; // silencia unused em macOS
        builder = builder.data_store_identifier(data_store_uuid(&req.instance_id));
    }

    main_window
        .add_child(
            builder,
            LogicalPosition::new(req.x, req.y),
            LogicalSize::new(req.width, req.height),
        )
        .map_err(|e| format!("falha a criar WebView: {e}"))?;

    remember_active(&handle, &req.instance_id);
    tracing::info!("Caronte · abriu {label} em ({:.0},{:.0})", req.x, req.y);
    Ok(())
}

#[tauri::command]
pub fn cmd_close_service(handle: AppHandle, instance_id: String) -> Result<(), String> {
    if !is_safe_instance_id(&instance_id) {
        return Err("instance_id inválido".into());
    }
    let label = webview_label(&instance_id);
    if let Some(wv) = handle.get_webview(&label) {
        wv.close().map_err(|e| e.to_string())?;
        tracing::info!("Caronte · fechou {label}");
    }
    Ok(())
}

#[tauri::command]
pub fn cmd_show_service(handle: AppHandle, instance_id: String) -> Result<(), String> {
    if !is_safe_instance_id(&instance_id) {
        return Err("instance_id inválido".into());
    }
    // Esconde todas as outras, mostra a pedida.
    let label = webview_label(&instance_id);
    let labels_to_hide: Vec<String> = handle
        .webviews()
        .keys()
        .filter(|k| k.starts_with("svc:") && **k != label)
        .cloned()
        .collect();

    for l in labels_to_hide {
        if let Some(wv) = handle.get_webview(&l) {
            let _ = wv.set_position(LogicalPosition::new(-20000.0, -20000.0));
            let _ = wv.set_size(LogicalSize::new(1.0, 1.0));
            let _ = wv.hide();
        }
    }

    if let Some(wv) = handle.get_webview(&label) {
        wv.show().map_err(|e| e.to_string())?;
        remember_active(&handle, &instance_id);
    }

    Ok(())
}

/// Força o reload (⌘R) da WebView de uma instância.
///
/// Validamos `instance_id` contra o mesmo regex seguro do Cérbero: o frontend
/// é nosso, mas defesa em profundidade caso um command malicioso (ex: futura
/// extensão MCP) tente passar um ID forjado.
#[tauri::command]
pub fn cmd_reload_service(handle: AppHandle, instance_id: String) -> Result<(), String> {
    if !is_safe_instance_id(&instance_id) {
        return Err("instance_id inválido".into());
    }
    let label = webview_label(&instance_id);
    if let Some(wv) = handle.get_webview(&label) {
        // `eval` num literal estático seguro (sem interpolação de input do utilizador).
        wv.eval("window.location.reload()").map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn is_safe_instance_id(s: &str) -> bool {
    !s.is_empty()
        && s.len() <= 128
        && s.chars().all(|c| matches!(c, 'a'..='z' | '0'..='9' | '-'))
}

/// Esconde uma WebView específica (usada quando overlays React abrem).
///
/// Triple protection: no macOS, `hide()` sobre webviews embedded pode deixar
/// frames residuais a renderizar por cima da janela React. Mover para fora
/// do viewport + colapsar tamanho + hide garante que nada sobrevive.
#[tauri::command]
pub fn cmd_hide_service(handle: AppHandle, instance_id: String) -> Result<(), String> {
    if !is_safe_instance_id(&instance_id) {
        return Err("instance_id inválido".into());
    }
    let label = webview_label(&instance_id);
    if let Some(wv) = handle.get_webview(&label) {
        let _ = wv.set_position(LogicalPosition::new(-20000.0, -20000.0));
        let _ = wv.set_size(LogicalSize::new(1.0, 1.0));
        let _ = wv.hide();
    }
    Ok(())
}

// ─── Helpers ────────────────────────────────────────────────────────

fn webview_label(instance_id: &str) -> String {
    format!("svc:{instance_id}")
}

/// UUID v5 determinístico a partir do `instance_id` — usado em macOS como
/// identificador do `WKWebsiteDataStore` por instância. Um instance_id estável
/// → mesmo UUID → mesma store entre launches → sessão persiste.
#[cfg(target_os = "macos")]
fn data_store_uuid(instance_id: &str) -> [u8; 16] {
    // Namespace fixo do Cocito (UUID v4 arbitrário, gerado uma vez). Não mudar
    // — alterá-lo invalidaria todas as sessões existentes.
    const COCITO_NS: uuid::Uuid = uuid::Uuid::from_bytes([
        0x7a, 0x3f, 0x5e, 0x1c, 0x4d, 0x2b, 0x4a, 0x8e, 0x9f, 0x60, 0xc0, 0xc1, 0x70, 0xda, 0x57,
        0xe0,
    ]);
    *uuid::Uuid::new_v5(&COCITO_NS, instance_id.as_bytes()).as_bytes()
}

fn remember_active(handle: &AppHandle, instance_id: &str) {
    if let Ok(mut s) = state(handle).lock() {
        s.active = Some(instance_id.to_string());
    }
}

// ─── Política de downloads ──────────────────────────────────────────
//
// O WebKit propõe um `destination` default — tipicamente já é `~/Downloads/<file>`.
// Honramos esse default no modo "auto" (devolvemos `None`, não mexemos). Nos
// modos "fixed" e "ask" reescrevemos.
//
// "ask" abre `rfd::FileDialog::save_file()` síncrono. Bloqueia a thread do
// download handler — é OK porque o handler corre numa worker thread do wry,
// não na main UI thread.
fn resolve_download_destination(handle: &AppHandle, default_dest: &PathBuf) -> Option<PathBuf> {
    let cfg = handle.try_state::<ConfigState>()?.snapshot();
    let mode = cfg.downloads.mode.as_str();
    let filename = default_dest
        .file_name()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_else(|| "download".to_string());

    match mode {
        "auto" => None, // mantém o default (Downloads do SO)
        "fixed" => {
            let folder = cfg
                .downloads
                .path
                .as_ref()
                .map(PathBuf::from)
                .or_else(|| dirs::download_dir())?;
            // Garante que o diretório existe; se falhar, devolve None e WebKit
            // usa o default — fail-safe.
            if std::fs::create_dir_all(&folder).is_err() {
                tracing::warn!(
                    "downloads · não consegui criar {} — caindo no default",
                    folder.display()
                );
                return None;
            }
            Some(folder.join(&filename))
        }
        "ask" => {
            let initial_dir = cfg
                .downloads
                .path
                .as_ref()
                .map(PathBuf::from)
                .or_else(|| dirs::download_dir())
                .unwrap_or_else(|| PathBuf::from("."));
            let chosen = rfd::FileDialog::new()
                .set_title("Guardar como")
                .set_directory(&initial_dir)
                .set_file_name(&filename)
                .save_file();
            chosen
        }
        _ => None,
    }
}

