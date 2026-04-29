/**
 * WebViewFrame · buraco onde vive a WebView do serviço ativo.
 *
 * A WebView em si não é um elemento DOM — é uma janela nativa embedded
 * criada pelo Caronte (Rust). Este componente **reconcilia** o estado
 * nativo com o estado React:
 *
 *   · Se há `activeInstance` e `visible=true` → abre (se preciso), posiciona e mostra.
 *   · Se `visible=false` (overlay aberto) → esconde a WebView e mostra um placeholder
 *     visual no frame (ícone brand-tinted da instância em pausa).
 *   · Se `activeInstance` muda → cria a nova, esconde as outras.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { useServices, type ServiceInstance } from "../stores/services";
import { ServiceIcon, getBrandColor } from "./ServiceIcon";
import { useBabele } from "../locales";

interface Props {
  activeInstance: ServiceInstance | null;
  visible: boolean;
  /**
   * Quando há um drawer lateral aberto (ex: Preferências à direita), passa a largura
   * dele para o PausedState centralizar no espaço realmente visível. 0 = sem drawer
   * lateral (ex: modal centrado), centra no frame inteiro.
   */
  rightInset?: number;
}

export function WebViewFrame({ activeInstance, visible, rightInset = 0 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const lastBoundsRef = useRef<string | null>(null);
  const lastShownRef = useRef<string | null>(null);
  const catalog = useServices((s) => s.catalog);
  // Tracking de instâncias já abertas pelo menos uma vez. Loading só na 1ª.
  const [openedOnce, setOpenedOnce] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const serviceIcon = useMemo(() => {
    if (!activeInstance) return null;
    return catalog.find((s) => s.id === activeInstance.serviceId)?.icon ?? null;
  }, [catalog, activeInstance]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    async function reconcile() {
      // Sem instância ativa: esconde a última que esteve visível.
      if (!activeInstance) {
        if (lastShownRef.current) {
          try {
            await invoke("cmd_hide_service", { instanceId: lastShownRef.current });
          } catch (e) {
            console.warn("[WebViewFrame] hide falhou:", e);
          }
          lastShownRef.current = null;
        }
        return;
      }

      // Overlay aberto → esconder sem destruir.
      if (!visible) {
        try {
          await invoke("cmd_hide_service", { instanceId: activeInstance.id });
        } catch (e) {
          console.warn("[WebViewFrame] hide falhou:", e);
        }
        return;
      }

      // Visível: criar (se preciso), posicionar e mostrar.
      const rect = el!.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;
      const bounds = `${rect.x},${rect.y},${rect.width},${rect.height}`;

      const isFirstTime = !openedOnce.has(activeInstance.id);
      if (isFirstTime) setLoading(true);
      try {
        await invoke("cmd_open_service", {
          req: {
            instanceId: activeInstance.id,
            url: activeInstance.url,
            userAgent: activeInstance.userAgent,
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
          },
        });
        await invoke("cmd_show_service", { instanceId: activeInstance.id });
        lastBoundsRef.current = bounds;
        lastShownRef.current = activeInstance.id;
        if (isFirstTime) {
          setOpenedOnce((s) => new Set(s).add(activeInstance!.id));
          // Esconde overlay após pequeno delay (tempo da WebView pintar).
          setTimeout(() => setLoading(false), 800);
        }
      } catch (e) {
        console.warn("[WebViewFrame] reconcile falhou:", e);
        setLoading(false);
      }
    }

    reconcile();

    const obs = new ResizeObserver(() => {
      if (!activeInstance || !visible) return;
      const rect = el.getBoundingClientRect();
      const next = `${rect.x},${rect.y},${rect.width},${rect.height}`;
      if (next !== lastBoundsRef.current) reconcile();
    });
    obs.observe(el);

    const onWin = () => reconcile();
    window.addEventListener("resize", onWin);

    return () => {
      obs.disconnect();
      window.removeEventListener("resize", onWin);
    };
  }, [activeInstance, visible]);

  // Placeholder visual quando webview está escondida por overlay, ou vazio.
  const showPaused = activeInstance && !visible;

  return (
    <div
      ref={ref}
      className="flex-1 bg-bg relative overflow-hidden"
      aria-label={
        activeInstance ? `WebView · ${activeInstance.label ?? activeInstance.id}` : "WebView"
      }
    >
      {!activeInstance ? <EmptyState /> : null}
      {showPaused && serviceIcon ? (
        <PausedState
          instance={activeInstance}
          iconSlug={serviceIcon}
          rightInset={rightInset}
        />
      ) : null}
      {loading && visible ? <LoadingOverlay /> : null}
    </div>
  );
}

function LoadingOverlay() {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center pointer-events-none"
      style={{ background: "var(--bg)" }}
    >
      <Loader2 size={32} className="text-accent animate-spin opacity-70" />
    </div>
  );
}

// ─── Empty state (sem instância alguma) ──────────────────────────────

function EmptyState() {
  const t = useBabele((s) => s.t);
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
      <h1 className="serif font-light text-4xl text-text mb-3 tracking-tight">
        {t("empty.title")}
      </h1>
      <p className="text-text-dim max-w-md leading-relaxed">{t("empty.body")}</p>
    </div>
  );
}

// ─── Paused state (instância ativa mas webview escondida por overlay) ───

function usePausedCopy() {
  const t = useBabele((s) => s.t);
  return t("paused.body");
}


function PausedState({
  instance,
  iconSlug,
  rightInset,
}: {
  instance: ServiceInstance;
  iconSlug: string;
  rightInset: number;
}) {
  const brand = getBrandColor(iconSlug);
  return (
    <div
      className="absolute top-0 bottom-0 left-0 flex flex-col items-center justify-center p-8 text-center"
      style={{
        // Centraliza apenas no espaço não coberto pelo drawer lateral.
        right: rightInset > 0 ? `${rightInset}px` : 0,
        // Gradient radial discreto com cor brand — sinaliza qual bolgia
        // está em pausa sem distrair do drawer.
        background: `radial-gradient(ellipse 80% 60% at 50% 40%, ${brand}22 0%, transparent 70%)`,
      }}
    >
      <div
        className="relative flex items-center justify-center w-28 h-28 mb-6"
        style={{
          borderRadius: 28,
          background: "var(--surface-2)",
          backgroundImage: `radial-gradient(ellipse 80% 70% at 50% 120%, ${brand}55 0%, ${brand}18 40%, transparent 75%)`,
          border: "1px solid var(--border)",
          boxShadow: `0 20px 60px -12px ${brand}40`,
        }}
      >
        <ServiceIcon icon={iconSlug} className="w-16 h-16" />
      </div>

      <h2 className="serif italic font-light text-2xl text-text mb-1">
        {instance.label ?? instance.id}
      </h2>
      <p className="text-text-dim text-sm max-w-xs leading-relaxed">
        {usePausedCopy()}
      </p>
    </div>
  );
}
