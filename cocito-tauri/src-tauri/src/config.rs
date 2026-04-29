//! Config do utilizador, persistido em `~/Library/Application Support/Cocito/config.json`
//! (ou equivalente em Windows/Linux). Nada disto sai da máquina.

use std::fs;
use std::path::PathBuf;
use std::sync::RwLock;

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State};

use crate::secure_fs;

// ─── Modelo ──────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Appearance {
    /// Slug do tema: cocito, crepuscolo, bufera, …
    pub theme: String,
    /// "light", "dark" ou ausente para seguir o sistema.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mode: Option<String>,
    /// Slug da stack tipográfica: sobria, literaria, nativa.
    pub typography: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstanceConfig {
    /// ID único da instância (slug — ex: `slack-work`, `gmail-personal`).
    pub id: String,
    /// ID do service no catálogo (ex: `slack`, `gmail`).
    pub service_id: String,
    /// Label amigável (ex: "Work", "Personal"). Default = nome do service.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
    /// URL inicial. Pode diferir do default do catálogo (workspace-specific).
    pub url: String,
    /// User-agent a aplicar.
    pub user_agent: String,
    /// Tag de 1 carácter sobre o ícone (W=Work, P=Personal).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tag: Option<String>,
    /// Última contagem conhecida de unreads (preservada entre arranques).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub unread: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ScriptoriumConfig {
    /// Path absoluto do vault Obsidian (ex: `/Users/<you>/Obsidian`).
    /// `None` = Scriptorium inativo; ações `save_*` do Minos são ignoradas.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub vault_path: Option<String>,
}

/// Configurações do Virgílio (indexador SQLite).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VirgilioConfig {
    /// Reter apenas as últimas N dias de eventos. `None` ou 0 = sem limite.
    /// Default: 90 dias (suficiente para "o que apareceu nos últimos 3 meses").
    #[serde(default = "default_retention_days", skip_serializing_if = "Option::is_none")]
    pub retention_days: Option<u32>,
    /// Habilita encryption at rest via SQLCipher. Requer reabertura.
    /// Quando ligado, o Cocito gera uma chave aleatória e guarda no Keychain.
    #[serde(default)]
    pub encryption_enabled: bool,
}

impl Default for VirgilioConfig {
    fn default() -> Self {
        Self {
            retention_days: Some(90),
            encryption_enabled: false,
        }
    }
}

fn default_retention_days() -> Option<u32> {
    Some(90)
}

/// Configurações de downloads.
///
/// Por defeito (`mode = "auto"`), tudo o que as webviews descarregam vai para
/// `~/Downloads` (ou equivalente em Windows/Linux), sem perguntar — comporta-se
/// como qualquer browser. O utilizador pode trocar para:
///
/// - `"fixed"` → todos os downloads vão para `path` (uma pasta escolhida uma vez).
/// - `"ask"`   → abre diálogo nativo a cada download para escolher destino.
///
/// O hook é em `caronte::on_download` — vê lá a aplicação prática.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadsConfig {
    /// "auto" | "fixed" | "ask". Default = "auto".
    #[serde(default = "default_downloads_mode")]
    pub mode: String,
    /// Path absoluto da pasta custom. Apenas usado quando `mode == "fixed"`.
    /// `None` faz fallback para `~/Downloads`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
}

impl Default for DownloadsConfig {
    fn default() -> Self {
        Self {
            mode: default_downloads_mode(),
            path: None,
        }
    }
}

fn default_downloads_mode() -> String {
    "auto".into()
}

/// Configurações da Beatriz (AI Ollama).
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct BeatrizConfig {
    /// URL do servidor Ollama. Validada contra loopback/RFC1918.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ollama_url: Option<String>,
    /// Aceita certificados auto-assinados (TLS). Útil para Ollama atrás de
    /// reverse proxy na LAN com cert self-signed.
    #[serde(default)]
    pub allow_self_signed_tls: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Config {
    pub appearance: Appearance,
    /// Instâncias ativas (ordem = ordem da sidebar).
    #[serde(default)]
    pub instances: Vec<InstanceConfig>,
    /// Instância ativa.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub active_instance: Option<String>,
    /// Configuração do Scriptorium (vault Obsidian).
    #[serde(default)]
    pub scriptorium: ScriptoriumConfig,
    /// Configuração do Virgílio (retenção, encryption).
    #[serde(default)]
    pub virgilio: VirgilioConfig,
    /// Configuração da Beatriz (Ollama).
    #[serde(default)]
    pub beatriz: BeatrizConfig,
    /// Configuração de downloads (modo auto/fixed/ask + path opcional).
    #[serde(default)]
    pub downloads: DownloadsConfig,
    /// Flag "já vi a primeira execução".
    #[serde(default)]
    pub has_seen_welcome: bool,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            appearance: Appearance {
                theme: "cocito".into(),
                mode: None,
                typography: "sobria".into(),
            },
            instances: Vec::new(),
            active_instance: None,
            scriptorium: ScriptoriumConfig::default(),
            virgilio: VirgilioConfig::default(),
            beatriz: BeatrizConfig::default(),
            downloads: DownloadsConfig::default(),
            has_seen_welcome: false,
        }
    }
}

// ─── Catálogo de serviços ────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServiceDef {
    pub id: String,
    pub name: String,
    pub url: String,
    pub icon: String,
    pub user_agent: String,
    #[serde(default)]
    pub can_have_multiple_instances: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub title_badge_pattern: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sender_parser: Option<String>,
}

// ─── State (lock-friendly) ────────────────────────────────────────────

pub struct ConfigState {
    inner: RwLock<Config>,
    path: PathBuf,
}

impl ConfigState {
    pub fn load_or_default(handle: &AppHandle) -> Result<Self> {
        let path = resolve_config_path(handle)?;
        let cfg = if path.exists() {
            let raw = secure_fs::read_secure(&path)
                .with_context(|| format!("a ler {}", path.display()))?;
            serde_json::from_str::<Config>(&raw)
                .with_context(|| format!("a desserializar {}", path.display()))
                .unwrap_or_else(|e| {
                    tracing::warn!("config corrompido ({e}); a usar defaults");
                    Config::default()
                })
        } else {
            let c = Config::default();
            let body = serde_json::to_string_pretty(&c)?;
            secure_fs::write_secure(&path, body.as_bytes())
                .with_context(|| format!("a inicializar {}", path.display()))?;
            c
        };

        Ok(Self {
            inner: RwLock::new(cfg),
            path,
        })
    }

    pub fn snapshot(&self) -> Config {
        self.inner.read().expect("config RwLock envenenado").clone()
    }

    pub fn persist(&self) -> Result<()> {
        let cfg = self.snapshot();
        let body = serde_json::to_string_pretty(&cfg)?;
        secure_fs::write_secure(&self.path, body.as_bytes())
            .with_context(|| format!("a escrever {}", self.path.display()))?;
        Ok(())
    }

    pub fn update<F>(&self, mutator: F) -> Result<Config>
    where
        F: FnOnce(&mut Config),
    {
        {
            let mut guard = self.inner.write().expect("config RwLock envenenado");
            mutator(&mut guard);
        }
        self.persist()?;
        Ok(self.snapshot())
    }
}

fn resolve_config_path(handle: &AppHandle) -> Result<PathBuf> {
    let dir = handle
        .path()
        .app_config_dir()
        .context("não foi possível resolver app_config_dir")?;
    secure_fs::ensure_dir_secure(&dir)
        .with_context(|| format!("a criar {} com 0700", dir.display()))?;
    Ok(dir.join("config.json"))
}

// ─── Tauri commands ──────────────────────────────────────────────────

#[tauri::command]
pub fn cmd_get_config(state: State<ConfigState>) -> Config {
    state.snapshot()
}

#[tauri::command]
pub fn cmd_set_appearance(
    state: State<ConfigState>,
    appearance: Appearance,
) -> Result<Config, String> {
    state
        .update(|c| c.appearance = appearance)
        .map_err(|e| e.to_string())
}

/// Lê `services.json` empacotado no bundle.
#[tauri::command]
pub fn cmd_list_services(handle: AppHandle) -> Result<Vec<ServiceDef>, String> {
    let resource = handle
        .path()
        .resolve("services.json", tauri::path::BaseDirectory::Resource)
        .map_err(|e| e.to_string())?;

    let raw = fs::read_to_string(&resource)
        .map_err(|e| format!("a ler {}: {e}", resource.display()))?;

    serde_json::from_str::<Vec<ServiceDef>>(&raw).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn cmd_add_instance(
    state: State<ConfigState>,
    instance: InstanceConfig,
) -> Result<Config, String> {
    state
        .update(|c| {
            // Se já existe uma com o mesmo ID, substitui (idempotente).
            if let Some(existing) = c.instances.iter_mut().find(|i| i.id == instance.id) {
                *existing = instance.clone();
            } else {
                c.instances.push(instance.clone());
            }
            if c.active_instance.is_none() {
                c.active_instance = Some(instance.id.clone());
            }
        })
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn cmd_remove_instance(
    handle: AppHandle,
    state: State<ConfigState>,
    instance_id: String,
) -> Result<Config, String> {
    let next = state
        .update(|c| {
            c.instances.retain(|i| i.id != instance_id);
            if c.active_instance.as_deref() == Some(&instance_id) {
                c.active_instance = c.instances.first().map(|i| i.id.clone());
            }
        })
        .map_err(|e| e.to_string())?;

    // Limpeza física: apaga a partition (cookies, sessões, IndexedDB).
    // Sem isto, login fica residual no disco mesmo depois de remover.
    if let Err(e) = crate::modules::malebolge::delete_partition(&handle, &instance_id) {
        tracing::warn!("falha a apagar partition {instance_id}: {e}");
    }

    // Audit log: remoção é ação destrutiva, regista.
    crate::modules::audit::log(
        &handle,
        "instance.remove",
        &serde_json::json!({ "instance_id": instance_id }),
    );

    Ok(next)
}

#[tauri::command]
pub fn cmd_reorder_instances(
    state: State<ConfigState>,
    ids: Vec<String>,
) -> Result<Config, String> {
    state
        .update(|c| {
            let by_id: std::collections::HashMap<_, _> =
                c.instances.drain(..).map(|i| (i.id.clone(), i)).collect();
            c.instances = ids
                .into_iter()
                .filter_map(|id| by_id.get(&id).cloned())
                .collect();
        })
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn cmd_set_active_instance(
    state: State<ConfigState>,
    instance_id: Option<String>,
) -> Result<Config, String> {
    state
        .update(|c| c.active_instance = instance_id)
        .map_err(|e| e.to_string())
}

/// Atualiza apenas a contagem de unread duma instância (sem reescrever o resto).
/// Chamado pelo frontend a cada title event que produz nova contagem.
#[tauri::command]
pub fn cmd_set_unread(
    state: State<ConfigState>,
    instance_id: String,
    unread: Option<u32>,
) -> Result<(), String> {
    state
        .update(|c| {
            if let Some(inst) = c.instances.iter_mut().find(|i| i.id == instance_id) {
                inst.unread = unread;
            }
        })
        .map(|_| ())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn cmd_set_scriptorium_vault(
    state: State<ConfigState>,
    vault_path: Option<String>,
) -> Result<Config, String> {
    state
        .update(|c| c.scriptorium.vault_path = vault_path)
        .map_err(|e| e.to_string())
}

/// Atualiza a política de downloads. Validação leve do `mode` para evitar
/// strings arbitrárias persistidas (defesa em profundidade — o frontend é
/// nosso, mas o config.json pode ser editado à mão).
#[tauri::command]
pub fn cmd_set_downloads(
    state: State<ConfigState>,
    mode: String,
    path: Option<String>,
) -> Result<Config, String> {
    let normalized = match mode.as_str() {
        "auto" | "fixed" | "ask" => mode,
        _ => return Err(format!("downloads.mode inválido: {mode}")),
    };
    state
        .update(|c| {
            c.downloads.mode = normalized;
            c.downloads.path = path;
        })
        .map_err(|e| e.to_string())
}
