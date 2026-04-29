# SECURITY.md · Cocito

Modelo de ameaça e práticas defensivas. Atualizado 2026-04-25.

## Princípios

1. **Zero backend.** Não existe servidor Cocito. Não há API key partilhada, não há conta. A única comunicação externa é a WebView de cada serviço com o seu provider (direta) e o bridge Rust → Ollama na LAN (validado).
2. **Zero cloud AI.** Beatriz fala apenas com Ollama em loopback ou na LAN privada. Qualquer URL pública é rejeitada antes de fazer o request.
3. **Local-first cifrado pelo SO.** Tudo o que importa é guardado em `app_data_dir`/`app_config_dir` do utilizador, com permissões `0600` (ficheiros) e `0700` (diretórios). Em macOS isto vive sob `~/Library/Application Support/app.cocito.desktop/` que já tem `0700` por defeito.
4. **Cada serviço isolado.** Uma `partition` por instância (Malebolge): cookies, localStorage, IndexedDB e service workers nunca cruzam entre instâncias. O isolamento é nativo (WebKit/WebView2/WebKitGTK).

## Modelo de ameaça

| Ator | Capacidade | Mitigação |
|---|---|---|
| **Outro utilizador da máquina** | Lê ficheiros do meu utilizador via shell partilhada | Permissões `0600`/`0700` em todos os ficheiros do Cocito |
| **Serviço comprometido (Slack/Gmail)** | JS na webview tenta forjar eventos como outro serviço | Validação `is_safe_id` no Cérbero; o init-script só pode publicar como o `instance_id` da sua webview |
| **Webview maliciosa** | Tenta DoS por payload gigante via `cocito-ipc://` | Limite 256 KB no body do request; truncate de title/body |
| **Atacante de rede local** | Faz ARP spoof para fingir ser servidor Ollama | Beatriz aceita `localhost`, `*.local` e RFC 1918; rejeita 169.254 e endereços públicos. mDNS é "trust on first sight" — se desconfiares, configura URL Ollama explícita |
| **Snapshot Sync hostil** | JSON de outra origem com payload adversário | Limite 1 MB; max 500 regras, 200 instâncias; sanitização de IDs no import |
| **Path traversal via vault** | Utilizador ou regra Minos configura vault para `/etc` | `expand_tilde` rejeita `~user/`, `resolve_vault` exige path dentro de `$HOME` canonicalizado |
| **App não-assinada (futuro)** | `gatekeeper` warning na primeira abertura | Code signing + notarization com Apple Developer ID — ainda por fazer (v1.3) |

## Tabela de ficheiros locais

| Ficheiro | Permissões | Conteúdo sensível |
|---|---|---|
| `~/Library/Application Support/app.cocito.desktop/` (raiz) | `0700` | Toda a sub-árvore |
| `config.json` | `0600` | URLs de instâncias, vault path Obsidian |
| `rules.json` | `0600` | Regras Minos (revelam interesses do utilizador) |
| `virgilio.sqlite` (+ `-wal`, `-shm`) | `0600` | Toda a notif vista (FTS5) |
| `partitions/<instance>/` | `0700` | Cookies, sessions, localStorage de cada serviço |

A migração para `0600`/`0700` é automática no arranque (`secure_fs::write_secure` força sempre).

## CSP da webview React

```
default-src 'self'
img-src     'self' asset: https://asset.localhost data: blob:
font-src    'self' data:
style-src   'self' 'unsafe-inline'
script-src  'self'
connect-src 'self' ipc: http://ipc.localhost cocito-ipc: http://localhost:* http://127.0.0.1:* http://*.local:*
frame-src   'none'
object-src  'none'
base-uri    'self'
form-action 'self'
```

`'unsafe-inline'` em `style-src` é necessário para Tailwind/inline styles. Tudo o resto é restritivo. A WebView React **não** carrega scripts externos.

As webviews dos serviços (Slack, Gmail, etc.) **não** estão sujeitas a esta CSP — vão receber a CSP que cada provider configura. Cada uma vive na sua partition.

## URI scheme `cocito-ipc://`

Registado pelo Rust. Usado pelo init-script universal (Cérbero) injetado em cada webview de serviço.

- **Métodos:** `OPTIONS` (preflight CORS) e `POST`. Tudo o resto silenciosamente ignorado.
- **Body:** máx 256 KB. Acima disto, 413.
- **Rotas:**
  - `/emit` — recebe eventos de notificação. JSON `CocitoNotification`.
  - `/scriptorium/save-quote` — captura selection.
  - `/scriptorium/save-breadcrumb` — captura URL.
- **Validações por evento:**
  - `service` e `instance` têm de matchar `^[a-z0-9-]{1,128}$`.
  - `title` truncado a 200 chars; `body` a 2 000; `url` a 2 048.
  - Title events sofrem rate-limit de 200 ms por instância.

## Capabilities Tauri (mínimo necessário)

Ver [`src-tauri/capabilities/main.json`](cocito-tauri/src-tauri/capabilities/main.json). Removidos do default:

- `fs:default` — todo IO sensível é feito via Rust com `secure_fs`. Frontend nunca toca diretamente em ficheiros.
- `shell:allow-open` foi escopado a `https://*`, `http://*`, `mailto:*` apenas. `file://` não é permitido.

## Logging

`tracing` em nível `info` por defeito (controlável via `RUST_LOG`):

- **Nunca logamos** `body`, `selection` ou `url` completo.
- Title só pelo comprimento.
- IDs e contagens só.

Ou seja, mesmo que o stderr seja capturado por outro processo, o conteúdo das mensagens não vaza.

## Política de divulgação

Bug de segurança? Usa **GitHub Security Advisories** (botão *Report a vulnerability* no separador *Security* do repositório). **Não** abrir issue público até haver patch. Esta app não tem programa de bug bounty.

## Roadmap defensivo (v1.3+)

- [ ] **Code signing + notarization** (Apple Developer ID) — primeira execução sem warnings
- [ ] **Encryption at rest** do `virgilio.sqlite` (SQLCipher) — opt-in nas Preferências
- [ ] **Keychain** (macOS) para guardar Ollama URL/token quando aplicável
- [ ] **Sandbox profile** estrito quando estivermos fora do Mac App Store
- [ ] **CRDT signing** quando o sync transport real for ligado (Iroh ou similar)
