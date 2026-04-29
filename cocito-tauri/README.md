# Cocito · 0.3.0

> *"Qui si convien lasciare ogne sospetto."* — Inferno · III · 14

**PT-PT** — Hub de comunicação desktop Dante-themed. Email + mensageria no mesmo sítio, cada serviço numa bolgia isolada. Zero backend, local-first, AI só local. Tauri 2 + React + TypeScript.

**EN** — Desktop communication hub with a Dantesque aesthetic. Email + messaging under one roof, each service in its own isolated bolgia. Zero backend, local-first, AI is local-only. Tauri 2 + React + TypeScript.

Plano completo: [`../cocito-revival-plan.md`](../cocito-revival-plan.md). Sumário operacional para futuras instâncias Claude: [`../CLAUDE.md`](../CLAUDE.md). Modelo de ameaça: [`../SECURITY.md`](../SECURITY.md).

---

## Pré-requisitos · Requirements

- **Node 20 LTS** ou superior (usamos 23.10.0 via asdf)
- **pnpm 10+** (`corepack enable pnpm`)
- **Rust stable** via rustup:
  ```bash
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
  source ~/.cargo/env
  ```
- **Xcode Command Line Tools** (macOS): `xcode-select --install`

Verificar: `node --version && pnpm --version && rustc --version && cargo --version`

## Arrancar em dev · Run in dev mode

```bash
cd cocito-tauri
pnpm install         # JS deps + fontes self-hosted (~1 min)
pnpm tauri:dev       # dev server + WebView nativa
```

Primeira execução compila ~500 crates Rust — **~3 min** com SQLCipher + reqwest + plugins. Seguintes são incrementais (1–10 s).

## Instalar a versão release · Install release

Já temos `Cocito_0.3.0_x64.dmg` em `src-tauri/target/release/bundle/dmg/`:

```bash
open src-tauri/target/release/bundle/dmg/Cocito_0.3.0_x64.dmg
# arrasta Cocito.app para /Applications
```

A app **não está code-signed** ainda (precisa Apple Developer ID). Na primeira abertura: **Ctrl+clique** no ícone → Abrir → confirma. Depois fica autorizada para sempre.

## Comandos · Commands

| Comando | O que faz |
|---|---|
| `pnpm dev` | Só Vite (frontend-only, sem WebView nativa) |
| `pnpm tauri:dev` | App completa em dev mode, com hot-reload |
| `pnpm tauri:build` | Bundle release `.dmg` em `src-tauri/target/release/bundle/dmg/` |
| `pnpm typecheck` | `tsc --noEmit` em todo o frontend |
| `pnpm test` | Vitest — 26 testes unit (parsers, babele, appearance store) |
| `pnpm test:watch` | Vitest em modo watch |
| `pnpm test:e2e` | Playwright E2E — 4 smoke tests (precisa `pnpm dev` a correr) |
| `cargo test --manifest-path src-tauri/Cargo.toml` | 10 testes Rust (secure_fs, sanitize, beatriz URLs, cérbero IDs/truncate) |
| `./scripts/sign-and-notarize.sh` | Sign + notarize com Apple ID (requer envs `APPLE_*`) |
| `./scripts/release.sh v0.3.0` | Cria GitHub release com `.dmg`, SHA256, manifest do updater |

## Como testar · How to test

### 1. Smoke: testes automáticos

```bash
pnpm typecheck                                          # TS strict
pnpm test                                               # 26 testes Vitest
cargo test --manifest-path src-tauri/Cargo.toml --lib   # 10 testes Rust
```

Tudo a verde antes de testar manualmente.

### 2. Manual: app em dev

```bash
pnpm tauri:dev
```

A janela abre. Testes a percorrer:

1. **Tema · `⌘1..⌘9`** — troca entre Cocito, Crepúsculo, Bufera, Autunno, Oro, Stige, Ferro, Flegetonte, Malebolge.
2. **Modo · `⌘,`** → secção Aparência → Auto / Claro / Escuro.
3. **Tipografia · `⌘,`** → Aparência → Sóbria / Literária / Nativa. Newsreader italic é a identidade fixa do brand.
4. **Adicionar serviço** — `+` na sidebar, escolhe (ex: WhatsApp), Adicionar. WebView do WhatsApp Web carrega.
5. **Bolgia isolada** — adiciona dois Slacks (label "Work" + tag W; label "Personal" + tag P). Cada um tem login independente — confirma fazendo logout num e o outro continua autenticado.
6. **Drag-drop** — reordena ícones na sidebar.
7. **Notifs nativas** — recebes uma mensagem real num serviço; aparece notif do macOS. Clica → Cocito traz a bolgia certa para a frente.
8. **Badges de unread** — gmail/whatsapp/slack mostram contagem no badge sobre o ícone (vem de `document.title` do serviço).
9. **Tray icon · barra superior do macOS** — mostra ícone Cocito; soma de unreads aparece como número. Clique esquerdo → toggle janela. Clique direito → menu Abrir / Preferências / Sair.
10. **Reload bolgia · `⌘R`** — recarrega a WebView ativa.
11. **Pesquisa · `⌘⇧F`** (Virgílio palette) — escreve "PROD" ou qualquer termo. Resultados vêm do SQLite (FTS5). Enter abre a bolgia.
12. **Beatriz · `⌘K`** — overlay com Ollama. Precisa `ollama serve` a correr em `localhost:11434` (ou via mDNS na LAN). Toggle "usar últimas 8 notifs" para contexto. ⌘↵ envia.
13. **Sugestão proativa Beatriz** — quando recebes 3 notifs em 30s do mesmo serviço, dispara `beatriz:suggestion` (vê a consola do dev).
14. **Scriptorium captura · `⌘⇧S`** — seleciona texto numa WebView, ⌘⇧S → cria nota markdown no vault Obsidian (configurar antes em Preferências → Scriptorium).
15. **Scriptorium URL · `⌘⇧B`** — sem seleção, guarda só URL + título.
16. **Scriptorium PDF · `⌘⇧P`** — abre diálogo nativo de print + cria nota apontando para o PDF.
17. **Minos editor** — `⌘,` → Minos → "Nova". Define gatilho (ex: `titleContains: PROD`), adiciona ação `set_theme: stige`. Gravar. Quando alguém te mencionar PROD no Slack, tema muda automaticamente.
18. **Hot-reload Minos** — edita `~/Library/Application Support/app.cocito.desktop/rules.json` num editor de texto; mudanças aplicam sem restart.
19. **Babele · idiomas** — `⌘,` → Idioma. UI muda imediatamente para PT-BR / EN / ES / IT / FR.
20. **Remover instância** — `⌘,` → Serviços → ícone do caixote. Confirma. Apaga partition (cookies + login).
21. **Sync export/import** — `cmd_sync_export` devolve JSON com config + rules. Útil para backup ou migrar para outra máquina.

### 3. Verifica segurança no disco

```bash
ls -la ~/Library/Application\ Support/app.cocito.desktop/
```

Esperado:
- pasta `0700` (`drwx------`)
- `config.json`, `rules.json`, `virgilio.sqlite` todos `0600` (`-rw-------`)
- `partitions/<inst>/` cada um `0700`
- `audit.log` aparece se removeres uma instância

### 4. Verifica encryption do Virgílio (opcional)

Em Preferências → ainda não há toggle UI (vem em v0.4). Para activar manualmente, edita `config.json` e põe `"virgilio.encryptionEnabled": true`. Reinicia. O `virgilio.sqlite` passa a estar encriptado com chave gerada e guardada no Keychain do macOS.

### 5. Auto-update (precisa GH release)

Por agora o `pubkey` em `tauri.conf.json` é placeholder. Para activar:
```bash
pnpm tauri signer generate -w ~/.cocito/tauri-signing.key
# copia o pubkey impresso para tauri.conf.json → plugins.updater.pubkey
```
Depois cada `./scripts/release.sh vX.Y.Z` publica updates que a app instalada vai pegar automaticamente.

## Arquitetura em 3 linhas

Três eixos de aparência (`data-theme` × `data-mode` × `data-typography`) no `<html>`. Uma WebView nativa por instância com `data_directory` isolado (Malebolge). Init-script universal (Cérbero) intercepta `window.Notification` + `ServiceWorkerRegistration.showNotification`, publica via custom URI scheme `cocito-ipc://` (256 KB max, IDs validados, fields truncados) → Minos julga (rule engine, 7 gatilhos, 5 ações, hot-reload) → Scriptorium arquiva no Obsidian → Virgílio indexa em SQLite com FTS5 (com SQLCipher opcional). Beatriz envia para Ollama em loopback ou LAN privada (RFC 1918) com TLS opcional self-signed; Messo descobre via mDNS.

## Atalhos

| | |
|---|---|
| `⌘ 1..9` | Trocar tema |
| `⌘ ,` | Preferências |
| `⌘ R` | Reload bolgia ativa |
| `⌘ K` | Beatriz (AI overlay) |
| `⌘ ⇧ F` | Virgílio palette (pesquisa) |
| `⌘ ⇧ S` | Scriptorium · selection quote |
| `⌘ ⇧ B` | Scriptorium · URL breadcrumb |
| `⌘ ⇧ P` | Scriptorium · PDF archive |
| `Esc` | Fecha qualquer modal |
| `Tab` / `Shift+Tab` | Navega dentro de modais (focus trap) |

## Config & storage (com permissões)

```
~/Library/Application Support/app.cocito.desktop/        drwx------  (0700)
├── config.json         appearance, instances, scriptorium, virgilio, beatriz   -rw-------  (0600)
├── rules.json          regras Minos (hot-reload)                               -rw-------
├── virgilio.sqlite     stream FTS5 (opcionalmente SQLCipher)                   -rw-------
├── audit.log           append-only de ações destrutivas (max 16 MB)            -rw-------
├── backups/            snapshots pre-sync-import                               drwx------
│   └── pre-import-*.json
└── partitions/         uma por instância (Malebolge)                           drwx------
    ├── slack-work/
    ├── gmail-personal/
    └── …
```

Windows: `%APPDATA%\app.cocito.desktop\` · Linux: `~/.config/app.cocito.desktop/`

## Os 12 módulos

| Módulo | Função |
|---|---|
| **Caronte** | Lifecycle de WebViews (open/close/show/hide/reload, validação de IDs) |
| **Malebolge** | Partitions isoladas + cleanup ao remover |
| **Cérbero** | Init-script + URI scheme `cocito-ipc://` + event bus + rate-limit + click handler v2 |
| **Minos** | Rule engine 7 gatilhos / 5 ações + hot-reload + UI dnd-kit |
| **Virgílio** | SQLite FTS5 + retenção configurável + SQLCipher opt-in + palette ⌘⇧F |
| **Scriptorium** | Selection quote ⌘⇧S, URL breadcrumb ⌘⇧B, PDF archive ⌘⇧P, integração Minos |
| **Beatriz** | Ollama HTTP streaming + contexto opcional Virgílio + sugestões proativas (burst detection) |
| **Messo** | mDNS discovery + localhost fallback + SSRF block (loopback/RFC1918) |
| **Babele** | i18n PT-PT/PT-BR/EN/ES/IT/FR aplicado globalmente |
| **Purgatorio** | Vitest (26 testes) + Rust unit tests (10) + Playwright E2E (4 smoke) |
| **Sync** | Filesystem watcher (Syncthing-side) + export/import JSON com backup |
| **Audit** | Append-only log de ações destrutivas |

(+ módulos auxiliares: `secure_fs` para 0600/0700, `keychain` para secrets, `tray` para NSStatusItem com badge.)

## Estado · v0.3.0 (2026-04-25)

- [x] **MVP** (Semanas 0–4 do plano)
- [x] **v1.1** — Beatriz, Messo, Virgílio palette, Parser packs, Babele, Scriptorium PDF, Cérbero v2, Minos editor
- [x] **v1.2** — Tray badge, persistência de unreads, loading state, ícones light, dnd-kit, sync skeleton
- [x] **Hardening de segurança** — 11 fixes documentados em [`SECURITY.md`](../SECURITY.md)
- [x] **v1.3 base** — code signing scripts, auto-update, SQLCipher opt-in, keychain, A11y, retenção Virgílio, sync watcher, Beatriz proativa, audit log
- [ ] **Apple Developer ID** + correr `sign-and-notarize.sh`
- [ ] **Builds Windows (.msi) e Linux (.AppImage)** (deferido)
- [ ] **Scriptorium PDF silencioso via CDP** (bloqueado upstream wry)

Ver [SECURITY.md](../SECURITY.md) para o roadmap defensivo.
