//! Sync · sincronização opcional de configs entre devices (v1.2 skeleton).
//!
//! **Princípio inviolável:** **só configs**, nunca conteúdo. Cookies, sessions,
//! storage das WebViews (Malebolge) e o índice do Virgílio NUNCA são sincronizados.
//! O que se sincroniza:
//!   · `config.json` (appearance, instances metadata, sidebar order)
//!   · `rules.json` (regras do Minos)
//!   · `services.json` overrides do utilizador (futuro)
//!
//! ### Transport — escolha pendente (v1.2 final)
//!
//! Três caminhos em discussão (todos local-first, sem servidor):
//!
//! 1. **Syncthing** (utilizador-side) — recomendar configurar Syncthing/iCloud
//!    Drive a sincronizar `app_config_dir` entre máquinas. Cocito apenas detecta
//!    mudanças no disco e re-lê. Zero código de transport. **Mais simples.**
//!
//! 2. **mDNS + WebSocket P2P** — Cocito anuncia-se na LAN como `_cocito-sync._tcp`.
//!    Outras instâncias na mesma LAN descobrem e fazem handshake. CRDT (Automerge ou
//!    similar) para resolver conflitos. **Mais ambicioso, sem cloud.**
//!
//! 3. **Iroh / Tailscale-only** — endpoints P2P encriptados. Funciona fora da LAN.
//!    Aproxima-se de "cloud" mas sem operador central. **Mais complexo.**
//!
//! Para já, expomos apenas:
//!   · `cmd_sync_status` — devolve estado (off, watching, syncing, ...)
//!   · `cmd_sync_export` — exporta config como JSON único (para backup manual)
//!   · `cmd_sync_import` — aplica um JSON exportado
//!
//! O resto (transport real) chega numa v1.2 final ou v1.3.

use std::path::PathBuf;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};

use crate::config::{Config, ConfigState};
use crate::modules::minos::{MinosState, Rule};
use crate::secure_fs;

/// Limite máximo do snapshot importado (1 MB) — defesa contra payloads gigantes
/// num único `cmd_sync_import`. 1 MB cobre folgadamente uma config real (instances,
/// regras, appearance) — é várias ordens de magnitude maior que o esperado.
const MAX_SNAPSHOT_BYTES: usize = 1 * 1024 * 1024;

/// Limite ao número de regras importadas, mesmo dentro de 1 MB JSON.
const MAX_RULES_IMPORTED: usize = 500;
const MAX_INSTANCES_IMPORTED: usize = 200;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncStatus {
    pub enabled: bool,
    pub mode: String, // "off" | "syncthing" | "p2p" | "iroh"
    pub last_sync_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncSnapshot {
    pub version: u32,
    pub config: Config,
    pub rules: Vec<Rule>,
}

const SNAPSHOT_VERSION: u32 = 1;

#[tauri::command]
pub fn cmd_sync_status() -> SyncStatus {
    SyncStatus {
        enabled: false,
        mode: "off".into(),
        last_sync_at: None,
    }
}

/// Exporta config + rules para JSON único (útil para backup ou sync manual).
#[tauri::command]
pub fn cmd_sync_export(
    cfg: tauri::State<ConfigState>,
    minos: tauri::State<MinosState>,
) -> Result<String, String> {
    let snapshot = SyncSnapshot {
        version: SNAPSHOT_VERSION,
        config: cfg.snapshot(),
        rules: minos.rules(),
    };
    serde_json::to_string_pretty(&snapshot).map_err(|e| e.to_string())
}

/// Aplica um snapshot importado. Sobrescreve config + rules localmente.
///
/// Defesas:
///   · Tamanho máximo do JSON (1 MB)
///   · Versão obrigatoriamente 1
///   · Limites a número de regras e instâncias
///   · Sanitização de IDs das instâncias importadas (mesmo regex do Cérbero)
#[tauri::command]
pub fn cmd_sync_import(
    handle: AppHandle,
    cfg: tauri::State<ConfigState>,
    snapshot_json: String,
) -> Result<(), String> {
    if snapshot_json.len() > MAX_SNAPSHOT_BYTES {
        return Err(format!(
            "snapshot excede {} bytes ({} recebido)",
            MAX_SNAPSHOT_BYTES,
            snapshot_json.len()
        ));
    }

    let snapshot: SyncSnapshot =
        serde_json::from_str(&snapshot_json).map_err(|e| format!("JSON inválido: {e}"))?;

    if snapshot.version != SNAPSHOT_VERSION {
        return Err(format!(
            "versão {} não suportada (esperada {SNAPSHOT_VERSION})",
            snapshot.version
        ));
    }

    if snapshot.rules.len() > MAX_RULES_IMPORTED {
        return Err(format!(
            "demasiadas regras ({} > {MAX_RULES_IMPORTED})",
            snapshot.rules.len()
        ));
    }

    if snapshot.config.instances.len() > MAX_INSTANCES_IMPORTED {
        return Err(format!(
            "demasiadas instâncias ({} > {MAX_INSTANCES_IMPORTED})",
            snapshot.config.instances.len()
        ));
    }

    // Sanitização: IDs têm de ser do mesmo padrão que o Cérbero aceita.
    for inst in &snapshot.config.instances {
        if !is_safe_id(&inst.id) || !is_safe_id(&inst.service_id) {
            return Err(format!(
                "instância com IDs inválidos: id={:?} service_id={:?}",
                inst.id, inst.service_id
            ));
        }
        // URL Ollama ou de serviço pode ser https://… ou app://…; aceitamos pelo serde,
        // mas validamos comprimento.
        if inst.url.len() > 2_048 {
            return Err(format!("URL excede 2048 chars: {}", inst.id));
        }
    }

    // Backup automático: snapshot do estado atual antes de sobrescrever.
    // Útil para rollback se o import correr mal ou for malicioso.
    let backup_dir = handle
        .path()
        .app_config_dir()
        .map_err(|e| e.to_string())?
        .join("backups");
    secure_fs::ensure_dir_secure(&backup_dir).map_err(|e| e.to_string())?;

    let current_snapshot = SyncSnapshot {
        version: SNAPSHOT_VERSION,
        config: cfg.snapshot(),
        rules: Vec::new(), // rules.json fica preservado abaixo
    };
    let ts = chrono::Local::now().format("%Y%m%d-%H%M%S").to_string();
    let backup_path = backup_dir.join(format!("pre-import-{ts}.json"));
    if let Ok(body) = serde_json::to_string_pretty(&current_snapshot) {
        let _ = secure_fs::write_secure(&backup_path, body.as_bytes());
        tracing::info!("Sync · backup pré-import em {}", backup_path.display());
    }

    crate::modules::audit::log(
        &handle,
        "sync.import",
        &serde_json::json!({
            "rules_count": snapshot.rules.len(),
            "instances_count": snapshot.config.instances.len(),
            "backup_path": backup_path.display().to_string(),
        }),
    );

    // Aplica config (incluindo appearance, instances, scriptorium).
    cfg.update(|c| *c = snapshot.config.clone()).map_err(|e| e.to_string())?;

    // Aplica rules (escreve no rules.json — hot-reload do Minos vai pegar).
    let rules_path = handle
        .path()
        .app_config_dir()
        .map_err(|e| e.to_string())?
        .join("rules.json");
    let body = serde_json::to_string_pretty(&snapshot.rules).map_err(|e| e.to_string())?;
    secure_fs::write_secure(&rules_path, body.as_bytes()).map_err(|e| e.to_string())?;

    Ok(())
}

fn is_safe_id(s: &str) -> bool {
    !s.is_empty()
        && s.len() <= 128
        && s.chars().all(|c| matches!(c, 'a'..='z' | '0'..='9' | '-'))
}

// ─── Sync transport · Syncthing-side ─────────────────────────────────
//
// Modelo: o utilizador configura Syncthing/iCloud Drive para sincronizar
// o `app_config_dir`. Cocito não faz transport ele mesmo — apenas observa
// mudanças nos ficheiros e re-lê quando outra instância grava.
//
// Vantagens: zero código de rede, encryption end-to-end já está no Syncthing,
// sem CRDT, sem conflict resolution complicado (last-write-wins no filesystem).
// Limitação: dois devices a editar ao mesmo tempo geram conflitos do Syncthing
// (ficheiros .sync-conflict-*) que o utilizador resolve manualmente.

/// Inicia o watcher de filesystem. Não bloqueia. Quando config.json ou
/// rules.json mudam (ex: Syncthing trouxe da outra máquina), emite
/// `sync:external-change` para a UI re-hidratar.
pub fn install_watcher(handle: &AppHandle) -> anyhow::Result<()> {
    let dir = handle
        .path()
        .app_config_dir()
        .map_err(|e| anyhow::anyhow!("app_config_dir: {e}"))?;

    let h = handle.clone();
    std::thread::spawn(move || {
        let (tx, rx) = std::sync::mpsc::channel();
        let mut debouncer = match notify_debouncer_mini::new_debouncer(
            Duration::from_millis(500),
            tx,
        ) {
            Ok(d) => d,
            Err(e) => {
                tracing::warn!("Sync · watcher init falhou: {e}");
                return;
            }
        };

        if let Err(e) = debouncer.watcher().watch(
            &dir,
            notify::RecursiveMode::NonRecursive,
        ) {
            tracing::warn!("Sync · watch {} falhou: {e}", dir.display());
            return;
        }
        tracing::info!("Sync · watcher ativo em {}", dir.display());

        // Track de mtimes próprias para ignorar eventos de auto-write.
        let mut own_mtime: std::collections::HashMap<PathBuf, std::time::SystemTime> =
            std::collections::HashMap::new();

        for events in rx.iter().flatten() {
            for event in events {
                let path = event.path;
                let name = match path.file_name().and_then(|n| n.to_str()) {
                    Some(n) => n,
                    None => continue,
                };
                if !matches!(name, "config.json" | "rules.json") {
                    continue;
                }
                // Ignora se a mtime é a mesma que vimos antes (= nós próprios escrevemos).
                if let Ok(meta) = std::fs::metadata(&path) {
                    if let Ok(mtime) = meta.modified() {
                        if own_mtime.get(&path) == Some(&mtime) {
                            continue;
                        }
                        own_mtime.insert(path.clone(), mtime);
                    }
                }
                tracing::info!("Sync · mudança externa: {}", name);
                let _ = h.emit("sync:external-change", name);
            }
        }
    });

    Ok(())
}
