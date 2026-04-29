//! Audit log · trilho append-only de ações sensíveis.
//!
//! "Onde o erro é grande, a memória deve ser maior." — defensiva contra
//! mudanças destrutivas: remover instância, importar config, alterar vault path,
//! apagar regras. Cada entrada é uma linha JSON.
//!
//! Localização: `app_data_dir/audit.log`. Permissões 0600. Sem rotação por agora
//! (uma linha por evento — cresce lentamente).

use std::fs::OpenOptions;
use std::io::Write;
use std::path::PathBuf;

use chrono::Local;
use serde_json::json;
use tauri::{AppHandle, Manager};

const AUDIT_FILE: &str = "audit.log";
const MAX_AUDIT_BYTES: u64 = 16 * 1024 * 1024; // 16 MB — depois deixa de escrever (em vez de rotacionar)

fn audit_path(handle: &AppHandle) -> Option<PathBuf> {
    handle
        .path()
        .app_data_dir()
        .ok()
        .map(|d| d.join(AUDIT_FILE))
}

/// Escreve uma entrada no audit log. Best-effort — falhas são logadas mas
/// nunca interrompem a operação principal.
pub fn log(handle: &AppHandle, action: &str, details: &serde_json::Value) {
    let Some(path) = audit_path(handle) else {
        tracing::warn!("audit · sem app_data_dir");
        return;
    };

    // Para se exceder o tamanho máximo (defesa contra disk fill).
    if let Ok(meta) = std::fs::metadata(&path) {
        if meta.len() >= MAX_AUDIT_BYTES {
            tracing::warn!("audit · log atingiu {} bytes, a parar", MAX_AUDIT_BYTES);
            return;
        }
    }

    let entry = json!({
        "ts": Local::now().to_rfc3339(),
        "action": action,
        "details": details,
    });

    let line = match serde_json::to_string(&entry) {
        Ok(s) => s,
        Err(e) => {
            tracing::warn!("audit · serialize falhou: {e}");
            return;
        }
    };

    let result = (|| -> std::io::Result<()> {
        // Cria com 0600 se não existir.
        #[cfg(unix)]
        let opts = {
            use std::os::unix::fs::OpenOptionsExt;
            let mut o = OpenOptions::new();
            o.create(true).append(true).mode(0o600);
            o
        };
        #[cfg(not(unix))]
        let opts = {
            let mut o = OpenOptions::new();
            o.create(true).append(true);
            o
        };
        let mut file = opts.open(&path)?;
        writeln!(file, "{line}")?;
        Ok(())
    })();

    if let Err(e) = result {
        tracing::warn!("audit · write falhou: {e}");
    }
}
