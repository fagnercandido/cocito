# Cocito — Revival Plan (rev 3, event-driven)

> *"Qui si convien lasciare ogne sospetto; / ogne viltà convien che qui sia morta."*
> — Inferno · III · 14–15

Unificação do projeto Cocito (cliente de email Dante-themed) com o agregador de mensagens antes chamado Malebolge. A app passa a ser um **hub único de comunicação desktop** — email + mensageria no mesmo sítio, com a mesma filosofia: zero backend, local-first, AI só local, nove ambientes.

**Rev 2 (decreto arquitetural):** tudo passa por WebView isolada. Sem exceções. Email é um serviço como outro qualquer. Zero OAuth gerido pela app, zero API keys, zero verificações Google/Microsoft.

**Rev 3 (backbone de eventos):** Cérbero vira o nervo central. Intercepta a Web Notification API de cada serviço via `initialization_script`, transforma cada notificação num evento estruturado, e publica num bus interno. Minos, Virgílio, Scriptorium e Beatriz passam a consumir esse stream — sem DOM scraping, sem scripts frágeis per-service, sem scrape loops. Uma fonte de verdade universal.

---

## 1. Visão

Cocito é o nono círculo — o lago gelado para onde todos os rios do Inferno convergem. Simbolicamente perfeito para uma app onde todas as tuas comunicações convergem. Cada serviço vive numa bolgia isolada (WebView próprio, session própria, sem cruzamento), o Cérbero capta cada notif emitida por cada bolgia, e os outros módulos operam sobre esse stream. O utilizador escolhe em qual dos nove ambientes quer trabalhar.

O nome antigo — Malebolge — não morre. Passa a ser o **módulo** que faz o isolamento de serviços dentro do Cocito. Em Dante, Malebolge é o oitavo círculo, dividido em dez bolgie estanques. A metáfora casa exatamente com o que a camada faz: cada serviço a sua bolgia isolada.

**Princípios invariantes:**

- **Arquitetura WebView-only.** Todo serviço — email incluído — é uma WebView isolada. Login sempre pela UI do provider.
- **Event-driven via Notification API interception.** Cérbero intercepta `window.Notification` e `ServiceWorkerRegistration.prototype.showNotification` em cada WebView. Esse é o backbone de todos os features cross-service.
- **Zero backend próprio.** Nenhuma infra do Cocito corre na cloud de ninguém.
- **Zero OAuth gerido pela app.** Sem registos Google/Microsoft, sem CASA, sem verification flows.
- **Local-first.** Config, cache, indexes em disco, por device.
- **AI só local.** Ollama via rede local, via módulo Messo. Tudo dentro da máquina.
- **Cada serviço isolado.** Sessions, cookies, storage — nunca partilhados.
- **Dante como guia, não como decoração gótica.** Referências subtis, nunca folclore.
- **Aparência = 3 eixos ortogonais.** `data-theme` (9 círculos) × `data-mode` (light/dark/auto) × `data-typography` (Sóbria/Literária/Nativa). Tudo aplicado via CSS custom properties no `<html>`, mudança em tempo real, zero reload. Identidade fixa: brand sempre em Newsreader italic.

---

## 2. Stack — definitivo

**Antes (Cocito original):** Swift 6 + SwiftUI, iOS + iPadOS + macOS, Apple Intelligence + Ollama.

**Agora:** Tauri 2 + React + TypeScript, desktop-first (macOS + Windows + Linux), só Ollama.

### Runtime & build

- **Tauri 2** — Rust backend, binário nativo, WebView nativa do SO
- **Rust stable** — backend (file I/O, partitions, mDNS, Ollama bridge, event bus)
- **Node.js 20 LTS + pnpm** — dev environment
- **Vite 5** — dev server e build

### Frontend

- **React 18 + TypeScript 5** — UI
- **Tailwind CSS 3 + CSS variables** — design system dos 9 temas
- **Zustand** — state management (~1 KB, minimalista)
- **Lucide React** — ícones
- **Framer Motion** — micro-animações

### WebView layer

- Nativo do SO: **WebKit** (macOS), **WebView2** (Windows), **WebKitGTK** (Linux)
- UA spoofing per-service
- **Initialization script universal** injectado pelo Tauri em cada WebView antes do código do serviço arrancar — este script faz override da Web Notification API

### Tauri plugins

- `tauri-plugin-fs` — config, partitions, Scriptorium file I/O
- `tauri-plugin-notification` — notifs nativas do SO (Cérbero output)
- `tauri-plugin-mdns` — Messo (Ollama discovery)
- `tauri-plugin-sql` — Virgílio (SQLite)
- `tauri-plugin-shell` — abrir URLs externas
- `tauri-plugin-updater` — auto-update (opcional)
- Capability `webview.print-to-pdf` — Scriptorium PDF archive

### AI

- **Ollama** via HTTP local (bridge em Rust)
- **qwen3:32b** no Mac M1 64 GB (setup que já tens)

### Distribuição

- `.dmg` (macOS universal arm64 + x86_64)
- `.msi` (Windows x64)
- `.AppImage` (Linux x64)

Zero Electron. Zero Chromium empacotado. Zero Swift. Zero API clients para providers.

---

## 3. Aparência — três eixos de personalização

A aparência do Cocito é definida por **três atributos no `<html>`**, ortogonais entre si e aplicáveis em tempo real:

| Atributo | Valores | Default |
|---|---|---|
| `data-theme` | `cocito` · `crepuscolo` · `bufera` · `autunno` · `oro` · `stige` · `ferro` · `flegetonte` · `malebolge` | `cocito` |
| `data-mode` | `light` · `dark` · *ausente* (segue `prefers-color-scheme`) | ausente (auto) |
| `data-typography` | `sobria` · `literaria` · `nativa` | `sobria` |

Nove temas × dois modos × três tipografias = 54 combinações válidas. Todas são WCAG AA.

### 3.1 Os nove temas

Cada círculo do Inferno é um ambiente distinto, não só uma paleta. A mesma app — nove rostos, cada rosto com variante **light e dark**.

| Nº | Círculo | Nome do tema | Atmosfera | Uso sugerido | Essência |
|---|---|---|---|---|---|
| I | Limbo | **Crepúsculo** | Pergaminho, fim de tarde | Manhã, leitura lenta | light-first |
| II | Luxúria | **Bufera** | Vinho escuro, rosas sangue | Noite íntima | dark-first |
| III | Gula | **Autunno** | Âmbar, musgo, chuva | Tarde fria, newsletters | dark-first |
| IV | Avareza | **Oro** | Dourado sóbrio em noite | Trabalho executivo | dark-first |
| V | Ira | **Stige** | Vermelho profundo | Foco, dias duros | dark-first |
| VI | Heresia | **Ferro** | Brasa, ferro quente | Alta vibração | dark-first |
| VII | Violência | **Flegetonte** | Fogo líquido | Momentos importantes | dark-first |
| VIII | Fraude | **Malebolge** | Verde ácido | Code review, dev | dark-first |
| IX | Traição | **Cocito** (default) | Azul gelo sobre noite | Uso diário | dark-first |

Cada tema define 7 tokens base — `--bg`, `--surface`, `--surface-2`, `--text`, `--text-dim`, `--accent`, `--border` — mais um gradiente radial atmosférico (`--grad`), em **duas variantes**. Por default segue `prefers-color-scheme`; `data-mode` override força manualmente. Regras invariantes: ícone único (lago gelado), gradiente atmosférico próprio, accents saturados. Cores calibradas para serem **fortes**, não tímidas — cada círculo tem de gritar o seu carácter.

### 3.2 Modo (light / dark / auto)

Decisão de design em 2026-04-24: cada tema tem de responder a light e dark do sistema, não ser exclusivamente dark. Implementação canónica:

```css
[data-theme="cocito"] { /* tokens dark (default visual do tema) */ }
[data-theme="cocito"][data-mode="light"] { /* tokens light forçados */ }
@media (prefers-color-scheme: light) {
  [data-theme="cocito"]:not([data-mode="dark"]) { /* tokens light por sistema */ }
}
```

Crepúsculo inverte (light é a essência, dark é a adaptação).

### 3.3 Tipografia — três stacks curadas

Tipografia é preferência do utilizador, não decisão fixa. Três stacks, nunca misturar à mão:

| Stack | Sans | Serif | Mono | Quando |
|---|---|---|---|---|
| **Sóbria** (default) | Inter v4 (variable) | Newsreader (opsz 6–72 variable, italic) | JetBrains Mono (variable) | Uso diário, UI densa, identidade literária subtil |
| **Literária** | General Sans (variable) | Spectral (200–800, italic) | Geist Mono (variable) | Mais presença italiana; texto longo que respira |
| **Nativa** | system-ui cascade (SF Pro, Segoe UI, …) | ui-serif (New York no Mac, Georgia fora) | ui-monospace (SF Mono, Cascadia Code, …) | Integração total com o SO; zero bundle usado |

**Identidade fixa (inviolável):** o nome da app no título da janela, hero e splash screen usam **sempre Newsreader italic**, independentemente da stack escolhida. Assim o Cocito é reconhecível em qualquer screenshot, em qualquer configuração. É a assinatura visual.

Peso no binário: ~1 MB com todas as fontes carregadas (Sóbria ~450 KB + Literária ~400 KB + Nativa 0). Todas **self-hosted em `cocito-tauri/src/fonts/*.woff2`** — zero fetch externo, zero Google Fonts em runtime. Coerente com a invariante "local-first, zero cloud".

### 3.4 Fonte de verdade

Até ao scaffold, a **fonte de verdade visual** vive em quatro ficheiros de [mockups/](mockups/):

- [mockups/themes.html](mockups/themes.html) — catálogo das 9 paletas em pares light/dark, com swatches + samples.
- [mockups/layout.html](mockups/layout.html) — janela completa do Cocito; switcher de tema + modo vivo.
- [mockups/typography.html](mockups/typography.html) — comparação Sóbria vs Literária, features ricas (opsz, italic, pesos, ligaduras).
- [mockups/preferences.html](mockups/preferences.html) — ecrã de Preferências → Aparência com os 3 eixos vivos e preview ao vivo.

Depois do scaffold, os tokens promovem-se para:
- `cocito-tauri/src/themes/<slug>.css` (um por tema, light + dark)
- `cocito-tauri/src/typography/<stack>.css` (um por stack)
- `cocito-tauri/src/fonts/*.woff2` (fontes variáveis self-hosted)

---

## 4. Os dez módulos

Mantemos os nove módulos planeados na Cocito original e acrescentamos **Malebolge** — o módulo que isola serviços em bolgie separadas. Cérbero passa a ser o nervo central, e Minos/Virgílio/Scriptorium/Beatriz tornam-se consumidores do stream que ele publica.

| Módulo | Função |
|---|---|
| **Caronte** | Lifecycle dos WebViews: load, reload, logout, UA spoofing, sleep/wake. |
| **Malebolge** | Isolamento de sessions. Um diretório de partition por serviço/instância. Cookies e storage nunca cruzados. |
| **Cérbero** | **Backbone event-driven.** Intercepta Web Notification API em cada WebView; transforma cada notif num evento estruturado; envia para o SO como notif nativa; publica no event bus interno. Também observa `document.title` para manter contagens de badge na sidebar. |
| **Minos** | Rule engine. Casa padrões no stream do Cérbero e dispara ações (silenciar, marcar prioridade, mudar tema, salvar no Obsidian via Scriptorium, reencaminhar). |
| **Virgílio** | Indexador em SQLite local do stream do Cérbero, do histórico de URLs visitadas, e dos saves do Scriptorium. Pesquisa cross-service via palette. |
| **Scriptorium** | Três workflows user-driven de captura para Obsidian: selection quote, URL breadcrumb, PDF archive. Também pode ser acionado passivamente por regras do Minos. |
| **Beatriz** | AI via Ollama. Dois modos: (1) selection-based — utilizador seleciona texto em qualquer WebView, ⌘K abre painel overlay com Ollama; (2) context-based — consome o stream do Cérbero para sugerir resumos/drafts. |
| **Messo** | Descoberta do servidor Ollama na rede local (mDNS/Bonjour). |
| **Babele** | i18n (PT-PT, PT-BR, EN, ES, IT, FR). |
| **Purgatorio** | Infra de testes. Vitest + Playwright. |

---

## 5. Cérbero — o backbone em detalhe

Antes o Cérbero era "badges e notifs". Agora é o nervo central da app.

### Mecanismo

Em cada WebView, o Tauri injeta um `initialization_script` *antes* do código do serviço arrancar. Este script faz dois overrides universais:

```js
// (pseudocódigo — real tem fallbacks, error handling, serialização)

const originalNotif = window.Notification;

function cocitoEmit(payload) {
  window.__TAURI__.event.emit("cocito:notification", {
    service: window.__COCITO_SERVICE_ID__,
    instance: window.__COCITO_INSTANCE_ID__,
    timestamp: Date.now(),
    ...payload,
  });
}

window.Notification = function(title, options = {}) {
  cocitoEmit({
    title,
    body: options.body,
    tag: options.tag,
    icon: options.icon,
    data: options.data,
    url: window.location.href,
  });
  return new originalNotif(title, options);
};
window.Notification.permission = "granted";
window.Notification.requestPermission = async () => "granted";

const originalSwShow = ServiceWorkerRegistration.prototype.showNotification;
ServiceWorkerRegistration.prototype.showNotification = function(title, options = {}) {
  cocitoEmit({ title, body: options.body, tag: options.tag, icon: options.icon, url: self.location?.href });
  return originalSwShow.call(this, title, options);
};
```

Dois pontos importantes:

1. **Duas entradas.** Slack usa `ServiceWorkerRegistration.showNotification` pesadamente (via push); Gmail e outros usam `window.Notification` direto. Cobrir ambos capta ~99% dos serviços.
2. **Auto-grant de permissão.** Forçamos `Notification.permission = "granted"` para o serviço nem tentar pedir autorização ao utilizador.

### Porque é que isto sobrevive a refactors

`window.Notification` é Web API standard — parte da especificação HTML. Slack, Gmail, WhatsApp Web não vão deixar de usar isto sem mudar como as notifs funcionam em *todos* os navegadores. Se algum dia um serviço trocar para outra coisa (ex: só WebPush sem chamar `showNotification`), partimos o override desse serviço específico e mantemos todos os outros.

É mil vezes mais estável que scrape de DOM.

### Schema do evento

```json
{
  "service": "slack",
  "instance": "slack-work",
  "timestamp": 1745511600000,
  "title": "Zé · #general",
  "body": "passas-me o endpoint do DSM?",
  "tag": "msg:C0123:17...",
  "icon": "https://...",
  "url": "https://app.slack.com/client/T.../C..."
}
```

Este objeto é o que Minos, Virgílio, Scriptorium e Beatriz vêem.

### Limitações honestas

- **Só capta o que o serviço notifica.** Mensagem em canal silenciado do Slack → sem notif → não entra no stream. Alinha com a filosofia: Cocito tem memória do que te chamou atenção.
- **Só capta com a app aberta.** Se a Cocito estiver fechada, as notifs disparadas pelos Service Workers podem chegar ao SO, mas a app não as intercepta (o `initialization_script` só corre quando a WebView está carregada).
- **Parsing de title é heurístico.** Slack põe "Sender · #channel" no title, Gmail põe "Sender - Subject". Para features que precisam separar sender/channel, há um pequeno parser per-service (Minos usa isto), mas o evento bruto já é útil sem ele.

---

## 6. Minos — rule engine no stream

Rule engine que casa padrões em eventos do Cérbero e dispara ações. IFTTT para comunicações, sem cloud.

### Estrutura de uma regra

```json
{
  "id": "prod-alerts",
  "name": "Alertas de PROD em destaque",
  "enabled": true,
  "when": {
    "service": "slack",
    "instance": "slack-work",
    "title_contains": "PROD"
  },
  "do": [
    { "action": "priority_notify", "sound": "glass" },
    { "action": "set_theme", "theme": "stige", "duration": "30m" },
    { "action": "save_breadcrumb", "tag": "#prod" }
  ]
}
```

### Gatilhos disponíveis (v1)

- `service` — igualdade exata
- `instance` — igualdade exata (ex: separar Slack Work de Slack pessoal)
- `title_contains` / `title_matches` — string ou regex
- `body_contains` / `body_matches` — string ou regex
- `sender` — parseado do title via parser per-service
- `time_between` — janela horária (ex: `"18:00-09:00"`)
- `day_of_week` — lista de dias

### Ações disponíveis (v1)

- `silence` — suprime a notif do SO (o evento continua a entrar no stream para o Virgílio)
- `priority_notify` — notif com som específico e sem ser suprimível por DND
- `set_theme` — muda tema do Cocito por tempo definido
- `save_breadcrumb` — Scriptorium cria nota com URL, título, timestamp
- `save_quote` — Scriptorium cria nota com corpo da notif como blockquote
- `forward_to` — encaminha via outro serviço (v2; exige content script)
- `archive_in_service` — auto-arquiva no serviço (v2; exige automação per-service)

### Casos concretos para ti

- Slack Work → título contém `PROD` → priority + tema Stige 30 min + breadcrumb com tag `#prod`
- Gmail → sender = mãe → priority com som custom, ignora DND
- WhatsApp → grupo Work + hora 18h-9h → silence + agenda digest para 9h via regra de hora
- Qualquer serviço → body contém `meu-nome` → save_quote no Obsidian + priority
- Gmail → sender matches `.*recruitment.*` → silence + breadcrumb (nunca perde, nunca interrompe)

Interface: UI de regras em preferências, visual (não JSON na cara do utilizador). JSON é só o formato de armazenamento.

---

## 7. Virgílio — pesquisa sobre o stream

Virgílio indexa três fontes em SQLite local:

1. **Stream do Cérbero** — cada evento intercetado vira uma row (`notifications` table).
2. **Histórico de URLs** — cada navegação dentro de uma WebView é logada (`nav_history` table com service, instance, url, title, timestamp).
3. **Saves do Scriptorium** — referências às notas criadas, com body extraído, para permitir pesquisa full-text do conteúdo salvo.

### Pesquisa via palette (⌘⇧F)

- `DSM` → todas as notifs que mencionam DSM nos últimos 30 dias, cross-service, ordenadas por data
- `segunda` (ou range de datas) → tudo o que aconteceu entre X e Y
- `from:zé DSM` → mensagens do Zé que mencionam DSM (parse de sender via regra per-service)
- `in:slack-work JWS` → só no workspace Work
- `tag:#prod` → tudo marcado por regras do Minos com essa tag

Cada resultado mostra origem + preview + timestamp + "Open" (leva ao URL guardado) e "Reveal" (abre o serviço e posiciona na thread, quando o URL permite).

### Privacy e opt-in

- Cada serviço tem flag "Indexar em Virgílio" — default ON para trabalho, pode ser OFF para pessoal.
- Há um comando "Forget from Virgílio" que apaga rows matching um filtro.
- Há retenção configurável (default: 90 dias; pode ser "forever" ou "7 days").
- Tudo em SQLite local — `~/Library/Application Support/Cocito/index.sqlite`. Utilizador pode apagar o ficheiro e o Cocito continua a funcionar sem memória histórica.

### Limitação honesta

Virgílio só sabe o que passou pelo Cérbero ou pelo Scriptorium. Mensagem em canal silenciado não aparece. Alinha com o princípio: memória do que te chamou atenção, não arquivo total de tudo.

---

## 8. Scriptorium — captura para Obsidian

Três workflows, todos user-driven + um acionável por regras do Minos.

### 1. Selection quote (principal)

- Utilizador seleciona texto em qualquer WebView (Slack, Gmail, qualquer)
- Atalho ⌘⇧S
- Scriptorium pega: seleção + URL atual + título da página + service/instance + timestamp
- Cria nota no vault Obsidian configurado, com frontmatter completo e o texto como blockquote

Exemplo de output:

```markdown
---
source: slack
instance: slack-work
url: https://app.slack.com/client/T.../C.../thread/...
captured_at: 2026-04-24T14:32:00+01:00
title: "Zé · #general"
tags: [cocito, slack, spg]
---

> passas-me o endpoint do DSM? preciso testar o JWS antes do merge

[Abrir original →](https://app.slack.com/client/T.../C.../thread/...)
```

É Kindle Clippings para conversas.

### 2. URL breadcrumb

- Sem seleção, só flag posição atual
- Atalho ⌘⇧B
- Cria nota curta com só URL + título + timestamp + service/instance
- Útil para "quero lembrar-me disto sem interromper o flow"

### 3. PDF archive

- Comando "Save as PDF" na toolbar da WebView ativa
- Tauri chama `webview.print_to_pdf()`
- Scriptorium guarda o PDF em `<vault>/attachments/cocito/` e cria nota markdown com metadados apontando para o PDF
- Snapshot visual completo, arquivístico. Para conversas importantes.

### Integração com Minos

A ação `save_quote` ou `save_breadcrumb` numa regra do Minos chama o Scriptorium sem intervenção do utilizador. Assim Scriptorium é também passivo quando faz sentido ("cada notif do CEO → breadcrumb automático").

---

## 9. Catálogo de serviços — v1

Pré-configurados no arranque. Com o Cérbero universal, o JSON ficou mais simples — já não precisa de `contentScripts` per-service no MVP:

```json
{
  "id": "gmail",
  "name": "Gmail",
  "url": "https://mail.google.com",
  "icon": "gmail.svg",
  "userAgent": "chrome-desktop",
  "canHaveMultipleInstances": true,
  "titleBadgePattern": "^\\((\\d+)\\)",
  "senderParser": "gmail"
}
```

- `titleBadgePattern` — regex para extrair contagem de `document.title` (badge na sidebar).
- `senderParser` — nome do parser per-service usado pelo Minos quando precisa separar sender do title. Parsers vivem em `src/parsers/` como funções puras TypeScript (curtas, uma per service).

**Mensageria pessoal:** WhatsApp, Telegram, Signal (limitado), Discord
**Trabalho:** Slack, Microsoft Teams, Google Chat
**Email:** Gmail, Outlook, ProtonMail Web, Fastmail, Tutanota, Zoho Mail
**Social (opcional):** X, LinkedIn Messaging, Instagram DMs
**Custom:** utilizador define URL, ícone e UA próprios

`canHaveMultipleInstances: true` permite Gmail pessoal + Gmail do trabalho + Slack pessoal + Slack Work separados, cada um na sua bolgia.

---

## 10. Arquitetura

```
┌──────────────────────────────────────────────────────────┐
│  Cocito (Tauri window)                                   │
│                                                          │
│  ┌────────┬───────────────────────────────────────────┐  │
│  │        │  WebView do serviço ativo                 │  │
│  │Sidebar │  (WebKit / WebView2 / WebKitGTK nativo)   │  │
│  │ React  │                                           │  │
│  │   +    │  ┌─────────────────────────────────────┐  │  │
│  │ themes │  │ Initialization script universal:    │  │  │
│  │        │  │  · window.Notification override     │  │  │
│  │  Ws    │  │  · ServiceWorker.showNotification   │  │  │
│  │  Tg    │  │  · document.title observer (badge)  │  │  │
│  │ [Sl]   │  │                                     │  │  │
│  │  Gm    │  │  emit("cocito:notification", ...)   │  │  │
│  │   +    │  └─────────────────────────────────────┘  │  │
│  └────────┴───────────────────────────────────────────┘  │
│              │                                           │
│              ▼                                           │
│  ┌──────────────────────────────────────────────────┐    │
│  │  Cérbero (Rust) — event bus                      │    │
│  │    ingests, normalizes, enriches, republishes    │    │
│  └──────────────────────────────────────────────────┘    │
│        │              │              │         │         │
│        ▼              ▼              ▼         ▼         │
│    ┌──────┐      ┌────────┐    ┌──────────┐ ┌───────┐    │
│    │Minos │      │Virgílio│    │Scriptori.│ │Beatriz│    │
│    │rules │      │SQLite  │    │Obsidian  │ │Ollama │    │
│    └──────┘      └────────┘    └──────────┘ └───────┘    │
│        │                                                 │
│        └─▶ notif nativa do SO · set_theme · forward ...  │
│                                                          │
│  Rust backend (Tauri commands):                          │
│  • Config store (JSON local)                             │
│  • Partition manager (Malebolge) — dir per serviço       │
│  • mDNS discovery (Messo)                                │
│  • Ollama HTTP bridge (Beatriz backend)                  │
│  • Obsidian file I/O (Scriptorium backend)               │
│  • SQLite (Virgílio)                                     │
│  • Rule engine (Minos)                                   │
└──────────────────────────────────────────────────────────┘

Storage (macOS):
~/Library/Application Support/Cocito/
  ├── config.json              — serviços ativos, ordem, tema
  ├── services.json            — catálogo local (editável)
  ├── rules.json               — regras do Minos
  ├── partitions/              — uma bolgia por serviço
  │   ├── slack-work/
  │   ├── gmail-personal/
  │   └── ...
  └── index.sqlite             — Virgílio

Windows:   %APPDATA%\Cocito\
Linux:     ~/.config/Cocito/
```

A única comunicação externa é a WebView com o provider (direta, sem intermediação da app) e o bridge Rust→Ollama (localhost ou LAN via Messo).

---

## 11. Roadmap 4 semanas — MVP

### Semana 0 — Design system (✅ feito · 2026-04-24)
- 9 temas calibrados, em pares light/dark, tokens definidos em [mockups/themes.html](mockups/themes.html).
- Layout completo (Franz-style) validado em [mockups/layout.html](mockups/layout.html), com ícones reais das apps e switcher de tema + modo.
- Stacks tipográficas decididas: Sóbria (default), Literária, Nativa — comparadas em [mockups/typography.html](mockups/typography.html).
- Ecrã de Preferências → Aparência prototipado em [mockups/preferences.html](mockups/preferences.html), com 3 eixos vivos e preview em tempo real.
- **Entregável:** fonte de verdade visual fechada. Basta transcrever para CSS + componentes React.

### Semana 1 — Fundação
- Scaffold Tauri 2 + React + TypeScript + Tailwind + Vite.
- Promover tokens: `src/themes/*.css` (9 ficheiros light+dark) + `src/typography/*.css` (3 stacks) + `src/fonts/*.woff2` self-hosted.
- Aplicar `data-theme` / `data-mode` / `data-typography` no `<html>` via Zustand store.
- Janela principal: title bar + sidebar de serviços + área central + status bar — tudo a partir do [mockups/layout.html](mockups/layout.html).
- Primeiro WebView funcional com UA spoofing (Gmail + Slack).
- Config storage em JSON local.
- **Entregável:** app abre no tema Cocito, Gmail e Slack carregam; trocar tema/modo/tipografia em devtools propaga instantaneamente.

### Semana 2 — Malebolge e catálogo
- Módulo Malebolge: partition per service/instance (diretório isolado), cookies/storage nunca cruzados.
- `services.json` inicial com 15 serviços (catálogo da §9).
- UI de "Adicionar serviço" com suporte a múltiplas instâncias (Slack Work + Slack pessoal).
- Reorder da sidebar via drag-drop.
- Sidebar com ícones reais + tag de instância (A/P), como em [mockups/layout.html](mockups/layout.html).
- **Entregável:** Slack Work + Slack pessoal + Gmail pessoal + Outlook Work lado a lado, zero cruzamento.

### Semana 3 — Cérbero, preferências e temas
- Initialization script universal: override de `window.Notification` e `ServiceWorkerRegistration.showNotification`.
- Rust event bus (`cocito:notification` → handlers subscritores).
- Notifs nativas do SO via Tauri.
- Title observer para badges na sidebar.
- **Ecrã de Preferências → Aparência** em React, transcrito de [mockups/preferences.html](mockups/preferences.html): 3 eixos (tema + modo + tipografia) com preview ao vivo.
- Atalhos ⌘1..⌘9 (tema), persistência em `config.json`.
- Tray icon com resumo de unreads.
- **Entregável:** stream de eventos vivo (log de debug), badges funcionais, Preferências a mudar aparência on-the-fly sem reload.

### Semana 4 — Minos básico, Scriptorium básico, distribuição
- Minos v0: regras em JSON (sem UI ainda), 5 ações core (silence, priority_notify, set_theme, save_breadcrumb, save_quote).
- Scriptorium v0: selection quote (⌘⇧S) + URL breadcrumb (⌘⇧B).
- Virgílio v0: captura eventos e guarda em SQLite (pesquisa fica para v1.1).
- Micro-animações, empty/loading/error states.
- Builds `.dmg` / `.msi` / `.AppImage`.
- README bilingue PT-PT + EN.
- **Entregável:** app distribuível, primeira regra do Minos a funcionar (ex: PROD em Slack → tema Stige com notif de prioridade), primeiro save no Obsidian.

---

## 12. Pós-MVP — v1.1 e v1.2 entregues (2026-04-24)

### v1.1 — implementado
- ✅ **Beatriz v1** — overlay ⌘K com Ollama HTTP streaming + escolha de host/modelo
- ✅ **Beatriz v2** — toggle "usar últimas 8 notifs como contexto" (puxa do Virgílio)
- ✅ **Messo** — mDNS discovery (`_ollama._tcp` + `_http._tcp` porto 11434) + localhost fallback
- ✅ **Virgílio palette ⌘⇧F** — UI sobre FTS5 com navegação ↑↓ e abrir bolgia
- ✅ **Parser packs** — Slack/Gmail/Outlook/WhatsApp/Telegram/Discord/Teams (extraem sender/channel/subject)
- ✅ **Babele i18n** — 6 idiomas (PT-PT, PT-BR, EN, ES, IT, FR), aplicado globalmente
- ✅ **Scriptorium PDF archive** — ⌘⇧P (usa diálogo nativo; CDP silencioso fica para v1.3)
- ✅ **Cérbero v2** — click handler em notifs do SO (mapping title→instance, foca a bolgia)
- ✅ **Minos UI editor** — secção Preferências com CRUD visual + drag-drop (dnd-kit) + save_rules
- ✅ **Dívidas técnicas** — rate-limit Cérbero (200ms title debounce), beatriz/messo deixaram de ser stubs

### v1.2 — implementado
- ✅ **Tray badge** — `cmd_tray_set_unread` muda título do NSStatusItem com soma de unreads
- ✅ **Persistência de unreads** — campo `unread` em `InstanceConfig`, persiste entre arranques
- ✅ **Loading state na WebView** — overlay com spinner enquanto a primeira renderização não acontece
- ✅ **Ícones light-friendly** — drop-shadow subtil em modo light para preservar legibilidade
- ✅ **Babele aplicado globalmente** — Sidebar, AddServiceSheet, EmptyState, PausedState, Beatriz, Palette, StatusBar
- ✅ **Parser packs com consumidor** — tooltip da sidebar enriquecido com último sender/channel
- ✅ **Sync skeleton** — `cmd_sync_export`/`cmd_sync_import` (transport real fica para v1.2 final)
- ✅ **Testes Vitest** — 11 testes (parsers + babele)

## 12.1 — Próximas iterações

- **Minos UI** — editor visual de regras em preferências, condições e ações drag-drop. Biblioteca de regras prontas ("PROD alerts", "após o expediente", etc.).
- **Virgílio palette (⌘⇧F)** — pesquisa cross-service sobre o que o Cérbero capturou, + navegação ao original.
- **Beatriz v1** — selection + ⌘K panel overlay → Ollama resume/drafta/extrai ações.
- **Beatriz v2** — botão "resume a conversa visível" que usa stream do Cérbero como contexto (últimas N notifs do mesmo `instance`/`thread`).
- **Scriptorium v1.1** — PDF archive workflow.
- **Parser packs per-service** — parsers de title para separar sender/channel em cada serviço. Padrão Ferdium recipes: JSON+JS no disco, atualizável sem rebuild.
- **Rule actions avançadas** — `forward_to` (exige content script de automação per-service), `archive_in_service`.
- **Babele** — i18n completa.
- **Cérbero v2** — captura adicional de clicks em notifs (permite "abrir no Cocito" em vez de "abrir no browser").

---

## 13. Non-goals explícitos

- **Mobile (iOS/Android).** Voltamos a isto só com estratégia nativa de API, se houver tração em desktop.
- **OAuth flows geridos pela app.** Login sempre pela UI do provider dentro da WebView.
- **Email APIs.** Zero Gmail API, zero MS Graph, zero IMAP, zero SMTP. Tudo via web UI.
- **CASA, Google app verification, publisher verification da Microsoft.** Nenhuma necessidade.
- **App stores.** Sandbox do Mac App Store não permite partitions customizadas desta forma. Distribuição via site próprio, Homebrew.
- **Apple Intelligence.** Só Ollama.
- **Cloud sync entre devices.** Cada device é ilha.
- **AI cloud providers** (OpenAI, Anthropic, Google, xAI, Mistral). Proibido por princípio.
- **Empacotar conta de utilizador Cocito.** Zero backend = zero conta.
- **Indexar conversas silenciosas.** Se o serviço não emitiu notif, Cocito não tem memória. Feature, não bug.
- **Capturar notifs antes da app estar aberta.** A app tem de estar a correr para o Cérbero interceptar. As notifs do SO podem ter chegado via Service Worker, mas o Cocito não as vê retroativamente.

---

## 14. Layout de diretórios

```
~/Documents/development/sources/cocito/
├── cocito-revival-plan.md         — este documento (canónico)
├── CLAUDE.md                      — sumário operacional para Claude Code
├── mockups/                       — fonte de verdade visual antes do scaffold
│   ├── themes.html                — 9 paletas em pares light/dark + samples
│   ├── layout.html                — janela completa; switcher tema + modo vivos
│   ├── typography.html            — Sóbria vs Literária; opsz, italic, ligaduras
│   └── preferences.html           — ecrã Preferências → Aparência, 3 eixos + preview live
└── cocito-tauri/                  — novo código Tauri 2 (a criar na Semana 1)
    ├── src-tauri/                 — Rust backend
    │   ├── src/
    │   │   ├── main.rs
    │   │   ├── modules/
    │   │   │   ├── caronte.rs
    │   │   │   ├── malebolge.rs
    │   │   │   ├── cerbero.rs
    │   │   │   ├── minos.rs
    │   │   │   ├── virgilio.rs
    │   │   │   ├── scriptorium.rs
    │   │   │   ├── beatriz.rs
    │   │   │   └── messo.rs
    │   │   └── lib.rs
    │   └── Cargo.toml
    ├── src/                       — React frontend
    │   ├── App.tsx
    │   ├── components/
    │   ├── themes/                — 9 temas × 2 modos (promovido de mockups/themes.html)
    │   │   ├── cocito.css
    │   │   ├── crepuscolo.css
    │   │   └── …                  — um ficheiro por tema, com light + dark
    │   ├── typography/            — 3 stacks tipográficas (promovido de typography.html)
    │   │   ├── sobria.css         — Inter + Newsreader + JetBrains Mono
    │   │   ├── literaria.css      — General Sans + Spectral + Geist Mono
    │   │   └── nativa.css         — system-ui cascade
    │   ├── fonts/                 — .woff2 self-hosted (~1 MB total)
    │   │   ├── Inter-variable.woff2
    │   │   ├── Newsreader-variable.woff2
    │   │   ├── JetBrainsMono-variable.woff2
    │   │   ├── GeneralSans-variable.woff2
    │   │   ├── Spectral-variable.woff2
    │   │   └── GeistMono-variable.woff2
    │   ├── stores/                — Zustand (appearance state: theme/mode/typography)
    │   ├── parsers/               — title parsers per-service
    │   └── locales/               — Babele
    ├── init-scripts/              — initialization scripts universais
    │   ├── notification-intercept.js
    │   └── title-observer.js
    ├── services.json              — catálogo inicial
    ├── tauri.conf.json
    └── package.json
```

Notas Obsidian em `2026/cocito/`.

---

## 15. Naming e narrativa

- **App name:** Cocito
- **Ícone:** lago gelado (SVG minimalista, superfície azul-cristal com fratura central)
- **Tagline (PT):** *"Onde todas as conversas convergem."*
- **Tagline (IT):** *"Dove tutto si ghiaccia."*
- **Tagline (EN):** *"Where every conversation freezes in place."*

O Cocito Swift original (cliente de email iOS+macOS) e o agregador Malebolge foram arquivados em 2026-04-24. Os conceitos migram — módulos, temas, ícone do lago gelado, princípios invariantes; o código não. O Malebolge antigo ganha segunda vida dentro do Cocito como o módulo de isolamento de sessions.

---

## 16. Próximo passo

1. **Scaffold Tauri 2 + React** — doc para o Claude Code executar na Semana 1.
2. **Spec técnica do Cérbero** — detalhe do initialization script, event bus, event schema, serialização, edge cases (notifs sem body, notifs duplicadas via tag, etc.).
3. **Spec técnica do módulo Malebolge** — partitions no Tauri 2, gestão de diretórios, UA spoofing per-service.
4. **Rule DSL do Minos** — schema completo de regras, biblioteca de ações, UI futura.

Recomendo ordem **1 → 2 → 3 → 4**. O Cérbero é prioritário depois do scaffold porque é quem desbloqueia tudo o resto (Minos, Virgílio, Scriptorium, Beatriz).

---

*Fine del proemio · il viaggio ricomincia dal nono cerchio.*
