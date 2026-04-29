//! Scriptorium · captura para Obsidian.
//!
//! Três workflows (§8 do plano):
//!   1. Selection quote (⌘⇧S) — salvar a seleção atual na WebView como blockquote.
//!   2. URL breadcrumb (⌘⇧B) — salvar só URL + título, sem seleção.
//!   3. PDF archive (v1.1) — `webview.print_to_pdf()`.
//!
//! Também é invocado pelo Minos: regras com `save_breadcrumb` ou `save_quote`
//! disparam aqui automaticamente quando um evento do Cérbero casa.
//!
//! Storage: markdown files no vault Obsidian configurado em
//! `config.scriptorium.vaultPath`. Sub-pasta `cocito/YYYY/MM/` por default.

use std::fs;
use std::path::{Path, PathBuf};

use anyhow::{Context, Result};
use chrono::{DateTime, Local};
use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::config::ConfigState;

// ─── Payload comum ───────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CapturePayload {
    /// ID do serviço (ex: `slack`).
    pub service: String,
    /// ID da instância (ex: `slack-work`).
    pub instance: String,
    /// URL atual da WebView.
    pub url: String,
    /// Título (ex: "Sender · #general").
    pub title: String,
    /// Seleção de texto (só nos quotes).
    #[serde(default)]
    pub selection: Option<String>,
    /// Conteúdo markdown completo da página (só na captura ⌘⇧P / page archive).
    /// Quando presente, `save_page` usa-o como corpo da nota.
    #[serde(default)]
    pub content_md: Option<String>,
    /// Tag opcional (vem do Minos ou do utilizador).
    #[serde(default)]
    pub tag: Option<String>,
}

// ─── Writers ────────────────────────────────────────────────────────

/// Guarda a nota numa sub-pasta do vault. Devolve o path relativo ao vault.
pub fn save_breadcrumb(handle: &AppHandle, payload: &CapturePayload) -> Result<Option<PathBuf>> {
    let Some(vault) = resolve_vault(handle) else {
        tracing::info!("Scriptorium · vault não configurado, a ignorar breadcrumb");
        return Ok(None);
    };
    let body = render_breadcrumb(payload);
    let path = write_note(&vault, payload, "breadcrumb", &body)?;
    tracing::info!("Scriptorium · breadcrumb em {}", path.display());
    Ok(Some(path))
}

pub fn save_quote(handle: &AppHandle, payload: &CapturePayload) -> Result<Option<PathBuf>> {
    let Some(vault) = resolve_vault(handle) else {
        tracing::info!("Scriptorium · vault não configurado, a ignorar quote");
        return Ok(None);
    };
    let body = render_quote(payload);
    let path = write_note(&vault, payload, "quote", &body)?;
    tracing::info!("Scriptorium · quote em {}", path.display());
    Ok(Some(path))
}

/// Guarda a página inteira como markdown no vault. Substitui o antigo PDF
/// archive (⌘⇧P): o utilizador trabalha em Obsidian, faz mais sentido ter
/// markdown indexável e editável do que um PDF inerte.
///
/// O `payload.content_md` deve vir já extraído pela WebView via JS injection
/// (ver `cmd_save_page_markdown`). Sem isso, devolvemos erro suave (não há
/// nada para escrever).
pub fn save_page(handle: &AppHandle, payload: &CapturePayload) -> Result<Option<PathBuf>> {
    let Some(vault) = resolve_vault(handle) else {
        tracing::info!("Scriptorium · vault não configurado, a ignorar page");
        return Ok(None);
    };
    let body = render_page(payload);
    let path = write_note(&vault, payload, "page", &body)?;
    tracing::info!("Scriptorium · page em {}", path.display());
    Ok(Some(path))
}

// ─── Helpers ────────────────────────────────────────────────────────

fn resolve_vault(handle: &AppHandle) -> Option<PathBuf> {
    use tauri::Manager;
    let state = handle.try_state::<ConfigState>()?;
    let cfg = state.snapshot();
    let vault = cfg.scriptorium.vault_path?;
    let expanded = expand_tilde(&vault)?;
    let canonical = expanded.canonicalize().ok()?;

    // Defesa em profundidade: o vault tem de viver dentro do home do utilizador.
    // Evita configurações maliciosas que apontem para /etc, /System ou outros utilizadores.
    let home = dirs::home_dir()?;
    let home_canon = home.canonicalize().ok()?;
    if !canonical.starts_with(&home_canon) {
        tracing::warn!(
            "Scriptorium · vault path fora de $HOME rejeitado: {}",
            canonical.display()
        );
        return None;
    }
    if !canonical.is_dir() {
        tracing::warn!("Scriptorium · vault path não é diretório: {}", canonical.display());
        return None;
    }
    Some(canonical)
}

/// Aceita só `~/...` (relativo ao home) ou paths absolutos. Rejeita `~user/`
/// (referência a outro utilizador) e qualquer path que não seja absoluto.
fn expand_tilde(raw: &str) -> Option<PathBuf> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return None;
    }
    if let Some(stripped) = trimmed.strip_prefix("~/") {
        let home = dirs::home_dir()?;
        return Some(home.join(stripped));
    }
    if trimmed == "~" {
        return dirs::home_dir();
    }
    // ~user/... não suportado.
    if trimmed.starts_with('~') {
        return None;
    }
    let path = PathBuf::from(trimmed);
    if !path.is_absolute() {
        return None;
    }
    Some(path)
}

fn write_note(
    vault: &Path,
    payload: &CapturePayload,
    kind: &str,
    body: &str,
) -> Result<PathBuf> {
    let now: DateTime<Local> = Local::now();
    let subdir = vault
        .join("cocito")
        .join(now.format("%Y").to_string())
        .join(now.format("%m").to_string());
    fs::create_dir_all(&subdir)
        .with_context(|| format!("a criar {}", subdir.display()))?;

    // slug do ficheiro: YYYY-MM-DD-HH-MM-SS-<service>-<kind>.md
    let service_slug = slugify(&payload.service);
    if service_slug.is_empty() {
        anyhow::bail!("service vazio após sanitize");
    }
    let kind_slug = slugify(kind);
    let slug = format!(
        "{}-{}-{}.md",
        now.format("%Y-%m-%d-%H%M%S"),
        service_slug,
        kind_slug
    );
    let full = subdir.join(&slug);

    // Defesa final: o path final tem de continuar dentro do vault canónico.
    let parent_canon = subdir.canonicalize()
        .with_context(|| format!("a canonicalizar {}", subdir.display()))?;
    if !parent_canon.starts_with(vault) {
        anyhow::bail!("path traversal detectado: {}", full.display());
    }

    fs::write(&full, body).with_context(|| format!("a escrever {}", full.display()))?;

    Ok(full)
}

fn render_breadcrumb(p: &CapturePayload) -> String {
    let now: DateTime<Local> = Local::now();
    let tags = build_tags(p, "breadcrumb");
    format!(
        "---\n\
         source: {service}\n\
         instance: {instance}\n\
         url: {url}\n\
         captured_at: {ts}\n\
         title: {title:?}\n\
         tags: [{tags}]\n\
         ---\n\
         \n\
         [{title}]({url})\n",
        service = p.service,
        instance = p.instance,
        url = p.url,
        ts = now.to_rfc3339(),
        title = p.title,
        tags = tags,
    )
}

fn render_quote(p: &CapturePayload) -> String {
    let now: DateTime<Local> = Local::now();
    let selection = p.selection.as_deref().unwrap_or("");
    let tags = build_tags(p, "quote");
    let quoted = selection
        .lines()
        .map(|l| format!("> {l}"))
        .collect::<Vec<_>>()
        .join("\n");
    format!(
        "---\n\
         source: {service}\n\
         instance: {instance}\n\
         url: {url}\n\
         captured_at: {ts}\n\
         title: {title:?}\n\
         tags: [{tags}]\n\
         ---\n\
         \n\
         {quoted}\n\
         \n\
         [Abrir original →]({url})\n",
        service = p.service,
        instance = p.instance,
        url = p.url,
        ts = now.to_rfc3339(),
        title = p.title,
        tags = tags,
        quoted = quoted,
    )
}

fn render_page(p: &CapturePayload) -> String {
    let now: DateTime<Local> = Local::now();
    let content = p.content_md.as_deref().unwrap_or("_(página vazia)_");
    let tags = build_tags(p, "page");
    format!(
        "---\n\
         source: {service}\n\
         instance: {instance}\n\
         url: {url}\n\
         captured_at: {ts}\n\
         title: {title:?}\n\
         tags: [{tags}]\n\
         ---\n\
         \n\
         # {title}\n\
         \n\
         > Capturado de [{url}]({url})\n\
         \n\
         {content}\n\
         \n\
         ---\n\
         \n\
         [Abrir original →]({url})\n",
        service = p.service,
        instance = p.instance,
        url = p.url,
        ts = now.to_rfc3339(),
        title = p.title,
        tags = tags,
        content = content,
    )
}

fn build_tags(p: &CapturePayload, kind: &str) -> String {
    let mut tags = vec![
        "cocito".to_string(),
        p.service.clone(),
        kind.to_string(),
    ];
    if let Some(t) = &p.tag {
        tags.push(t.clone());
    }
    tags.iter()
        .map(|t| format!("\"{t}\""))
        .collect::<Vec<_>>()
        .join(", ")
}

fn slugify(s: &str) -> String {
    s.chars()
        .map(|c| match c {
            'a'..='z' | '0'..='9' | '-' => c,
            'A'..='Z' => c.to_ascii_lowercase(),
            _ => '-',
        })
        .collect()
}

// ─── Tauri commands (chamados pelo frontend) ─────────────────────────

#[tauri::command]
pub fn cmd_save_breadcrumb(
    handle: AppHandle,
    payload: CapturePayload,
) -> Result<Option<String>, String> {
    save_breadcrumb(&handle, &payload)
        .map(|p| p.map(|p| p.to_string_lossy().into_owned()))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn cmd_save_quote(
    handle: AppHandle,
    payload: CapturePayload,
) -> Result<Option<String>, String> {
    save_quote(&handle, &payload)
        .map(|p| p.map(|p| p.to_string_lossy().into_owned()))
        .map_err(|e| e.to_string())
}

/// Page → Markdown (⌘⇧P).
///
/// Substitui o antigo `cmd_save_pdf`: como o destino é o Obsidian (vault de
/// markdown), produzir PDF era hostil ao workflow. Esta versão extrai o
/// conteúdo da página corrente como markdown via JS injection na WebView e
/// publica via `cocito-ipc://scriptorium/save-page`. O Cérbero apanha o evento
/// e chama `save_page` com o `content_md` no payload.
///
/// O extractor JS é mínimo (zero deps): `<title>`, `<h1>..<h6>`, `<p>`, `<li>`,
/// `<a href>`, `<blockquote>`, `<pre>`. Suficiente para artigos, threads de
/// chat, emails. Não tenta clonar layout — é um snapshot textual editável.
#[tauri::command]
pub fn cmd_save_page_markdown(
    handle: AppHandle,
    instance_id: String,
    service: String,
    title: String,
    url: String,
) -> Result<(), String> {
    use tauri::Manager;
    let label = format!("svc:{instance_id}");
    let wv = handle
        .get_webview(&label)
        .ok_or_else(|| format!("WebView {label} não encontrada"))?;

    // Sem vault não há para onde escrever — fail-fast com mensagem útil.
    if resolve_vault(&handle).is_none() {
        return Err("Vault Obsidian não configurado em Preferências → Scriptorium.".into());
    }

    // Sanitização defensiva dos campos que vão entrar literais no JS injetado.
    // A WebView pertence-nos (svc:*), mas o título e URL podem conter aspas/
    // backslashes vindos da página (ex: <title>Hello "world"</title>). Usamos
    // `serde_json::to_string` que produz strings JSON válidas, seguras como
    // literal de JavaScript.
    let svc_lit = serde_json::to_string(&service).unwrap_or_else(|_| "\"\"".into());
    let inst_lit = serde_json::to_string(&instance_id).unwrap_or_else(|_| "\"\"".into());
    let title_lit = serde_json::to_string(&title).unwrap_or_else(|_| "\"\"".into());
    let url_lit = serde_json::to_string(&url).unwrap_or_else(|_| "\"\"".into());

    // O extractor: percorre o documento e produz markdown. Async porque pode
    // chamar `cmd_emit_from_webview` via __TAURI_INTERNALS__.
    let js = format!(
        r#"(async function() {{
  try {{
    function extractMd(root) {{
      const out = [];
      function walk(node) {{
        if (!node) return;
        if (node.nodeType === Node.TEXT_NODE) {{
          const t = node.textContent;
          if (t && t.trim()) out.push(t.replace(/\s+/g, ' '));
          return;
        }}
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        const tag = node.tagName.toLowerCase();
        // Ignorar ruído visual e código que não acrescenta conteúdo
        if (['script', 'style', 'noscript', 'svg', 'canvas', 'iframe'].includes(tag)) return;
        if (node.hasAttribute && node.hasAttribute('aria-hidden')) return;

        if (/^h[1-6]$/.test(tag)) {{
          const lvl = Number(tag[1]);
          out.push('\n' + '#'.repeat(lvl) + ' ' + (node.textContent || '').trim() + '\n');
          return;
        }}
        if (tag === 'p') {{
          const t = (node.textContent || '').trim();
          if (t) out.push('\n' + t + '\n');
          return;
        }}
        if (tag === 'li') {{
          const t = (node.textContent || '').trim();
          if (t) out.push('- ' + t);
          return;
        }}
        if (tag === 'blockquote') {{
          const t = (node.textContent || '').trim();
          if (t) out.push('\n' + t.split('\n').map(l => '> ' + l).join('\n') + '\n');
          return;
        }}
        if (tag === 'pre') {{
          const t = node.textContent || '';
          out.push('\n```\n' + t + '\n```\n');
          return;
        }}
        if (tag === 'a' && node.getAttribute('href')) {{
          const txt = (node.textContent || '').trim();
          const href = node.getAttribute('href');
          if (txt && href) out.push('[' + txt + '](' + href + ')');
          return;
        }}
        if (tag === 'br') {{ out.push('\n'); return; }}
        for (const child of node.childNodes) walk(child);
      }}
      walk(root);
      return out.join(' ').replace(/\n /g, '\n').replace(/\n{{3,}}/g, '\n\n').trim();
    }}

    const main = document.querySelector('main, article, [role=main]') || document.body;
    const md = extractMd(main).slice(0, 200000); // teto defensivo (~200 KB)

    const payload = {{
      service: {svc},
      instance: {inst},
      url: {url},
      title: {title},
      contentMd: md
    }};

    const internals = window.__TAURI_INTERNALS__;
    if (internals && typeof internals.invoke === 'function') {{
      await internals.invoke('cmd_emit_from_webview', {{
        kind: 'scriptorium-page',
        payload: JSON.stringify(payload)
      }});
    }} else {{
      // Fallback raro — webview sem injection do Tauri.
      await fetch('cocito-ipc://scriptorium/save-page', {{
        method: 'POST',
        headers: {{ 'Content-Type': 'application/json' }},
        body: JSON.stringify(payload)
      }});
    }}
  }} catch (e) {{
    console.warn('[cocito] save-page extractor falhou:', e);
  }}
}})();"#,
        svc = svc_lit,
        inst = inst_lit,
        url = url_lit,
        title = title_lit,
    );

    wv.eval(&js)
        .map_err(|e| format!("eval do extractor falhou: {e}"))?;

    tracing::info!(
        "Scriptorium · page extractor disparado em svc:{} ({})",
        instance_id,
        service
    );
    Ok(())
}
