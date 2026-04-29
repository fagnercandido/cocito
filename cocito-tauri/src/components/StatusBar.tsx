/**
 * StatusBar · barra inferior com sinais vivos do Cérbero, Ollama, Minos.
 * Layout ripado de mockups/layout.html.
 */

import { useBabele } from "../locales";

interface Props {
  cerberoEvents: number;
  ollamaHost: string | null;
  rulesActive: number;
}

export function StatusBar({ cerberoEvents, ollamaHost, rulesActive }: Props) {
  const t = useBabele((s) => s.t);
  return (
    <footer
      className="h-7 border-t border-border bg-surface flex items-center px-4 gap-4 text-[11px] text-text-dim flex-shrink-0"
      aria-label="Estado"
    >
      <StatusItem live label={t("status.cerberoEvents", { n: cerberoEvents })} />
      {ollamaHost ? (
        <StatusItem live label={t("status.ollama", { host: ollamaHost })} />
      ) : (
        <StatusItem label={t("status.ollamaNone")} dim />
      )}
      <StatusItem label={t("status.minos", { n: rulesActive })} />

      <div className="flex-1" />

      <Shortcut keys="⌘⇧F" label={t("status.search")} />
      <Shortcut keys="⌘K" label={t("status.beatrice")} />
      <Shortcut keys="⌘,"  label={t("status.prefs")} />
    </footer>
  );
}

function StatusItem({ live, dim, label }: { live?: boolean; dim?: boolean; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      {live ? (
        <span
          className="w-1.5 h-1.5 rounded-full bg-accent"
          style={{ boxShadow: "0 0 6px var(--accent)" }}
        />
      ) : null}
      <span className={dim ? "opacity-60" : undefined}>{label}</span>
    </div>
  );
}

function Shortcut({ keys, label }: { keys: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <kbd className="mono bg-surface-2 text-text px-1.5 py-px rounded text-[10px]">{keys}</kbd>
      <span>{label}</span>
    </div>
  );
}
