/**
 * Beatriz · AI overlay (⌘K).
 *
 * Bridge Rust → Ollama. Streaming via evento `beatriz:token`.
 * v1.1: prompt livre + escolha de modelo. v2 vai consumir stream do Cérbero.
 */

import { useEffect, useRef, useState } from "react";
import { Sparkles, X, Send, Loader2, Check } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useBabele } from "../locales";
import { useServices } from "../stores/services";
import { useModalA11y } from "../hooks/useModalA11y";

interface OllamaHost {
  url: string;
  source: string;
  hostname?: string | null;
}

interface OllamaModel {
  name: string;
  size?: number;
}

interface Props {
  onClose: () => void;
}

export function Beatrice({ onClose }: Props) {
  const t = useBabele((s) => s.t);
  const [, setHosts] = useState<OllamaHost[]>([]);
  const [host, setHost] = useState<string | null>(null);
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [model, setModel] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [withContext, setWithContext] = useState(false);
  const tokensRef = useRef<UnlistenFn | null>(null);
  const activeInstanceId = useServices((s) => s.activeInstanceId);
  const instances = useServices((s) => s.instances);
  const activeInstance = instances.find((i) => i.id === activeInstanceId);
  const ref = useModalA11y(onClose);

  // Hidratação: hosts disponíveis
  useEffect(() => {
    invoke<OllamaHost[]>("cmd_messo_hosts").then((h) => {
      setHosts(h);
      if (h.length > 0 && !host) setHost(h[0].url);
    });
  }, []);

  // Modelos do host escolhido
  useEffect(() => {
    if (!host) return;
    invoke<OllamaModel[]>("cmd_beatriz_list_models", { url: host })
      .then((m) => {
        setModels(m);
        // Prefere qwen3:32b se existir (default razoável para Mac M-series); senão o primeiro.
        const preferred = m.find((x) => x.name.startsWith("qwen3")) ?? m[0];
        if (preferred && !model) setModel(preferred.name);
        setError(null);
      })
      .catch((e) => setError(`Ollama em ${host} não respondeu: ${e}`));
  }, [host]);

  // Listener de tokens streaming
  useEffect(() => {
    (async () => {
      tokensRef.current = await listen<string>("beatriz:token", ({ payload }) => {
        setResponse((r) => r + payload);
      });
    })();
    return () => tokensRef.current?.();
  }, []);

  async function run() {
    if (!host || !model || !prompt.trim() || running) return;
    setRunning(true);
    setResponse("");
    setError(null);

    // Beatriz v2 · contexto: últimas N notifs do instance ativa via Virgílio.
    let contextPrefix = "";
    if (withContext && activeInstance) {
      try {
        const recent = await invoke<
          Array<{ title: string; body: string | null; timestamp: number }>
        >("cmd_virgilio_search", { query: "", limit: 12 });
        const filtered = recent.slice(0, 8);
        if (filtered.length > 0) {
          contextPrefix =
            "## Contexto recente (mais antigo primeiro)\n\n" +
            filtered
              .reverse()
              .map((r) => {
                const t = new Date(r.timestamp).toLocaleString("pt-PT");
                return `- [${t}] ${r.title}${r.body ? `: ${r.body}` : ""}`;
              })
              .join("\n") +
            "\n\n## Pergunta\n\n";
        }
      } catch (e) {
        console.warn("[Beatriz] context fetch falhou:", e);
      }
    }

    try {
      await invoke<string>("cmd_beatriz_generate", {
        req: {
          url: host,
          model,
          prompt: contextPrefix + prompt.trim(),
          system:
            "És a Beatriz, guia do Cocito. Respondes em Português (PT-PT), sucintamente, estilo literário-sóbrio quando couber. Sem emojis.",
        },
      });
    } catch (e) {
      setError(String(e));
    } finally {
      setRunning(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape" && !running) {
      e.preventDefault();
      onClose();
    } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      run();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-8 bg-black/55 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label="Beatriz · AI"
        className="w-[min(760px,94vw)] bg-bg border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[78vh] focus:outline-none"
        style={{ backgroundImage: "var(--grad)" }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        {/* Header */}
        <header className="flex items-center gap-3 px-5 py-3 border-b border-border">
          <Sparkles size={18} className="text-accent" />
          <div className="flex-1">
            <div className="serif italic text-lg text-text leading-none">Beatriz</div>
            <div className="text-[10px] text-text-dim mono mt-1">
              {host ? `${host} · ${model ?? "?"}` : t("beatrice.noOllama")}
            </div>
          </div>
          <select
            value={model ?? ""}
            onChange={(e) => setModel(e.target.value)}
            className="bg-surface-2 border border-border rounded-md text-xs text-text px-2 py-1 mono"
            disabled={models.length === 0}
          >
            {models.length === 0 ? <option value="">—</option> : null}
            {models.map((m) => (
              <option key={m.name} value={m.name}>
                {m.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-surface-2 flex items-center justify-center text-text-dim hover:text-text"
          >
            <X size={18} />
          </button>
        </header>

        {/* Response */}
        <div className="flex-1 overflow-y-auto px-5 py-4 min-h-[120px]">
          {error ? (
            <p className="text-red-400 text-sm">{error}</p>
          ) : response ? (
            <p className="serif text-[15px] text-text leading-relaxed whitespace-pre-wrap">
              {response}
              {running ? <span className="opacity-50 animate-pulse">▍</span> : null}
            </p>
          ) : (
            <p className="serif italic text-text-dim text-sm leading-relaxed">
              «Lo bello stile che m'ha fatto onore.»<br />
              <span className="mono not-italic text-[10px]">— {t("beatrice.hint")}</span>
            </p>
          )}
        </div>

        {/* Context toggle */}
        <div className="border-t border-border px-3 py-1.5 flex items-center gap-2 text-[11px] text-text-dim">
          <button
            type="button"
            onClick={() => setWithContext((v) => !v)}
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded mono transition-colors ${
              withContext ? "text-accent" : "hover:text-text"
            }`}
          >
            <Check size={12} className={withContext ? "" : "opacity-30"} />
            usar últimas 8 notifs como contexto
          </button>
        </div>

        {/* Prompt */}
        <div className="border-t border-border p-3 flex items-end gap-2">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={t("beatrice.placeholder")}
            rows={2}
            className="flex-1 bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-text resize-none focus:outline-none focus:border-accent"
            autoFocus
          />
          <button
            type="button"
            onClick={run}
            disabled={!host || !model || !prompt.trim() || running}
            aria-label="Enviar"
            className="w-10 h-10 rounded-lg bg-accent text-bg flex items-center justify-center disabled:opacity-40 hover:-translate-y-px transition-transform"
          >
            {running ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
}
