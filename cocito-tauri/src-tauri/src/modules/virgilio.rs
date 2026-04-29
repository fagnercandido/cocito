//! Virgílio · indexador SQLite local do stream do Cérbero.
//!
//! "Tu se' lo mio maestro e 'l mio autore; / tu se' solo colui da cu' io tolsi
//!  / lo bello stile che m'ha fatto onore."
//! — Inferno · I · 85–87
//!
//! v0: ingest puro. A cada evento do Cérbero, uma row em `notifications`.
//! Pesquisa UI (palette ⌘⇧F) fica para v1.1.
//!
//! Ficheiro: `~/Library/Application Support/<app>/virgilio.sqlite`.

use std::path::PathBuf;
use std::sync::Mutex;

use anyhow::{Context, Result};
use rusqlite::{params, Connection};
use tauri::{AppHandle, Manager};

use crate::modules::cerbero::CocitoNotification;
use crate::secure_fs;

const SCHEMA: &str = r#"
CREATE TABLE IF NOT EXISTS notifications (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    service     TEXT NOT NULL,
    instance    TEXT NOT NULL,
    ts          INTEGER NOT NULL,
    title       TEXT NOT NULL,
    body        TEXT,
    tag         TEXT,
    icon        TEXT,
    url         TEXT,
    kind        TEXT
);
CREATE INDEX IF NOT EXISTS idx_notifications_instance ON notifications(instance);
CREATE INDEX IF NOT EXISTS idx_notifications_ts       ON notifications(ts);
CREATE INDEX IF NOT EXISTS idx_notifications_service  ON notifications(service);
CREATE VIRTUAL TABLE IF NOT EXISTS notifications_fts
    USING fts5(title, body, content='notifications', content_rowid='id');
CREATE TRIGGER IF NOT EXISTS notifications_ai AFTER INSERT ON notifications BEGIN
    INSERT INTO notifications_fts(rowid, title, body) VALUES (new.id, new.title, coalesce(new.body, ''));
END;
CREATE TRIGGER IF NOT EXISTS notifications_ad AFTER DELETE ON notifications BEGIN
    INSERT INTO notifications_fts(notifications_fts, rowid, title, body)
        VALUES ('delete', old.id, old.title, coalesce(old.body, ''));
END;
"#;

pub struct VirgilioState {
    pub(crate) conn: Mutex<Connection>,
    #[allow(dead_code)]
    path: PathBuf,
}

impl VirgilioState {
    pub fn open(handle: &AppHandle) -> Result<Self> {
        Self::open_with_encryption(handle, false)
    }

    pub fn open_encrypted(handle: &AppHandle) -> Result<Self> {
        Self::open_with_encryption(handle, true)
    }

    fn open_with_encryption(handle: &AppHandle, encrypted: bool) -> Result<Self> {
        let path = resolve_db_path(handle)?;
        let conn = Connection::open(&path)
            .with_context(|| format!("a abrir {}", path.display()))?;

        // SQLCipher: tem de aplicar PRAGMA key ANTES de qualquer outra query.
        if encrypted {
            let key = crate::keychain::ensure_random_key("virgilio.dbkey")
                .context("a obter chave de encryption do keychain")?;
            // PRAGMA key precisa de string entre aspas; SQLCipher trata como hex
            // se prefixado com `x'...'`. 32 bytes hex = 64 chars.
            let pragma = format!("PRAGMA key = \"x'{key}'\";");
            conn.execute_batch(&pragma)
                .context("a aplicar PRAGMA key (chave inválida ou DB pré-existente sem encryption)")?;
        }

        conn.execute_batch(SCHEMA).context("a aplicar schema Virgílio")?;

        // Restringe o ficheiro SQLite a 0600 (e o WAL/SHM, se existirem).
        for ext in ["", "-wal", "-shm"] {
            let p = if ext.is_empty() {
                path.clone()
            } else {
                let mut p = path.clone();
                let name = format!("{}{ext}", p.file_name().unwrap().to_string_lossy());
                p.set_file_name(name);
                p
            };
            if p.exists() {
                #[cfg(unix)]
                {
                    use std::os::unix::fs::PermissionsExt;
                    let _ = std::fs::set_permissions(&p, std::fs::Permissions::from_mode(0o600));
                }
            }
        }

        Ok(Self {
            conn: Mutex::new(conn),
            path,
        })
    }

    /// Insere um evento do Cérbero. `kind="title"` é ignorado (só conta notifs).
    pub fn ingest(&self, notif: &CocitoNotification) -> Result<()> {
        if notif.kind.as_deref() == Some("title") {
            return Ok(());
        }
        let guard = self.conn.lock().map_err(|e| anyhow::anyhow!("lock: {e}"))?;
        guard.execute(
            "INSERT INTO notifications (service, instance, ts, title, body, tag, icon, url, kind)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                notif.service,
                notif.instance,
                notif.timestamp as i64,
                notif.title,
                notif.body,
                notif.tag,
                notif.icon,
                notif.url,
                notif.kind,
            ],
        )?;
        Ok(())
    }

    pub fn count(&self) -> Result<i64> {
        let guard = self.conn.lock().map_err(|e| anyhow::anyhow!("lock: {e}"))?;
        let n: i64 = guard.query_row("SELECT COUNT(*) FROM notifications", [], |r| r.get(0))?;
        Ok(n)
    }

    /// Apaga eventos com `ts` mais antigo que `retention_days`. Devolve quantos.
    /// Chamado periodicamente — por arranque + uma vez por dia.
    pub fn prune(&self, retention_days: u32) -> Result<usize> {
        if retention_days == 0 {
            return Ok(0);
        }
        let cutoff_ms = (chrono::Utc::now().timestamp_millis())
            - (retention_days as i64) * 86_400_000;
        let guard = self.conn.lock().map_err(|e| anyhow::anyhow!("lock: {e}"))?;
        let n = guard.execute("DELETE FROM notifications WHERE ts < ?1", [cutoff_ms])?;
        // FTS5 trigger associado garante que `notifications_fts` é mantido em sincro.
        Ok(n)
    }
}

fn resolve_db_path(handle: &AppHandle) -> Result<PathBuf> {
    let dir = handle.path().app_data_dir().context("app_data_dir")?;
    secure_fs::ensure_dir_secure(&dir)
        .with_context(|| format!("a criar {} com 0700", dir.display()))?;
    Ok(dir.join("virgilio.sqlite"))
}

// ─── Tauri commands ──────────────────────────────────────────────────

#[tauri::command]
pub fn cmd_virgilio_count(state: tauri::State<VirgilioState>) -> Result<i64, String> {
    state.count().map_err(|e| e.to_string())
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResult {
    pub id: i64,
    pub service: String,
    pub instance: String,
    pub timestamp: i64,
    pub title: String,
    pub body: Option<String>,
    pub url: Option<String>,
}

/// Pesquisa full-text no índice. Vazio = devolve as últimas 50.
#[tauri::command]
pub fn cmd_virgilio_search(
    state: tauri::State<VirgilioState>,
    query: String,
    limit: Option<u32>,
) -> Result<Vec<SearchResult>, String> {
    let limit = limit.unwrap_or(50).min(200);
    let guard = state.conn.lock().map_err(|e| e.to_string())?;
    let q = query.trim();

    let (sql, has_query) = if q.is_empty() {
        (
            "SELECT id, service, instance, ts, title, body, url
             FROM notifications
             ORDER BY ts DESC
             LIMIT ?1"
                .to_string(),
            false,
        )
    } else {
        (
            "SELECT n.id, n.service, n.instance, n.ts, n.title, n.body, n.url
             FROM notifications_fts f
             JOIN notifications n ON n.id = f.rowid
             WHERE notifications_fts MATCH ?1
             ORDER BY n.ts DESC
             LIMIT ?2"
                .to_string(),
            true,
        )
    };

    let mut stmt = guard.prepare(&sql).map_err(|e| e.to_string())?;
    let rows = if has_query {
        stmt.query_map(rusqlite::params![q, limit], map_row)
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect()
    } else {
        stmt.query_map(rusqlite::params![limit], map_row)
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect()
    };
    Ok(rows)
}

fn map_row(row: &rusqlite::Row) -> rusqlite::Result<SearchResult> {
    Ok(SearchResult {
        id: row.get(0)?,
        service: row.get(1)?,
        instance: row.get(2)?,
        timestamp: row.get(3)?,
        title: row.get(4)?,
        body: row.get(5)?,
        url: row.get(6)?,
    })
}
