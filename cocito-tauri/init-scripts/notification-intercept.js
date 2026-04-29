// =========================================================================
// Cocito · Cérbero · Initialization Script universal
// =========================================================================
//
// Este script é injetado em CADA WebView de serviço (Gmail, Slack, WhatsApp, …)
// pelo Caronte, ANTES do código do serviço arrancar. Corre no contexto global
// da página e faz três overrides universais:
//
//   1. window.Notification        — usado por Gmail, Outlook, Teams, …
//   2. ServiceWorkerRegistration.prototype.showNotification — usado por Slack,
//      WhatsApp Web, Discord (via push)
//   3. document.title              — observador para badges na sidebar (unread counts)
//
// Cada chamada intercetada vira um evento `cocito:notification` que o lado
// Rust (Cérbero) escuta, normaliza e republica em `cerbero:event` para Minos,
// Virgílio, Scriptorium e Beatriz.
//
// Por que isto funciona e sobrevive a refactors dos serviços:
//   `window.Notification` é Web API standard. Slack, Gmail, WhatsApp Web não
//   podem deixar de a usar sem mudar como as notifs funcionam em *todos* os
//   browsers. É mil vezes mais estável que scrape de DOM.
//
// Limitações honestas (ver §5 do plano):
//   · Só capta o que o serviço notifica (canal silenciado = sem stream)
//   · Só capta com a app aberta (app fechada = Service Worker pode disparar
//     no SO mas o Cocito não intercepta retroativamente)
//   · Parsing de `title` é heurístico e per-service (Slack: "Sender · #channel",
//     Gmail: "Sender - Subject") — feito pelos parsers TS, não aqui.
// =========================================================================

(() => {
  "use strict";

  // A cada WebView, o Caronte injeta (via future hook) os IDs de serviço e
  // instância no `window`. Se ainda não existirem (desenvolvimento), usa
  // valores razoáveis para não partir nada.
  const SERVICE_ID = window.__COCITO_SERVICE_ID__ || "unknown";
  const INSTANCE_ID = window.__COCITO_INSTANCE_ID__ || SERVICE_ID;

  // Ordem de transports (mais → menos preferido):
  //
  //   1. `__TAURI_INTERNALS__.invoke("plugin:event|emit", …)` — IPC nativo do
  //      Tauri (HTTPS-safe, requer capability `core:event:allow-emit` na
  //      webview, que damos via capability `svc-webviews`). Funciona em
  //      qualquer página HTTPS sem mixed content.
  //
  //   2. `fetch("cocito-ipc://emit", …)` — custom URI scheme. Bloqueado em
  //      páginas HTTPS por mixed content; só funciona se a página for HTTP
  //      ou se tivermos elevado o scheme a HTTPS-equivalent (TODO v1.4).
  function tauriInvoke(cmd, args) {
    const internals = window.__TAURI_INTERNALS__;
    if (internals && typeof internals.invoke === "function") {
      try {
        return internals.invoke(cmd, args);
      } catch (e) {
        console.warn("[cocito] invoke", cmd, "falhou:", e);
      }
    }
    return null;
  }

  function emit(payload) {
    const event = {
      service: SERVICE_ID,
      instance: INSTANCE_ID,
      timestamp: Date.now(),
      ...payload,
    };
    // Custom command (não plugin) — só requer `core:default` na capability.
    // HTTPS-safe: vai pelo IPC nativo do Tauri, não pelo fetch.
    if (
      tauriInvoke("cmd_emit_from_webview", {
        kind: "notification",
        payload: JSON.stringify(event),
      })
    ) {
      return;
    }
    // Fallback http: para webviews que não sejam HTTPS (raro nesta app).
    try {
      fetch("cocito-ipc://emit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(event),
        mode: "no-cors",
        credentials: "omit",
        cache: "no-store",
      }).catch(() => {});
    } catch (_) {}
  }

  // -------------------------------------------------------------------------
  // 1 · window.Notification
  // -------------------------------------------------------------------------
  const OriginalNotification = window.Notification;

  function CocitoNotification(title, options = {}) {
    try {
      emit({
        title: String(title ?? ""),
        body: options.body,
        tag: options.tag,
        icon: options.icon,
        data: options.data,
        url: window.location.href,
      });
    } catch (e) {
      console.warn("[cocito] intercept window.Notification falhou", e);
    }
    return new OriginalNotification(title, options);
  }

  // Mantém a interface da API standard (permissions, constructor-as-function).
  try {
    Object.defineProperty(CocitoNotification, "permission", {
      get: () => "granted",
    });
    CocitoNotification.requestPermission = (cb) => {
      const p = Promise.resolve("granted");
      if (typeof cb === "function") p.then(cb);
      return p;
    };
    // Herda prototype para instanceof continuar a funcionar.
    CocitoNotification.prototype = OriginalNotification.prototype;

    // CRÍTICO: configurable:false impede que o tauri-plugin-notification
    // (que injeta scripts em todas as webviews Tauri-aware) sobrescreva o
    // nosso polyfill com o seu wrapper que tenta invocar
    // `notification.is_permission_granted` — comando que requer permission
    // não atribuída às svc:* webviews.
    Object.defineProperty(window, "Notification", {
      value: CocitoNotification,
      writable: false,
      configurable: false,
    });
  } catch (e) {
    console.warn("[cocito] falha a substituir window.Notification", e);
  }

  // -------------------------------------------------------------------------
  // 2 · ServiceWorkerRegistration.prototype.showNotification
  // -------------------------------------------------------------------------
  if (
    typeof ServiceWorkerRegistration !== "undefined" &&
    ServiceWorkerRegistration.prototype &&
    ServiceWorkerRegistration.prototype.showNotification
  ) {
    const originalShow = ServiceWorkerRegistration.prototype.showNotification;
    ServiceWorkerRegistration.prototype.showNotification = function (
      title,
      options = {}
    ) {
      try {
        emit({
          title: String(title ?? ""),
          body: options.body,
          tag: options.tag,
          icon: options.icon,
          data: options.data,
          url: (self && self.location && self.location.href) || "",
        });
      } catch (e) {
        console.warn("[cocito] intercept SW.showNotification falhou", e);
      }
      return originalShow.call(this, title, options);
    };
  }

  // -------------------------------------------------------------------------
  // 3 · document.title observer (badges na sidebar)
  //     Muitos serviços mantêm a contagem de unreads no título:
  //       Gmail     → "(3) Inbox · me@gmail.com"
  //       Slack     → "Slack · Workspace (7)"
  //       WhatsApp  → "(12) WhatsApp"
  // -------------------------------------------------------------------------
  function reportTitle() {
    emit({
      kind: "title",
      title: document.title || "",
      url: window.location.href,
    });
  }

  try {
    const titleNode =
      document.querySelector("title") ||
      (document.head && document.head.appendChild(document.createElement("title")));
    if (titleNode) {
      const mo = new MutationObserver(reportTitle);
      mo.observe(titleNode, { childList: true, characterData: true, subtree: true });
    }
    // Primeira leitura assim que DOM estiver pronto.
    if (document.readyState === "complete" || document.readyState === "interactive") {
      reportTitle();
    } else {
      document.addEventListener("DOMContentLoaded", reportTitle, { once: true });
    }
  } catch (e) {
    console.warn("[cocito] title observer falhou", e);
  }

  // -------------------------------------------------------------------------
  // 4 · Atalhos do Scriptorium (⌘⇧S selection quote · ⌘⇧B URL breadcrumb)
  //     Corre dentro da WebView, captura selection, envia via cocito-ipc.
  // -------------------------------------------------------------------------
  function sendScriptorium(kind, extra) {
    const payload = {
      service: SERVICE_ID,
      instance: INSTANCE_ID,
      url: window.location.href,
      title: document.title || "",
      selection: extra?.selection,
      tag: null,
    };
    const cmdKind = kind === "save-quote" ? "scriptorium-quote" : "scriptorium-breadcrumb";
    if (
      tauriInvoke("cmd_emit_from_webview", {
        kind: cmdKind,
        payload: JSON.stringify(payload),
      })
    ) {
      return;
    }
    try {
      fetch(`cocito-ipc://scriptorium/${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        mode: "no-cors",
        credentials: "omit",
        cache: "no-store",
      }).catch(() => {});
    } catch (_) {}
  }

  document.addEventListener(
    "keydown",
    (e) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod || !e.shiftKey) return;
      const key = e.key?.toLowerCase();
      if (key === "s") {
        e.preventDefault();
        const sel = window.getSelection()?.toString() || "";
        if (sel.trim()) sendScriptorium("save-quote", { selection: sel });
      } else if (key === "b") {
        e.preventDefault();
        sendScriptorium("save-breadcrumb");
      }
    },
    true, // capture — antes dos handlers do serviço
  );

  // -------------------------------------------------------------------------
  // 5 · Polyfills para fluxos de login que não funcionam em WKWebView default
  //
  //   · `window.open` — Gmail/Outlook/Slack abrem a popup de login com isto.
  //     WKWebView ignora silenciosamente popups não tratadas, daí o "clique → nada".
  //     Redirecionamos para a própria webview (single-window flow).
  //
  //   · `window.chrome` stub — defesa em profundidade contra detecção de
  //     embedded webview (vários sites verificam a presença deste objeto).
  // -------------------------------------------------------------------------
  try {
    const _open = window.open ? window.open.bind(window) : null;

    // URLs que sabidamente NÃO devem ser redirecionadas (parts críticas do
    // OAuth/SSO de cada provider). Preferimos popup nativa, mesmo que
    // invisível — porque o flow auth dispara múltiplas popups que se
    // referenciam por handle (window.opener). Redirecionar parte tudo.
    const popupAllowed = /accounts\.google\.com|accounts\.youtube\.com|myaccount\.google\.com|gds\.google\.com|oauth2\.googleapis\.com|chat\.google\.com\/u\/\d+\/|meet\.google\.com\/u\/\d+\/|meet\.google\.com\/_meet\/|login\.live\.com|login\.microsoftonline\.com|login\.microsoft\.com|github\.com\/login\/oauth|appleid\.apple\.com|slack\.com\/(sso|signin|oauth)|api\.slack\.com\/oauth|linkedin\.com\/(uas|checkpoint|oauth)|www\.linkedin\.com\/(uas|checkpoint|oauth)/i;

    const cocitoOpen = function (url, target, features) {
      if (!url) return _open ? _open(url, target, features) : null;

      // 1. Tenta popup nativa primeiro (algumas funcionam, outras devolvem null).
      let popup = null;
      if (_open) {
        try {
          popup = _open(url, target, features);
        } catch (_) {}
      }
      if (popup) return popup;

      // 2. URL é critical-auth. Distinguir entry-point vs mid-flow:
      //    - Entry-point (URL traz `continue=`, `followup=`, `redirect_uri=`
      //      ou `return_to=`): é o clique inicial de "Iniciar sessão". O
      //      provider termina o flow e volta sozinho ao destino via continue.
      //      → redirecionar a webview (single-window flow).
      //    - Mid-flow (sem nenhum desses params): é uma popup intermédia
      //      (2FA challenge, account picker, security alert) que comunica
      //      por window.opener/postMessage. Redirecionar parte tudo.
      //      → devolver stub e deixar o serviço fazer o seu fallback.
      if (popupAllowed.test(url)) {
        const isEntryPoint = /[?&](continue|followup|redirect_uri|return_to)=/i.test(url);
        if (isEntryPoint) {
          try {
            window.location.href = url;
          } catch (e) {
            console.warn("[cocito] window.open auth-entry → location falhou", e);
          }
          return {
            closed: false,
            close() {},
            focus() {},
            blur() {},
            postMessage() {},
          };
        }
        return {
          closed: false,
          close() {},
          focus() {},
          blur() {},
          postMessage() {},
          location: { href: url },
        };
      }

      // 3. Outras URLs: redireciona webview (link normal, não auth-flow).
      try {
        window.location.href = url;
      } catch (e) {
        console.warn("[cocito] window.open → location falhou", e);
      }
      return {
        closed: false,
        close() {},
        focus() {},
        blur() {},
        postMessage() {},
      };
    };
    Object.defineProperty(window, "open", {
      value: cocitoOpen,
      writable: false,
      configurable: false,
    });
  } catch (e) {
    console.warn("[cocito] window.open polyfill falhou", e);
  }

  // Stub mínimo do `window.chrome` — fingerprint Chrome-like.
  // Não interfere com Safari real (esse já tem outros sinais).
  try {
    if (!window.chrome) {
      window.chrome = {
        runtime: {},
        app: { isInstalled: false },
        csi: function () {},
        loadTimes: function () { return {}; },
      };
    }
  } catch (_) {}

  // Marker para debug.
  window.__COCITO_CERBERO_READY__ = true;
})();
