//! Messo · discovery de servidores Ollama na LAN.
//!
//! "Poi sì ritrasse, e parve di coloro / che corrono a Verona il drappo verde."
//! — Inferno · XV · 121–122
//!
//! Estratégia em camadas:
//!   1. Localhost — `http://localhost:11434` (Ollama default).
//!   2. mDNS — procura `_ollama._tcp.local.` e `_http._tcp.local.` na LAN.
//!   3. Manual — config explícita em `config.beatriz.ollamaUrl`.
//!
//! O resultado fica disponível para Beatriz via `cmd_messo_hosts`.

use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use std::time::Duration;

use mdns_sd::{ServiceDaemon, ServiceEvent};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};

const DEFAULT_OLLAMA_PORT: u16 = 11434;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OllamaHost {
    pub url: String,
    pub source: String, // "localhost" | "mdns" | "manual"
    pub hostname: Option<String>,
}

pub struct MessoState {
    hosts: Arc<RwLock<HashMap<String, OllamaHost>>>,
}

impl Default for MessoState {
    fn default() -> Self {
        let mut initial = HashMap::new();
        let local = OllamaHost {
            url: format!("http://localhost:{DEFAULT_OLLAMA_PORT}"),
            source: "localhost".into(),
            hostname: Some("localhost".into()),
        };
        initial.insert(local.url.clone(), local);
        Self {
            hosts: Arc::new(RwLock::new(initial)),
        }
    }
}

impl MessoState {
    pub fn snapshot(&self) -> Vec<OllamaHost> {
        self.hosts
            .read()
            .map(|g| g.values().cloned().collect())
            .unwrap_or_default()
    }

    pub fn upsert(&self, host: OllamaHost) {
        if let Ok(mut g) = self.hosts.write() {
            g.insert(host.url.clone(), host);
        }
    }
}

/// Inicia a discovery via mDNS num thread separado. Não bloqueia.
pub fn spawn_discovery(handle: AppHandle, state: Arc<MessoState>) {
    std::thread::spawn(move || {
        let daemon = match ServiceDaemon::new() {
            Ok(d) => d,
            Err(e) => {
                tracing::warn!("Messo · falha a iniciar mDNS: {e}");
                return;
            }
        };

        // Tenta vários service types comuns (Ollama não publica oficialmente; alguns
        // wrappers comunitários publicam como _http._tcp ou _ollama._tcp).
        for ty in ["_ollama._tcp.local.", "_http._tcp.local."] {
            let receiver = match daemon.browse(ty) {
                Ok(r) => r,
                Err(e) => {
                    tracing::warn!("Messo · browse {ty} falhou: {e}");
                    continue;
                }
            };

            let state = state.clone();
            let handle = handle.clone();
            std::thread::spawn(move || {
                while let Ok(event) = receiver.recv() {
                    if let ServiceEvent::ServiceResolved(info) = event {
                        let port = info.get_port();
                        // Só nos interessa porta 11434 (Ollama default) ou explícito _ollama._tcp.
                        let is_ollama = port == DEFAULT_OLLAMA_PORT
                            || info.get_type().contains("ollama");
                        if !is_ollama {
                            continue;
                        }
                        for ip in info.get_addresses() {
                            let url = format!("http://{}:{}", ip, port);
                            let host = OllamaHost {
                                url: url.clone(),
                                source: "mdns".into(),
                                hostname: Some(info.get_hostname().to_string()),
                            };
                            tracing::info!("Messo · encontrou {url} ({})", info.get_hostname());
                            state.upsert(host.clone());
                            let _ = handle.emit("messo:host", &host);
                        }
                    }
                }
            });
        }

        // Mantém o daemon vivo. Eventualmente poderemos parar via Drop.
        std::thread::sleep(Duration::from_secs(60 * 60 * 24 * 365));
    });
}

// ─── Tauri commands ──────────────────────────────────────────────────

#[tauri::command]
pub fn cmd_messo_hosts(state: tauri::State<Arc<MessoState>>) -> Vec<OllamaHost> {
    state.snapshot()
}

#[tauri::command]
pub async fn cmd_messo_probe(url: String) -> Result<bool, String> {
    // Reusa a validação SSRF da Beatriz.
    crate::modules::beatriz::ensure_safe_url(&url)?;
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(2))
        .build()
        .map_err(|e| e.to_string())?;
    match client.get(format!("{}/api/tags", url.trim_end_matches('/'))).send().await {
        Ok(r) => Ok(r.status().is_success()),
        Err(_) => Ok(false),
    }
}

/// Wrapper para registar no setup.
pub fn install(handle: &AppHandle) {
    let state = Arc::new(MessoState::default());
    spawn_discovery(handle.clone(), state.clone());
    handle.manage(state);
}
