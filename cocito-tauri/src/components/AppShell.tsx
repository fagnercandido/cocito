/**
 * AppShell · estrutura principal do Cocito.
 *
 *   Titlebar
 *   ───────────────────────────────────
 *   Sidebar   │   WebViewFrame
 *             │
 *   ───────────────────────────────────
 *   StatusBar
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import {
  useAppearance,
  THEME_ORDER,
  type ThemeSlug,
} from "../stores/appearance";
import { useServices, type ServiceInstance } from "../stores/services";
import { Titlebar } from "./Titlebar";
import { Sidebar } from "./Sidebar";
import { WebViewFrame } from "./WebViewFrame";
import { StatusBar } from "./StatusBar";
import { AddServiceSheet } from "./AddServiceSheet";
import { PreferencesModal } from "./Preferences/PreferencesModal";
import { Palette } from "./Palette";
import { Beatrice } from "./Beatrice";
import { parseTitle } from "../parsers";

/** Evento publicado pelo Cérbero Rust, consumido pela UI React. */
interface CerberoEvent {
  service: string;
  instance: string;
  timestamp: number;
  title: string;
  body?: string | null;
  tag?: string | null;
  icon?: string | null;
  url?: string | null;
  kind?: string | null;
}

export function AppShell() {
  const hydrate = useAppearance((s) => s.hydrate);
  const setTheme = useAppearance((s) => s.setTheme);
  const catalog = useServices((s) => s.catalog);
  const loadCatalog = useServices((s) => s.loadCatalog);
  const instances = useServices((s) => s.instances);
  const activeInstanceId = useServices((s) => s.activeInstanceId);
  const setActive = useServices((s) => s.setActive);
  const reorderInstances = useServices((s) => s.reorderInstances);

  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [beatriceOpen, setBeatriceOpen] = useState(false);
  const overlayOpen = addSheetOpen || prefsOpen || paletteOpen || beatriceOpen;
  const [cerberoCount, setCerberoCount] = useState(0);
  const [rulesActive, setRulesActive] = useState(0);
  const [ollamaHost, setOllamaHost] = useState<string | null>(null);

  // ─── Hidratação inicial ─────────────────────────────────────────
  useEffect(() => {
    (async () => {
      await hydrate();
      await loadCatalog();

      // Carrega instâncias + catálogo para poder fazer "UA refresh".
      try {
        const [cfg, freshCatalog] = await Promise.all([
          invoke<{
            instances: Array<{
              id: string;
              serviceId: string;
              label: string | null;
              url: string;
              userAgent: string;
              tag: string | null;
              unread: number | null;
            }>;
            activeInstance: string | null;
          }>("cmd_get_config"),
          invoke<Array<{ id: string; userAgent: string }>>("cmd_list_services"),
        ]);

        const catalogUA = new Map(freshCatalog.map((s) => [s.id, s.userAgent]));
        const instances = cfg.instances.map((i) => {
          // Se o catálogo tem UA diferente (versão mais recente), adota — navegadores
          // envelhecem e sites deprecam; nunca faz sentido manter UA de 18 meses.
          const latestUA = catalogUA.get(i.serviceId);
          const ua = latestUA && latestUA !== i.userAgent ? latestUA : i.userAgent;
          return {
            id: i.id,
            serviceId: i.serviceId,
            label: i.label ?? undefined,
            url: i.url,
            userAgent: ua,
            tag: i.tag ?? undefined,
            unread: i.unread ?? undefined,
          };
        });

        // Persistir de volta os UAs atualizados (idempotente — só refresca quando difere).
        for (const inst of instances) {
          const original = cfg.instances.find((i) => i.id === inst.id);
          if (original && original.userAgent !== inst.userAgent) {
            await invoke("cmd_add_instance", {
              instance: {
                id: inst.id,
                serviceId: inst.serviceId,
                label: inst.label ?? null,
                url: inst.url,
                userAgent: inst.userAgent,
                tag: inst.tag ?? null,
              },
            });
          }
        }

        useServices.setState({
          instances,
          activeInstanceId: cfg.activeInstance ?? null,
        });
      } catch (e) {
        console.warn("[AppShell] hidratação de instâncias falhou:", e);
      }
    })();
  }, [hydrate, loadCatalog]);

  // ─── Atalhos globais ────────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

      // ⌘1..⌘9 · trocar tema
      const n = Number.parseInt(e.key, 10);
      if (n >= 1 && n <= 9) {
        e.preventDefault();
        setTheme(THEME_ORDER[n - 1] as ThemeSlug);
        return;
      }

      // ⌘, · abrir preferências
      if (e.key === ",") {
        e.preventDefault();
        setPrefsOpen((v) => !v);
        return;
      }

      // ⌘R · reload da bolgia ativa
      if (e.key === "r") {
        e.preventDefault();
        const active = useServices.getState().activeInstanceId;
        if (active) invoke("cmd_reload_service", { instanceId: active }).catch(() => {});
        return;
      }

      // ⌘⇧F · palette do Virgílio
      if (e.shiftKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
        return;
      }

      // ⌘K · Beatriz
      if (e.key.toLowerCase() === "k") {
        e.preventDefault();
        setBeatriceOpen((v) => !v);
        return;
      }

      // ⌘⇧P · Scriptorium · página atual → markdown na vault Obsidian
      if (e.shiftKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        const active = useServices.getState().activeInstanceId;
        const inst = useServices.getState().instances.find((i) => i.id === active);
        if (inst) {
          invoke("cmd_save_page_markdown", {
            instanceId: inst.id,
            service: inst.serviceId,
            title: inst.label ?? inst.id,
            url: inst.url,
          }).catch((err) => console.warn("[Page→MD] falhou:", err));
        }
        return;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setTheme]);

  const serviceIconMap = useMemo(
    () => new Map(catalog.map((s) => [s.id, s.icon])),
    [catalog],
  );

  // ─── Stream do Cérbero → badges + state ─────────────────────────
  // Subscreve os eventos re-emitidos pelo Cérbero Rust. Para cada evento:
  //   · kind="title" → aplica titleBadgePattern do catálogo, extrai unread count.
  //   · outro → incrementa unread (MVP; Minos regula isto em v1).
  useEffect(() => {
    let unlisten: UnlistenFn | null = null;
    let cerberoCount = 0;

    (async () => {
      unlisten = await listen<CerberoEvent>("cerbero:event", ({ payload }) => {
        cerberoCount += 1;
        // Encontra a instância via ID (o init-script injeta isso).
        const instanceId = payload.instance;
        const service = catalog.find((s) => s.id === payload.service);

        if (payload.kind === "title") {
          // Extrai a contagem de unread a partir do padrão do catálogo.
          const pat = service?.titleBadgePattern;
          if (pat) {
            try {
              const match = new RegExp(pat).exec(payload.title ?? "");
              const n = match ? Number.parseInt(match[1], 10) : 0;
              if (!Number.isNaN(n)) {
                useServices.getState().setUnread(instanceId, n);
              }
            } catch (e) {
              console.warn("[cerbero] regex falhou:", e);
            }
          }
          // Parser pack: enriquece e atualiza store para tooltips/UI.
          if (service) {
            const parsed = parseTitle(service.id, payload.title ?? "");
            if (parsed.sender || parsed.channel) {
              useServices.getState().setLastParsed(instanceId, parsed);
            }
          }
          return;
        }

        // Notif real (showNotification): incrementa unread e (futuro) dispara notif SO via Minos.
        const inst = useServices.getState().instances.find((i) => i.id === instanceId);
        if (inst) {
          const next = (inst.unread ?? 0) + 1;
          useServices.getState().setUnread(instanceId, next);
        }
      });
    })();

    // Atualiza o contador visível na StatusBar a cada ~1s (evita re-renders por evento).
    const tick = setInterval(() => setCerberoCount(cerberoCount), 1000);

    // Carrega contagem de regras ativas do Minos.
    invoke<number>("cmd_rules_active_count")
      .then((n) => setRulesActive(n))
      .catch(() => {});

    // Ouve ações do Minos (set_theme) e aplica ao <html>.
    const minosUnlisten: Promise<UnlistenFn> = listen<string>(
      "minos:set-theme",
      ({ payload }) => {
        const next = payload as ThemeSlug;
        useAppearance.getState().setTheme(next);
      },
    );

    // Atalho do tray → abrir Preferências.
    const trayUnlisten = listen("tray:open-preferences", () => setPrefsOpen(true));

    // Cérbero v2 · click numa notif do SO → foca a bolgia correspondente.
    const openInstUnlisten: Promise<UnlistenFn> = listen<string>(
      "cerbero:open-instance",
      ({ payload }) => {
        useServices.getState().setActive(payload);
      },
    );

    // Messo: hosts Ollama descobertos vão para a StatusBar.
    invoke<Array<{ url: string; source: string; hostname?: string | null }>>(
      "cmd_messo_hosts",
    )
      .then((hs) => {
        if (hs.length > 0) {
          const best = hs.find((h) => h.source === "mdns") ?? hs[0];
          setOllamaHost(best.hostname ? `${best.hostname}` : best.url);
        }
      })
      .catch(() => {});

    const messoUnlisten: Promise<UnlistenFn> = listen<{
      url: string;
      hostname?: string | null;
    }>("messo:host", ({ payload }) => {
      setOllamaHost(payload.hostname ?? payload.url);
    });

    return () => {
      unlisten?.();
      clearInterval(tick);
      minosUnlisten.then((u) => u());
      trayUnlisten.then((u) => u());
      messoUnlisten.then((u) => u());
      openInstUnlisten.then((u) => u());
    };
  }, [catalog]);

  const activeInstance =
    instances.find((i) => i.id === activeInstanceId) ?? null;
  // O WebViewFrame trata sozinho de hide/show conforme `visible` — não
  // duplicamos a lógica aqui para evitar races entre efeitos paralelos.

  const setActivePersisted = useCallback(
    async (id: string | null) => {
      setActive(id);
      try {
        await invoke("cmd_set_active_instance", { instanceId: id });
      } catch (e) {
        console.warn("[AppShell] set_active falhou:", e);
      }
    },
    [setActive],
  );

  const handleReorder = useCallback(
    async (ids: string[]) => {
      reorderInstances(ids);
      try {
        await invoke("cmd_reorder_instances", { ids });
      } catch (e) {
        console.warn("[AppShell] reorder falhou:", e);
      }
    },
    [reorderInstances],
  );

  const subtitle = activeInstance ? activeInstance.label ?? activeInstance.id : "";

  // Tray badge: sincroniza soma de unreads com o título do tray icon.
  useEffect(() => {
    const total = instances.reduce((s, i) => s + (i.unread ?? 0), 0);
    invoke("cmd_tray_set_unread", { total }).catch(() => {});
  }, [instances]);

  return (
    <div className="flex flex-col h-full w-full">
      <Titlebar subtitle={subtitle} />

      <div className="flex-1 flex overflow-hidden min-h-0">
        <Sidebar
          instances={instances}
          activeId={activeInstanceId}
          onSelect={(id) => setActivePersisted(id)}
          onAdd={() => setAddSheetOpen(true)}
          onOpenPreferences={() => setPrefsOpen(true)}
          onReorder={handleReorder}
          serviceIconMap={serviceIconMap}
        />

        <WebViewFrame activeInstance={activeInstance} visible={!overlayOpen} />
      </div>

      <StatusBar cerberoEvents={cerberoCount} ollamaHost={ollamaHost} rulesActive={rulesActive} />

      {addSheetOpen ? (
        <AddServiceSheet
          catalog={catalog}
          onClose={() => setAddSheetOpen(false)}
        />
      ) : null}

      {prefsOpen ? <PreferencesModal onClose={() => setPrefsOpen(false)} /> : null}
      {paletteOpen ? <Palette onClose={() => setPaletteOpen(false)} /> : null}
      {beatriceOpen ? <Beatrice onClose={() => setBeatriceOpen(false)} /> : null}
    </div>
  );
}

// Tipagem não usada aqui, só para manter simétrico:
export type { ServiceInstance };
