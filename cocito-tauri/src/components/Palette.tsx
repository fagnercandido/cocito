/**
 * Virgílio palette · pesquisa full-text sobre o SQLite do Cérbero.
 *
 * Aberta com ⌘⇧F. Query vazia = últimos 50 eventos. FTS5 suporta
 * sintaxe: "PROD", "jws AND kid", "ze*", etc.
 */

import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { useServices } from "../stores/services";
import { ServiceIcon } from "./ServiceIcon";
import { useBabele } from "../locales";
import { useModalA11y } from "../hooks/useModalA11y";

interface SearchResult {
  id: number;
  service: string;
  instance: string;
  timestamp: number;
  title: string;
  body?: string | null;
  url?: string | null;
}

interface Props {
  onClose: () => void;
}

export function Palette({ onClose }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [sel, setSel] = useState(0);
  const catalog = useServices((s) => s.catalog);
  const setActive = useServices((s) => s.setActive);
  const t = useBabele((s) => s.t);
  const ref = useModalA11y(onClose);

  useEffect(() => {
    const handle = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await invoke<SearchResult[]>("cmd_virgilio_search", {
          query: query.trim(),
          limit: 80,
        });
        setResults(r);
        setSel(0);
      } catch (e) {
        console.warn("[Palette] search falhou:", e);
      } finally {
        setLoading(false);
      }
    }, 120);
    return () => clearTimeout(handle);
  }, [query]);

  function choose(r: SearchResult) {
    setActive(r.instance);
    onClose();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSel((s) => Math.min(s + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSel((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const r = results[sel];
      if (r) choose(r);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-8 bg-black/55 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label="Virgílio · pesquisa"
        className="w-[min(720px,94vw)] bg-bg border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[70vh] focus:outline-none"
        style={{ backgroundImage: "var(--grad)" }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search size={18} className="text-text-dim flex-shrink-0" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`${t("palette.placeholder")}  (FTS: PROD, jws AND kid, ze*)`}
            className="flex-1 bg-transparent text-text text-[15px] placeholder:text-text-dim focus:outline-none"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Limpar"
              className="text-text-dim hover:text-text"
            >
              <X size={16} />
            </button>
          ) : null}
          <kbd className="mono text-[10px] bg-surface-2 px-1.5 py-0.5 rounded text-text-dim">
            esc
          </kbd>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto py-1">
          {loading && results.length === 0 ? (
            <div className="p-6 text-center text-text-dim text-sm">…</div>
          ) : results.length === 0 ? (
            <div className="p-6 text-center text-text-dim text-sm">
              {query.trim()
                ? t("palette.noResults", { query })
                : t("palette.empty")}
            </div>
          ) : (
            results.map((r, idx) => {
              const svc = catalog.find((s) => s.id === r.service);
              const iconSlug = svc?.icon ?? r.service;
              const date = new Date(r.timestamp).toLocaleString("pt-PT", {
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              });
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => choose(r)}
                  onMouseEnter={() => setSel(idx)}
                  className={[
                    "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ease-out-smooth",
                    idx === sel ? "bg-surface-2" : "hover:bg-surface",
                  ].join(" ")}
                >
                  <div
                    className="w-8 h-8 flex items-center justify-center bg-surface-2 border border-border flex-shrink-0"
                    style={{ borderRadius: 10 }}
                  >
                    <ServiceIcon icon={iconSlug} className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-text font-medium truncate">{r.title}</div>
                    {r.body ? (
                      <div className="text-[12px] text-text-dim truncate">{r.body}</div>
                    ) : null}
                  </div>
                  <div className="mono text-[10px] text-text-dim tabular-nums flex-shrink-0">
                    {date}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-border text-[11px] text-text-dim">
          <span>{results.length} {results.length === 1 ? "resultado" : "resultados"}</span>
          <span>
            <kbd className="mono bg-surface-2 px-1 py-px rounded">↑↓</kbd> {t("palette.navigate")} ·{" "}
            <kbd className="mono bg-surface-2 px-1 py-px rounded">↵</kbd> {t("palette.open")}
          </span>
        </div>
      </div>
    </div>
  );
}
