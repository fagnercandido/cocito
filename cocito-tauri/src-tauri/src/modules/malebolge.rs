//! Malebolge · isolamento de sessions.
//!
//! "Luogo è in inferno detto Malebolge, tutto di pietra e di color ferrigno."
//! — Inferno · XVIII · 1–2
//!
//! Cada serviço/instância tem o seu próprio diretório de partition onde a
//! WebView guarda cookies, localStorage, IndexedDB e service workers. Nunca
//! há cruzamento. É o caminho fundamental para ter Slack Work + Slack
//! pessoal (ou dois Gmails) lado a lado sem se contaminarem.
//!
//! Em Tauri 2, passamos o path via `data_directory` ao criar a WebView.

use std::path::PathBuf;

use anyhow::{Context, Result};
use tauri::{AppHandle, Manager};

use crate::secure_fs;

/// Garante que o diretório raiz das partitions existe (com permissões 0700).
pub fn ensure_root_dir(handle: &AppHandle) -> Result<PathBuf> {
    let root = root_dir(handle)?;
    secure_fs::ensure_dir_secure(&root)
        .with_context(|| format!("a criar {} com 0700", root.display()))?;
    tracing::debug!("Malebolge · raiz de partitions em {}", root.display());
    Ok(root)
}

/// Devolve o path (criando se preciso) da bolgia de uma dada instância.
pub fn partition_dir(handle: &AppHandle, instance_id: &str) -> Result<PathBuf> {
    let slug = sanitize_slug(instance_id);
    if slug.is_empty() {
        anyhow::bail!("instance_id vazio após sanitize");
    }
    let dir = root_dir(handle)?.join(slug);
    secure_fs::ensure_dir_secure(&dir)
        .with_context(|| format!("a criar partition {} com 0700", dir.display()))?;
    Ok(dir)
}

/// Apaga a partition (cookies, sessões, IndexedDB, …) de uma instância.
/// Chamado quando a instância é removida da sidebar — sem isto, ficheiros
/// órfãos com login persistem no disco.
pub fn delete_partition(handle: &AppHandle, instance_id: &str) -> Result<()> {
    let slug = sanitize_slug(instance_id);
    if slug.is_empty() {
        return Ok(()); // nada a fazer
    }
    let dir = root_dir(handle)?.join(&slug);
    if !dir.exists() {
        return Ok(());
    }
    // Defesa: confirma que o path está dentro da raiz das partitions
    // (canonicalize falharia em symlinks fora do home — bloqueia o delete).
    let root = root_dir(handle)?;
    let canon = std::fs::canonicalize(&dir)
        .with_context(|| format!("canonicalize {}", dir.display()))?;
    let root_canon = std::fs::canonicalize(&root)
        .with_context(|| format!("canonicalize {}", root.display()))?;
    if !canon.starts_with(&root_canon) {
        anyhow::bail!("partition fora da raiz: {}", canon.display());
    }
    std::fs::remove_dir_all(&canon)
        .with_context(|| format!("a apagar {}", canon.display()))?;
    tracing::info!("Malebolge · partition apagada: {slug}");
    Ok(())
}

fn root_dir(handle: &AppHandle) -> Result<PathBuf> {
    let base = handle
        .path()
        .app_data_dir()
        .context("não consigo resolver app_data_dir")?;
    Ok(base.join("partitions"))
}

/// Aceita apenas `[a-z0-9-]` — tudo o resto vira `-`. Impede fuga do diretório
/// raiz por IDs mal formados.
fn sanitize_slug(raw: &str) -> String {
    raw.chars()
        .map(|c| match c {
            'a'..='z' | '0'..='9' | '-' => c,
            'A'..='Z' => c.to_ascii_lowercase(),
            _ => '-',
        })
        .collect()
}

// ─── Tauri command ───────────────────────────────────────────────────

/// Expõe o path ao frontend. Útil para debug na UI de Preferências.
#[tauri::command]
pub fn cmd_partition_path(handle: AppHandle, instance_id: String) -> Result<String, String> {
    partition_dir(&handle, &instance_id)
        .map(|p| p.to_string_lossy().into_owned())
        .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::sanitize_slug;

    #[test]
    fn sanitize_lowercases_and_strips_unsafe_chars() {
        assert_eq!(sanitize_slug("Slack-Work"), "slack-work");
        assert_eq!(sanitize_slug("gmail/personal"), "gmail-personal");
        assert_eq!(sanitize_slug("../evil"), "---evil");
        assert_eq!(sanitize_slug("Gmail · Personal"), "gmail---personal");
    }
}
