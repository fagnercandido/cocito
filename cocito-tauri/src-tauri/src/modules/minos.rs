//! Minos · rule engine sobre o stream do Cérbero.
//!
//! "Stavvi Minòs orribilmente, e ringhia: / essamina le colpe nell'entrata;
//!  / giudica e manda secondo ch'avvinghia."
//! — Inferno · V · 4–6
//!
//! Lê regras de `rules.json` (no app_config_dir), avalia-as contra cada evento
//! que vem do Cérbero, e decide ações. É o decisor no gargalo — nada passa do
//! Cérbero para o SO ou para Virgílio sem ter sido julgado aqui.
//!
//! Gatilhos (v0): service, instance, title_contains, title_matches (regex),
//!   body_contains, body_matches, time_between (HH:MM-HH:MM), day_of_week.
//!
//! Ações (v0): silence, priority_notify, set_theme, save_breadcrumb, save_quote.

use std::fs;
use std::path::PathBuf;
use std::sync::RwLock;

use anyhow::{Context, Result};
use chrono::{Datelike, Local, NaiveTime, Timelike, Weekday};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};

use crate::modules::cerbero::CocitoNotification;
use crate::secure_fs;

// ─── Modelo ──────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Trigger {
    #[serde(default)]
    pub service: Option<String>,
    #[serde(default)]
    pub instance: Option<String>,
    #[serde(default)]
    pub title_contains: Option<String>,
    #[serde(default)]
    pub title_matches: Option<String>,
    #[serde(default)]
    pub body_contains: Option<String>,
    #[serde(default)]
    pub body_matches: Option<String>,
    /// Janela HH:MM-HH:MM. Suporta wrap-around (ex: `22:00-06:00`).
    #[serde(default)]
    pub time_between: Option<String>,
    /// Lista de dias (mon, tue, …).
    #[serde(default)]
    pub day_of_week: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "action", rename_all = "snake_case")]
pub enum Action {
    /// Não dispara notif do SO. O evento continua a entrar no stream para o Virgílio.
    Silence,
    /// Notif com som configurável; ignora DND.
    PriorityNotify {
        #[serde(default)]
        sound: Option<String>,
    },
    /// Muda o tema do Cocito (opcionalmente por N minutos).
    SetTheme {
        theme: String,
        #[serde(default)]
        duration_min: Option<u32>,
    },
    /// Cria nota Obsidian com URL + título + timestamp (Scriptorium).
    SaveBreadcrumb {
        #[serde(default)]
        tag: Option<String>,
    },
    /// Cria nota Obsidian com body como blockquote (Scriptorium).
    SaveQuote {
        #[serde(default)]
        tag: Option<String>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Rule {
    pub id: String,
    pub name: String,
    #[serde(default = "default_enabled")]
    pub enabled: bool,
    pub when: Trigger,
    #[serde(rename = "do")]
    pub actions: Vec<Action>,
}

fn default_enabled() -> bool {
    true
}

// ─── State (carregado no arranque, acedido pelo Cérbero) ─────────────

pub struct MinosState {
    pub(crate) rules: RwLock<Vec<Rule>>,
    pub(crate) path: PathBuf,
    pub(crate) last_mtime: RwLock<Option<std::time::SystemTime>>,
}

impl MinosState {
    pub fn load_or_default(handle: &AppHandle) -> Result<Self> {
        let path = rules_path(handle)?;
        let rules = if path.exists() {
            let raw = secure_fs::read_secure(&path)
                .with_context(|| format!("a ler {}", path.display()))?;
            serde_json::from_str::<Vec<Rule>>(&raw).unwrap_or_else(|e| {
                tracing::warn!("rules.json inválido ({e}); a arrancar com lista vazia");
                Vec::new()
            })
        } else {
            // Cria um ficheiro vazio com 0600.
            let example: Vec<Rule> = Vec::new();
            let body = serde_json::to_string_pretty(&example)?;
            secure_fs::write_secure(&path, body.as_bytes())
                .with_context(|| format!("a inicializar {}", path.display()))?;
            example
        };

        let initial_mtime = fs::metadata(&path).and_then(|m| m.modified()).ok();
        Ok(Self {
            rules: RwLock::new(rules),
            path,
            last_mtime: RwLock::new(initial_mtime),
        })
    }

    pub fn rules(&self) -> Vec<Rule> {
        self.refresh_if_changed();
        self.rules.read().map(|g| g.clone()).unwrap_or_default()
    }

    pub fn active_count(&self) -> usize {
        self.refresh_if_changed();
        self.rules
            .read()
            .map(|g| g.iter().filter(|r| r.enabled).count())
            .unwrap_or(0)
    }

    /// Check barato: se o mtime do rules.json mudou, re-lê.
    /// Chamado no início de cada avaliação — overhead mínimo (1 stat por evento).
    fn refresh_if_changed(&self) {
        let current = match fs::metadata(&self.path).and_then(|m| m.modified()) {
            Ok(m) => Some(m),
            Err(_) => return, // ficheiro não existe; nada a fazer
        };
        let previous = self.last_mtime.read().ok().and_then(|g| *g);
        if previous == current {
            return;
        }
        // Mudou — recarrega.
        match secure_fs::read_secure(&self.path)
            .ok()
            .and_then(|raw| serde_json::from_str::<Vec<Rule>>(&raw).ok())
        {
            Some(new_rules) => {
                if let Ok(mut g) = self.rules.write() {
                    *g = new_rules;
                }
                if let Ok(mut m) = self.last_mtime.write() {
                    *m = current;
                }
                tracing::info!("Minos · rules.json recarregado ({} regras)", self.active_count_inner());
            }
            None => {
                tracing::warn!("Minos · rules.json inválido; a manter versão anterior");
            }
        }
    }

    fn active_count_inner(&self) -> usize {
        self.rules
            .read()
            .map(|g| g.iter().filter(|r| r.enabled).count())
            .unwrap_or(0)
    }
}

fn rules_path(handle: &AppHandle) -> Result<PathBuf> {
    let dir = handle.path().app_config_dir().context("app_config_dir")?;
    secure_fs::ensure_dir_secure(&dir)
        .with_context(|| format!("a criar {} com 0700", dir.display()))?;
    Ok(dir.join("rules.json"))
}

// ─── Avaliação ───────────────────────────────────────────────────────

/// Decisão agregada para um evento, após correr todas as regras.
#[derive(Debug, Default, Clone)]
pub struct Verdict {
    pub silence: bool,
    pub priority_sound: Option<String>,
    pub set_theme: Option<String>,
    pub save_breadcrumb_tag: Option<Option<String>>,
    pub save_quote_tag: Option<Option<String>>,
    pub matched_rule_ids: Vec<String>,
}

pub fn evaluate(state: &MinosState, notif: &CocitoNotification) -> Verdict {
    let rules = state.rules();
    let mut v = Verdict::default();
    let now = Local::now();

    for rule in rules.iter().filter(|r| r.enabled) {
        if !matches_trigger(&rule.when, notif, &now) {
            continue;
        }
        v.matched_rule_ids.push(rule.id.clone());

        for action in &rule.actions {
            match action {
                Action::Silence => v.silence = true,
                Action::PriorityNotify { sound } => {
                    v.priority_sound = sound.clone().or_else(|| Some("default".into()));
                }
                Action::SetTheme { theme, .. } => {
                    v.set_theme = Some(theme.clone());
                }
                Action::SaveBreadcrumb { tag } => {
                    v.save_breadcrumb_tag = Some(tag.clone());
                }
                Action::SaveQuote { tag } => {
                    v.save_quote_tag = Some(tag.clone());
                }
            }
        }
    }

    v
}

fn matches_trigger(t: &Trigger, n: &CocitoNotification, now: &chrono::DateTime<Local>) -> bool {
    if let Some(s) = &t.service {
        if s != &n.service {
            return false;
        }
    }
    if let Some(i) = &t.instance {
        if i != &n.instance {
            return false;
        }
    }
    if let Some(needle) = &t.title_contains {
        if !n.title.to_lowercase().contains(&needle.to_lowercase()) {
            return false;
        }
    }
    if let Some(pat) = &t.title_matches {
        if !regex_test(pat, &n.title) {
            return false;
        }
    }
    if let Some(needle) = &t.body_contains {
        let body = n.body.as_deref().unwrap_or("");
        if !body.to_lowercase().contains(&needle.to_lowercase()) {
            return false;
        }
    }
    if let Some(pat) = &t.body_matches {
        let body = n.body.as_deref().unwrap_or("");
        if !regex_test(pat, body) {
            return false;
        }
    }
    if let Some(window) = &t.time_between {
        if !in_time_window(window, now) {
            return false;
        }
    }
    if let Some(days) = &t.day_of_week {
        if !day_matches(days, now.weekday()) {
            return false;
        }
    }
    true
}

fn regex_test(pattern: &str, haystack: &str) -> bool {
    match regex::Regex::new(pattern) {
        Ok(re) => re.is_match(haystack),
        Err(e) => {
            tracing::warn!("regex inválido ({e}): {pattern}");
            false
        }
    }
}

fn in_time_window(window: &str, now: &chrono::DateTime<Local>) -> bool {
    let parts: Vec<&str> = window.split('-').collect();
    if parts.len() != 2 {
        return false;
    }
    let start = NaiveTime::parse_from_str(parts[0].trim(), "%H:%M");
    let end = NaiveTime::parse_from_str(parts[1].trim(), "%H:%M");
    let (start, end) = match (start, end) {
        (Ok(s), Ok(e)) => (s, e),
        _ => return false,
    };
    let current = NaiveTime::from_hms_opt(now.hour(), now.minute(), 0).unwrap_or(start);
    if start <= end {
        current >= start && current < end
    } else {
        // Wrap-around (ex: 22:00-06:00)
        current >= start || current < end
    }
}

fn day_matches(days: &[String], wd: Weekday) -> bool {
    let short = match wd {
        Weekday::Mon => "mon",
        Weekday::Tue => "tue",
        Weekday::Wed => "wed",
        Weekday::Thu => "thu",
        Weekday::Fri => "fri",
        Weekday::Sat => "sat",
        Weekday::Sun => "sun",
    };
    days.iter().any(|d| d.to_lowercase() == short)
}

// ─── Efeitos colaterais (chamados pelo Cérbero) ──────────────────────

/// Dispara os efeitos de UI/state que não são locais ao Cérbero.
/// Notif nativa com som já é controlada pelo Cérbero via `Verdict`.
pub fn apply_side_effects(handle: &AppHandle, verdict: &Verdict) {
    if let Some(theme) = &verdict.set_theme {
        // Publica para o frontend aplicar no <html data-theme=...>.
        let _ = handle.emit("minos:set-theme", theme);
        tracing::info!("Minos · set_theme → {theme}");
    }
    if let Some(tag) = &verdict.save_breadcrumb_tag {
        let _ = handle.emit(
            "minos:save-breadcrumb",
            serde_json::json!({ "tag": tag }),
        );
        tracing::info!("Minos · save_breadcrumb (tag={tag:?}) — handler em Scriptorium v0");
    }
    if let Some(tag) = &verdict.save_quote_tag {
        let _ = handle.emit("minos:save-quote", serde_json::json!({ "tag": tag }));
        tracing::info!("Minos · save_quote (tag={tag:?}) — handler em Scriptorium v0");
    }
    if !verdict.matched_rule_ids.is_empty() {
        tracing::debug!("Minos · regras casadas: {:?}", verdict.matched_rule_ids);
    }
}

// ─── Tauri commands ──────────────────────────────────────────────────

#[tauri::command]
pub fn cmd_list_rules(state: tauri::State<MinosState>) -> Vec<Rule> {
    state.rules()
}

#[tauri::command]
pub fn cmd_rules_active_count(state: tauri::State<MinosState>) -> usize {
    state.active_count()
}

/// Grava uma nova lista de regras no rules.json. Hot-reload pega automaticamente.
#[tauri::command]
pub fn cmd_save_rules(state: tauri::State<MinosState>, rules: Vec<Rule>) -> Result<(), String> {
    let body = serde_json::to_string_pretty(&rules).map_err(|e| e.to_string())?;
    secure_fs::write_secure(&state.path, body.as_bytes()).map_err(|e| e.to_string())?;
    if let Ok(mut g) = state.rules.write() {
        *g = rules;
    }
    if let Ok(mut m) = state.last_mtime.write() {
        *m = fs::metadata(&state.path).and_then(|x| x.modified()).ok();
    }
    Ok(())
}
