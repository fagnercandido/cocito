//! Cérbero · backbone event-driven.
//!
//! "Cerbero, fiera crudele e diversa, / con tre gole caninamente latra."
//! — Inferno · VI · 13–14
//!
//! Cérbero tem três gargantas (§5 do plano):
//!   1. **Injecção** · init-script universal faz override de `window.Notification`
//!      e `ServiceWorkerRegistration.showNotification` em cada WebView.
//!   2. **Transporte** · webviews external não têm `window.__TAURI__`, então o
//!      init-script envia via `fetch("cocito-ipc://emit", ...)`. Este módulo
//!      regista esse URI scheme no Tauri Builder e intercepta os requests.
//!   3. **Bus** · uma vez parseada, a notif é republicada como evento Tauri global
//!      `cerbero:event` — Minos / Virgílio / Scriptorium / Beatriz subscrevem.

use std::borrow::Cow;
use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use tauri::{http, AppHandle, Emitter, Listener, Manager, UriSchemeContext, Wry};

use crate::modules::minos::{self, MinosState};
use crate::modules::virgilio::VirgilioState;

/// Cooldown por (instance, kind) para evitar avalanche de eventos title.
/// Slack pode disparar 30+ updates de title por segundo durante notification storms.
const TITLE_DEBOUNCE: Duration = Duration::from_millis(200);

/// Tamanho máximo aceite num request ao URI scheme. Defesa contra DoS por
/// memória — uma webview comprometida não consegue afogar o processo Rust.
const MAX_IPC_BODY_BYTES: usize = 256 * 1024; // 256 KB

/// Tamanho máximo de campos visíveis (title/body). Defesa em profundidade —
/// limita o que vai para notif do SO, log e SQLite. SOs já truncam mas
/// preferimos controlar a sanitização nós.
const MAX_TITLE_LEN: usize = 200;
const MAX_BODY_LEN: usize = 2_000;
const MAX_URL_LEN: usize = 2_048;

/// Aceita só `[a-z0-9-]{1,128}` para instance/service IDs (defense-in-depth
/// contra forjas, mesmo que o JSON valide). Match exato com `Malebolge::sanitize_slug`.
fn is_safe_id(s: &str) -> bool {
    !s.is_empty()
        && s.len() <= 128
        && s.chars().all(|c| matches!(c, 'a'..='z' | '0'..='9' | '-'))
}

#[cfg(test)]
mod tests {
    use super::{is_safe_id, truncate_field};

    #[test]
    fn ids_validos() {
        assert!(is_safe_id("slack"));
        assert!(is_safe_id("slack-work"));
        assert!(is_safe_id("g-mail-personal-2"));
        assert!(is_safe_id(&"a".repeat(128)));
    }

    #[test]
    fn ids_invalidos() {
        assert!(!is_safe_id(""));
        assert!(!is_safe_id("Slack"));            // maiúscula
        assert!(!is_safe_id("slack work"));       // espaço
        assert!(!is_safe_id("slack/work"));       // separador path
        assert!(!is_safe_id("../etc"));           // path traversal
        assert!(!is_safe_id("slack;rm -rf"));     // shell injection
        assert!(!is_safe_id(&"a".repeat(129)));   // demasiado longo
    }

    #[test]
    fn truncate_respeita_utf8() {
        let s = "é".repeat(10); // 10 chars × 2 bytes = 20 bytes
        let cut = truncate_field(&s, 5);
        assert!(cut.is_char_boundary(cut.len()));
        assert!(cut.ends_with('…'));
    }

    #[test]
    fn truncate_devolve_intacto_se_couber() {
        assert_eq!(truncate_field("oi", 100), "oi");
    }
}

fn truncate_field(s: &str, max: usize) -> String {
    if s.len() <= max {
        s.to_string()
    } else {
        // Trunca no boundary char correto (UTF-8 safe).
        let mut end = max;
        while !s.is_char_boundary(end) {
            end -= 1;
        }
        format!("{}…", &s[..end])
    }
}

fn last_seen() -> &'static Mutex<HashMap<String, Instant>> {
    static MAP: OnceLock<Mutex<HashMap<String, Instant>>> = OnceLock::new();
    MAP.get_or_init(|| Mutex::new(HashMap::new()))
}

/// Mapa global title → instance_id das últimas N notifs mostradas pelo SO.
/// Usado pelo handler de cliques quando o SO reporta o título da notif clicada
/// (a única informação que o `tauri-plugin-notification` 2.x expõe nesta versão).
fn recent_notifs() -> &'static Mutex<std::collections::VecDeque<(String, String)>> {
    static MAP: OnceLock<Mutex<std::collections::VecDeque<(String, String)>>> = OnceLock::new();
    MAP.get_or_init(|| Mutex::new(std::collections::VecDeque::with_capacity(64)))
}

fn register_recent_notif(title: &str, instance: &str) {
    if let Ok(mut q) = recent_notifs().lock() {
        if q.len() >= 64 {
            q.pop_front();
        }
        q.push_back((title.to_string(), instance.to_string()));
    }
}

/// Procura o instance_id da notif com `title` igual ao recebido. Devolve None se
/// já foi removida do buffer (>64 notifs depois) ou se nunca foi vista.
pub fn lookup_instance_by_title(title: &str) -> Option<String> {
    let q = recent_notifs().lock().ok()?;
    q.iter()
        .rev()
        .find(|(t, _)| t == title)
        .map(|(_, i)| i.clone())
}

fn should_debounce(notif: &CocitoNotification) -> bool {
    if notif.kind.as_deref() != Some("title") {
        return false;
    }
    let key = format!("{}::title", notif.instance);
    let mut map = match last_seen().lock() {
        Ok(g) => g,
        Err(_) => return false,
    };
    let now = Instant::now();
    if let Some(last) = map.get(&key) {
        if now.duration_since(*last) < TITLE_DEBOUNCE {
            return true;
        }
    }
    map.insert(key, now);
    false
}

/// Evento tal como chega do init-script no JS.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CocitoNotification {
    /// ID do serviço (catálogo). Ex: `slack`, `gmail`.
    pub service: String,
    /// ID da instância (ex: `slack-work`). Preenchido pelo init-script a partir
    /// de `window.__COCITO_INSTANCE_ID__` (injetado pelo Caronte antes do carregamento).
    pub instance: String,
    pub timestamp: u64,
    pub title: String,
    #[serde(default)]
    pub body: Option<String>,
    #[serde(default)]
    pub tag: Option<String>,
    #[serde(default)]
    pub icon: Option<String>,
    #[serde(default)]
    pub url: Option<String>,
    /// Discrimina tipos de evento. "title" = mudança em document.title;
    /// ausente/qualquer outro = notificação real (showNotification).
    #[serde(default)]
    pub kind: Option<String>,
}

/// Instala os listeners do Cérbero (lado Rust).
///
/// Observa eventos internos `cocito:notification` (emitidos pela webview React
/// via invoke ou pelo próprio handler do URI scheme) e re-publica `cerbero:event`.
pub fn install(handle: &AppHandle) -> anyhow::Result<()> {
    let h = handle.clone();
    handle.listen("cocito:notification", move |evt| {
        process_raw_payload(&h, evt.payload());
    });

    // Scriptorium: as svc:* webviews emitem via Tauri events em vez do
    // URI scheme (mixed content). Encaminhamos para os mesmos handlers.
    let h_q = handle.clone();
    handle.listen("cocito:scriptorium-save-quote", move |evt| {
        dispatch_scriptorium(&h_q, evt.payload(), true);
    });
    let h_b = handle.clone();
    handle.listen("cocito:scriptorium-save-breadcrumb", move |evt| {
        dispatch_scriptorium(&h_b, evt.payload(), false);
    });

    // Cérbero v2 · click handler.
    // tauri-plugin-notification 2.x emite `notification-action-performed` em
    // alguns SOs; outros emitem `notification-clicked`. Apanhamos ambos e
    // mapeamos via title → instance.
    let h2 = handle.clone();
    let click_handler = move |evt: tauri::Event| {
        let raw = evt.payload();
        // O payload pode ter shape `{ title: "...", id: 42 }` ou só uma string.
        let title = serde_json::from_str::<serde_json::Value>(raw)
            .ok()
            .and_then(|v| {
                v.get("title")
                    .and_then(|t| t.as_str())
                    .map(|s| s.to_string())
            })
            .unwrap_or_else(|| raw.trim_matches('"').to_string());
        if let Some(instance) = lookup_instance_by_title(&title) {
            // Não logamos o title (pode conter conteúdo sensível) — só a instance.
            tracing::info!("Cérbero v2 · click → {instance}");
            let _ = h2.emit("cerbero:open-instance", &instance);
            if let Some(win) = h2.get_webview_window("main") {
                let _ = win.show();
                let _ = win.set_focus();
            }
        } else {
            tracing::debug!("Cérbero v2 · click sem match");
        }
    };
    handle.listen("notification-clicked", click_handler.clone());
    handle.listen("notification-action-performed", click_handler);

    tracing::info!("Cérbero · bus instalado");
    Ok(())
}

/// Handler do URI scheme `cocito-ipc://`. Registado no `tauri::Builder`, apanha
/// todos os requests que as webviews fazem para este esquema — incluindo webviews
/// external (Slack, Gmail) que não têm `window.__TAURI__`.
pub fn handle_ipc_request(
    ctx: UriSchemeContext<'_, Wry>,
    req: http::Request<Vec<u8>>,
) -> http::Response<Cow<'static, [u8]>> {
    // Preflight CORS para fetches cross-origin.
    // O scheme é registado pelo lado nativo, então qualquer página que use
    // `cocito-ipc://` foi necessariamente carregada por nós (Caronte → Webview
    // embedded). Permitimos `*` no Origin com confiança nesse facto.
    if req.method() == http::Method::OPTIONS {
        return http::Response::builder()
            .status(204)
            .header("Access-Control-Allow-Origin", "*")
            .header("Access-Control-Allow-Methods", "POST, OPTIONS")
            .header("Access-Control-Allow-Headers", "Content-Type")
            .body(Cow::Borrowed(&[][..]))
            .unwrap();
    }

    if req.method() == http::Method::POST {
        let body = req.body();
        if body.len() > MAX_IPC_BODY_BYTES {
            tracing::warn!(
                "cocito-ipc · body rejeitado ({} > {} bytes)",
                body.len(),
                MAX_IPC_BODY_BYTES
            );
            return http::Response::builder()
                .status(413) // Payload Too Large
                .header("Access-Control-Allow-Origin", "*")
                .body(Cow::Borrowed(&[][..]))
                .unwrap();
        }
        let payload = std::str::from_utf8(body).unwrap_or("");
        let path = req.uri().path();
        match path {
            "/emit" | "emit" | "/" | "" => {
                process_raw_payload(ctx.app_handle(), payload);
            }
            "/scriptorium/save-quote" => {
                dispatch_scriptorium(ctx.app_handle(), payload, true);
            }
            "/scriptorium/save-breadcrumb" => {
                dispatch_scriptorium(ctx.app_handle(), payload, false);
            }
            "/scriptorium/save-page" => {
                dispatch_scriptorium_page(ctx.app_handle(), payload);
            }
            other => {
                tracing::warn!("cocito-ipc · rota desconhecida: {other}");
            }
        }
    }

    http::Response::builder()
        .status(204)
        .header("Access-Control-Allow-Origin", "*")
        .body(Cow::Borrowed(&[][..]))
        .unwrap()
}

/// Custom command para webviews dos serviços enviarem eventos.
///
/// Por que existe: HTTPS pages (Gmail/Slack/etc.) não podem fazer fetch para
/// schemes não-HTTPS (mixed content). E os plugins built-in do Tauri (event,
/// shell, notification) requerem permissions per-plugin que escolhemos não
/// dar às svc:* webviews. Este custom command só precisa de `core:default`.
///
/// Tipos:
///   · "notification" → process_raw_payload (cocito:notification)
///   · "scriptorium-quote" → dispatch_scriptorium(true)
///   · "scriptorium-breadcrumb" → dispatch_scriptorium(false)
#[tauri::command]
pub fn cmd_emit_from_webview(handle: AppHandle, kind: String, payload: String) {
    if payload.len() > MAX_IPC_BODY_BYTES {
        tracing::warn!("emit_from_webview · payload demasiado grande");
        return;
    }
    match kind.as_str() {
        "notification" => process_raw_payload(&handle, &payload),
        "scriptorium-quote" => dispatch_scriptorium(&handle, &payload, true),
        "scriptorium-breadcrumb" => dispatch_scriptorium(&handle, &payload, false),
        "scriptorium-page" => dispatch_scriptorium_page(&handle, &payload),
        other => tracing::warn!("emit_from_webview · kind desconhecido: {other}"),
    }
}

fn dispatch_scriptorium_page(handle: &AppHandle, raw: &str) {
    match serde_json::from_str::<crate::modules::scriptorium::CapturePayload>(raw) {
        Ok(payload) => match crate::modules::scriptorium::save_page(handle, &payload) {
            Ok(Some(p)) => tracing::info!("Scriptorium · page guardada em {}", p.display()),
            Ok(None) => tracing::info!("Scriptorium · page ignorada (vault não config.)"),
            Err(e) => tracing::warn!("Scriptorium · save_page falhou: {e}"),
        },
        Err(e) => tracing::warn!("Scriptorium · payload page inválido: {e}"),
    }
}

fn dispatch_scriptorium(handle: &AppHandle, raw: &str, is_quote: bool) {
    match serde_json::from_str::<crate::modules::scriptorium::CapturePayload>(raw) {
        Ok(payload) => {
            let result = if is_quote {
                crate::modules::scriptorium::save_quote(handle, &payload)
            } else {
                crate::modules::scriptorium::save_breadcrumb(handle, &payload)
            };
            match result {
                Ok(Some(p)) => tracing::info!("Scriptorium · salvou em {}", p.display()),
                Ok(None) => tracing::info!("Scriptorium · vault não configurado"),
                Err(e) => tracing::warn!("Scriptorium · falhou: {e}"),
            }
        }
        Err(e) => tracing::warn!("Scriptorium · payload inválido ({e}): {raw}"),
    }
}

fn process_raw_payload(handle: &AppHandle, raw: &str) {
    match serde_json::from_str::<CocitoNotification>(raw) {
        Ok(mut notif) => {
            // 1. Validação de IDs (defesa contra forja).
            if !is_safe_id(&notif.service) || !is_safe_id(&notif.instance) {
                tracing::warn!(
                    "Cérbero · rejeitado: IDs inválidos (service={:?}, instance={:?})",
                    notif.service,
                    notif.instance
                );
                return;
            }

            // 2. Truncar campos longos (proteção do SO + SQLite + UI).
            notif.title = truncate_field(&notif.title, MAX_TITLE_LEN);
            if let Some(b) = &notif.body {
                notif.body = Some(truncate_field(b, MAX_BODY_LEN));
            }
            if let Some(u) = &notif.url {
                if u.len() > MAX_URL_LEN {
                    notif.url = Some(truncate_field(u, MAX_URL_LEN));
                }
            }

            // 3. Rate-limit: descarta title events demasiado frequentes.
            if should_debounce(&notif) {
                return;
            }

            // Logging só com IDs e kind (NÃO logar title nem body para não
            // vazar conteúdo sensível para stderr/journal/syslog).
            tracing::debug!(
                service = %notif.service,
                instance = %notif.instance,
                kind = ?notif.kind,
                title_len = notif.title.len(),
                "Cérbero · evento"
            );

            // Minos julga antes do SO saber.
            let verdict = handle
                .try_state::<MinosState>()
                .map(|s| minos::evaluate(&s, &notif))
                .unwrap_or_default();

            // Dispara notif nativa — exceto se regra silence, ou se for title event.
            // Usamos `notify-rust` directo em vez do tauri-plugin-notification
            // (que injetava polyfill em todas as webviews, conflituando com o nosso
            // `Notification` override no init-script do Cérbero).
            let is_title = notif.kind.as_deref() == Some("title");
            if !is_title && !verdict.silence && !notif.title.is_empty() {
                let mut n = notify_rust::Notification::new();
                n.summary(&notif.title);
                if let Some(body) = notif.body.as_deref() {
                    if !body.is_empty() {
                        n.body(body);
                    }
                }
                if let Some(sound) = &verdict.priority_sound {
                    n.sound_name(sound);
                }
                // App identifier para macOS/Linux agruparem corretamente.
                n.appname("Cocito");
                if let Err(e) = n.show() {
                    tracing::warn!("falha a mostrar notif nativa: {e}");
                } else {
                    register_recent_notif(&notif.title, &notif.instance);
                }

                // Frontend mantém um espelho para "abrir bolgia" via outras vias.
                let _ = handle.emit(
                    "cerbero:notif-shown",
                    serde_json::json!({
                        "instance": notif.instance,
                        "title": notif.title,
                        "url": notif.url,
                        "ts": notif.timestamp,
                    }),
                );
            }

            // Efeitos colaterais do Minos (set_theme, save_breadcrumb, …).
            minos::apply_side_effects(handle, &verdict);

            // Scriptorium: se o Minos pediu para guardar, materializa no vault.
            if verdict.save_breadcrumb_tag.is_some() || verdict.save_quote_tag.is_some() {
                let capture = crate::modules::scriptorium::CapturePayload {
                    service: notif.service.clone(),
                    instance: notif.instance.clone(),
                    url: notif.url.clone().unwrap_or_default(),
                    title: notif.title.clone(),
                    selection: notif.body.clone(),
                    content_md: None,
                    tag: None,
                };
                if let Some(tag) = &verdict.save_breadcrumb_tag {
                    let mut p = capture.clone();
                    p.tag = tag.clone();
                    let _ = crate::modules::scriptorium::save_breadcrumb(handle, &p);
                }
                if let Some(tag) = &verdict.save_quote_tag {
                    let mut p = capture.clone();
                    p.tag = tag.clone();
                    let _ = crate::modules::scriptorium::save_quote(handle, &p);
                }
            }

            // Virgílio: persiste para memória histórica + pesquisa futura.
            if let Some(virg) = handle.try_state::<VirgilioState>() {
                if let Err(e) = virg.ingest(&notif) {
                    tracing::warn!("Virgílio · ingest falhou: {e}");
                }
            }

            // Republica sempre — UI React atualiza badges; Virgílio indexa em v1.
            if let Err(e) = handle.emit("cerbero:event", &notif) {
                tracing::warn!("falha a republicar cerbero:event: {e}");
            }
        }
        Err(e) => {
            tracing::warn!("payload inválido ({e}): {raw}");
        }
    }
}
