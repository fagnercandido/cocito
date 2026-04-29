//! Beatriz · AI via Ollama (local ou LAN via Messo).
//!
//! "Vergine madre, figlia del tuo figlio, / umile e alta più che creatura."
//! — Paradiso · XXXIII · 1–2
//!
//! Bridge Rust → Ollama HTTP. Suporta streaming (server-sent JSON-lines).
//! Os tokens chegam ao frontend via evento `beatriz:token`.

use std::net::IpAddr;
use std::time::Duration;

use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};

use crate::config::ConfigState;
use crate::modules::cerbero::CocitoNotification;
use std::sync::Mutex;
use std::time::Instant;
use tauri::Listener;

/// Devolve um cliente HTTP configurado para Ollama. Respeita o setting
/// `beatriz.allow_self_signed_tls` — só autoriza certs auto-assinados se
/// o utilizador explicitamente o pediu nas Preferências.
fn ollama_client(handle: &AppHandle, timeout: Duration) -> Result<reqwest::Client, String> {
    let allow_self_signed = handle
        .try_state::<ConfigState>()
        .map(|s| s.snapshot().beatriz.allow_self_signed_tls)
        .unwrap_or(false);

    reqwest::Client::builder()
        .timeout(timeout)
        .danger_accept_invalid_certs(allow_self_signed)
        .build()
        .map_err(|e| e.to_string())
}

/// Valida que a URL aponta para loopback ou para a LAN (RFC 1918) — nunca para
/// IPs públicos, link-local (169.254/16, AWS metadata) ou multicast.
///
/// Bloqueia SSRF: mesmo que o utilizador (ou regra Minos no futuro) configure
/// um host malicioso, Beatriz nunca chama endereços fora da máquina/LAN.
fn is_safe_ollama_url(url: &str) -> bool {
    let parsed = match reqwest::Url::parse(url) {
        Ok(u) => u,
        Err(_) => return false,
    };

    // Só HTTP (Ollama é cleartext local; HTTPS na LAN é raro e não obrigatório).
    if parsed.scheme() != "http" && parsed.scheme() != "https" {
        return false;
    }

    let host_raw = match parsed.host_str() {
        Some(h) => h,
        None => return false,
    };

    // Nomes mDNS terminados em `.local` são LAN por definição.
    if host_raw == "localhost" || host_raw.ends_with(".local") {
        return true;
    }

    // IPv6 vem entre [colchetes] no host_str — strip antes do parse.
    let host = host_raw.trim_start_matches('[').trim_end_matches(']');

    match host.parse::<IpAddr>() {
        Ok(IpAddr::V4(ip)) => {
            if ip.is_loopback() {
                return true;
            }
            if ip.is_link_local() || ip.is_broadcast() || ip.is_multicast() || ip.is_unspecified() {
                return false;
            }
            ip.is_private() // 10/8, 172.16/12, 192.168/16
        }
        Ok(IpAddr::V6(ip)) => {
            // Loopback ::1 ou ULA (fc00::/7).
            ip.is_loopback() || (ip.segments()[0] & 0xfe00) == 0xfc00
        }
        // Hostname não-IP que não termine em .local — rejeita.
        // (Ollama público na internet violaria a invariante "AI só local".)
        Err(_) => false,
    }
}

pub fn ensure_safe_url(url: &str) -> Result<(), String> {
    if !is_safe_ollama_url(url) {
        return Err(format!(
            "URL Ollama recusada (tem de ser loopback ou LAN privada): {url}"
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::is_safe_ollama_url;

    #[test]
    fn permite_loopback_e_lan() {
        assert!(is_safe_ollama_url("http://localhost:11434"));
        assert!(is_safe_ollama_url("http://127.0.0.1:11434"));
        assert!(is_safe_ollama_url("http://192.168.1.10:11434"));
        assert!(is_safe_ollama_url("http://10.0.0.5:11434"));
        assert!(is_safe_ollama_url("http://172.16.5.5:11434"));
        assert!(is_safe_ollama_url("http://my-mac.local:11434"));
        assert!(is_safe_ollama_url("https://192.168.1.10"));
        assert!(is_safe_ollama_url("http://[::1]:11434"));
    }

    #[test]
    fn bloqueia_publicos_e_metadata() {
        assert!(!is_safe_ollama_url("http://169.254.169.254"));   // AWS metadata
        assert!(!is_safe_ollama_url("http://google.com"));
        assert!(!is_safe_ollama_url("http://1.1.1.1"));
        assert!(!is_safe_ollama_url("http://8.8.8.8"));
        assert!(!is_safe_ollama_url("http://172.32.0.1"));        // fora de 172.16/12
        assert!(!is_safe_ollama_url("http://172.15.0.1"));        // idem
        assert!(!is_safe_ollama_url("http://224.0.0.1"));         // multicast
        assert!(!is_safe_ollama_url("http://0.0.0.0"));           // unspecified
    }

    #[test]
    fn bloqueia_schemes_invalidos() {
        assert!(!is_safe_ollama_url("ftp://192.168.1.10"));
        assert!(!is_safe_ollama_url("file:///etc/passwd"));
        assert!(!is_safe_ollama_url("javascript:alert(1)"));
        assert!(!is_safe_ollama_url("not a url"));
        assert!(!is_safe_ollama_url(""));
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateRequest {
    pub url: String,
    pub model: String,
    pub prompt: String,
    #[serde(default)]
    pub system: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListModelsResponse {
    pub models: Vec<OllamaModel>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OllamaModel {
    pub name: String,
    #[serde(default)]
    pub size: Option<u64>,
}

// ─── Beatriz v3 · subscritor proativo ────────────────────────────────
//
// Subscreve `cerbero:event` e, quando há picos de atividade no mesmo
// instance (3+ notifs em 30 s), publica `beatriz:suggestion` para a UI
// mostrar uma chamada subtil do tipo "quer que resuma a thread?".
//
// Não chama Ollama proativamente — só sugere. O utilizador escolhe se
// abre Beatriz com ⌘K (que terá pré-preenchido o contexto).

#[derive(Default)]
struct ActivityWindow {
    /// Timestamps das últimas notifs por instance.
    history: std::collections::HashMap<String, Vec<Instant>>,
    /// Última sugestão emitida por instance — evita spam.
    last_suggested: std::collections::HashMap<String, Instant>,
}

const BURST_THRESHOLD: usize = 3;
const BURST_WINDOW_SECS: u64 = 30;
const SUGGESTION_COOLDOWN_SECS: u64 = 600; // 10 min

fn activity_state() -> &'static Mutex<ActivityWindow> {
    use std::sync::OnceLock;
    static STATE: OnceLock<Mutex<ActivityWindow>> = OnceLock::new();
    STATE.get_or_init(|| Mutex::new(ActivityWindow::default()))
}

/// Instala o subscritor — chamado no setup junto com Cérbero.
pub fn install_proactive(handle: &AppHandle) {
    let h = handle.clone();
    handle.listen("cerbero:event", move |evt| {
        let payload = evt.payload();
        let notif: CocitoNotification = match serde_json::from_str(payload) {
            Ok(n) => n,
            Err(_) => return,
        };
        if notif.kind.as_deref() == Some("title") {
            return;
        }
        check_burst(&h, &notif);
    });
}

fn check_burst(handle: &AppHandle, notif: &CocitoNotification) {
    let mut state = match activity_state().lock() {
        Ok(s) => s,
        Err(_) => return,
    };
    let now = Instant::now();
    let window = std::time::Duration::from_secs(BURST_WINDOW_SECS);
    let cooldown = std::time::Duration::from_secs(SUGGESTION_COOLDOWN_SECS);

    let count = {
        let entries = state.history.entry(notif.instance.clone()).or_default();
        entries.retain(|t| now.duration_since(*t) < window);
        entries.push(now);
        entries.len()
    };

    if count < BURST_THRESHOLD {
        return;
    }
    let on_cooldown = state
        .last_suggested
        .get(&notif.instance)
        .is_some_and(|last| now.duration_since(*last) < cooldown);
    if on_cooldown {
        return;
    }

    state.last_suggested.insert(notif.instance.clone(), now);
    drop(state); // liberta o lock antes de I/O.

    let _ = handle.emit(
        "beatriz:suggestion",
        serde_json::json!({
            "instance": notif.instance,
            "kind": "burst",
            "count": count,
        }),
    );
    tracing::info!(
        "Beatriz · sugestão de burst em {} ({count} notifs em {}s)",
        notif.instance,
        BURST_WINDOW_SECS
    );
}

/// Lista modelos disponíveis num host Ollama.
#[tauri::command]
pub async fn cmd_beatriz_list_models(
    handle: AppHandle,
    url: String,
) -> Result<Vec<OllamaModel>, String> {
    ensure_safe_url(&url)?;
    let client = ollama_client(&handle, Duration::from_secs(5))?;
    let resp = client
        .get(format!("{}/api/tags", url.trim_end_matches('/')))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    let body: ListModelsResponse = resp.json().await.map_err(|e| e.to_string())?;
    Ok(body.models)
}

/// Gera texto via Ollama, streaming. Cada token vai como evento `beatriz:token`.
/// Retorna o texto completo no fim.
#[tauri::command]
pub async fn cmd_beatriz_generate(
    handle: AppHandle,
    req: GenerateRequest,
) -> Result<String, String> {
    ensure_safe_url(&req.url)?;
    let client = ollama_client(&handle, Duration::from_secs(120))?;

    let body = serde_json::json!({
        "model": req.model,
        "prompt": req.prompt,
        "system": req.system,
        "stream": true,
    });

    let resp = client
        .post(format!("{}/api/generate", req.url.trim_end_matches('/')))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("falha a contactar Ollama: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!("Ollama devolveu status {}", resp.status()));
    }

    let mut buffer = Vec::new();
    let mut full = String::new();
    let mut stream = resp.bytes_stream();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("stream err: {e}"))?;
        buffer.extend_from_slice(&chunk);

        // Cada linha = um JSON com {response, done, ...}
        while let Some(pos) = buffer.iter().position(|&b| b == b'\n') {
            let line: Vec<u8> = buffer.drain(..=pos).collect();
            let text = String::from_utf8_lossy(&line);
            let trimmed = text.trim();
            if trimmed.is_empty() {
                continue;
            }
            #[derive(Deserialize)]
            struct OllamaChunk {
                #[serde(default)]
                response: String,
                #[serde(default)]
                done: bool,
            }
            if let Ok(parsed) = serde_json::from_str::<OllamaChunk>(trimmed) {
                if !parsed.response.is_empty() {
                    full.push_str(&parsed.response);
                    let _ = handle.emit("beatriz:token", &parsed.response);
                }
                if parsed.done {
                    let _ = handle.emit("beatriz:done", &full);
                }
            }
        }
    }

    Ok(full)
}
