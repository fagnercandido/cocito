/**
 * PreferencesModal · ecrã de Preferências como modal centralizado.
 *
 * Estrutura: sidebar de categorias à esquerda + painel à direita.
 * Categorias: Aparência, Serviços, Scriptorium, Atalhos, Sobre.
 */

import { useState, useEffect } from "react";
import { useModalA11y } from "../../hooks/useModalA11y";
import { X, Palette, Layers, FileText, Command, Info, Trash2, FolderOpen, Check, Scale, Languages, Compass, Download } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { AppearancePanel } from "./AppearancePanel";
import { MinosPanel } from "./MinosPanel";
import { VirgilioPanel } from "./VirgilioPanel";
import { DownloadsPanel } from "./DownloadsPanel";
import { useServices } from "../../stores/services";
import { ServiceIcon } from "../ServiceIcon";
import { useBabele, LOCALES, type Locale } from "../../locales";

type Category = "appearance" | "services" | "scriptorium" | "downloads" | "minos" | "language" | "tour" | "shortcuts" | "about";

interface Props {
  onClose: () => void;
}

const CATEGORIES: { id: Category; key: string; icon: JSX.Element }[] = [
  { id: "appearance", key: "prefs.appearance", icon: <Palette size={15} /> },
  { id: "services", key: "prefs.services", icon: <Layers size={15} /> },
  { id: "scriptorium", key: "prefs.scriptorium", icon: <FileText size={15} /> },
  { id: "downloads", key: "prefs.downloads", icon: <Download size={15} /> },
  { id: "minos", key: "prefs.minos", icon: <Scale size={15} /> },
  { id: "language", key: "prefs.language", icon: <Languages size={15} /> },
  { id: "tour", key: "prefs.tour", icon: <Compass size={15} /> },
  { id: "shortcuts", key: "prefs.shortcuts", icon: <Command size={15} /> },
  { id: "about", key: "prefs.about", icon: <Info size={15} /> },
];

export function PreferencesModal({ onClose }: Props) {
  const [cat, setCat] = useState<Category>("appearance");
  const t = useBabele((s) => s.t);
  const ref = useModalA11y(onClose);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-8 bg-black/55 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={t("prefs.title")}
        className="w-[min(960px,96vw)] h-[min(680px,92vh)] bg-bg border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col focus:outline-none"
        style={{ backgroundImage: "var(--grad)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-baseline gap-3">
            <span className="mono text-[10px] uppercase tracking-widest text-text-dim">
              {t("prefs.title")}
            </span>
            <h2 className="serif text-2xl font-normal text-text tracking-tight">
              Cocito
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="w-8 h-8 rounded-lg hover:bg-surface-2 flex items-center justify-center text-text-dim hover:text-text transition-colors ease-out-smooth"
          >
            <X size={18} />
          </button>
        </header>

        {/* Body */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* Sidebar */}
          <nav className="w-[200px] bg-surface border-r border-border py-3 px-2 overflow-y-auto flex-shrink-0">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCat(c.id)}
                aria-current={cat === c.id ? "true" : undefined}
                className={[
                  "w-full px-3 py-2 rounded-lg text-sm flex items-center gap-2.5 transition-colors ease-out-smooth mb-0.5",
                  cat === c.id
                    ? "bg-surface-2 text-text font-medium"
                    : "text-text-dim hover:bg-surface-2 hover:text-text",
                ].join(" ")}
              >
                <span className={cat === c.id ? "text-accent" : ""}>{c.icon}</span>
                {t(c.key)}
              </button>
            ))}
          </nav>

          {/* Panel */}
          <main className="flex-1 overflow-y-auto">
            {cat === "appearance" && <AppearancePanel />}
            {cat === "services" && <ServicesPanel />}
            {cat === "scriptorium" && <ScriptoriumPanel />}
            {cat === "downloads" && <DownloadsPanel />}
            {cat === "minos" && <MinosPanel />}
            {cat === "language" && <LanguagePanel />}
            {cat === "tour" && <VirgilioPanel />}
            {cat === "shortcuts" && <ShortcutsPanel />}
            {cat === "about" && <AboutPanel />}
          </main>
        </div>
      </div>
    </div>
  );
}

// ─── Serviços ────────────────────────────────────────────────────

function ServicesPanel() {
  const instances = useServices((s) => s.instances);
  const catalog = useServices((s) => s.catalog);
  const removeInstance = useServices((s) => s.removeInstance);

  async function handleRemove(id: string, label: string) {
    const ok = window.confirm(
      `Remover "${label}"? A partition (cookies, login) também é apagada.`,
    );
    if (!ok) return;
    try {
      await invoke("cmd_close_service", { instanceId: id });
      await invoke("cmd_remove_instance", { instanceId: id });
      removeInstance(id);
    } catch (e) {
      console.warn("[Services] remove falhou:", e);
    }
  }

  return (
    <div className="p-8 space-y-6">
      <header>
        <h3 className="serif text-2xl font-normal text-text mb-1 tracking-tight">
          Serviços
        </h3>
        <p className="text-text-dim text-sm">
          {instances.length === 0
            ? "Sem serviços adicionados ainda. Usa o <strong>+</strong> na sidebar."
            : `${instances.length} ${instances.length === 1 ? "instância" : "instâncias"} · cada uma numa bolgia isolada.`}
        </p>
      </header>

      <div className="space-y-2">
        {instances.map((inst) => {
          const service = catalog.find((s) => s.id === inst.serviceId);
          const iconSlug = service?.icon ?? inst.serviceId;
          return (
            <div
              key={inst.id}
              className="flex items-center gap-3 p-3 bg-surface border border-border rounded-xl"
            >
              <div
                className="w-10 h-10 flex items-center justify-center bg-surface-2 border border-border flex-shrink-0"
                style={{ borderRadius: 12 }}
              >
                <ServiceIcon icon={iconSlug} className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-text truncate">
                  {inst.label ?? inst.id}
                  {inst.tag ? (
                    <span className="mono text-[10px] ml-2 px-1.5 py-0.5 rounded bg-surface-2 border border-border">
                      {inst.tag}
                    </span>
                  ) : null}
                </div>
                <div className="text-[11px] text-text-dim truncate mono">{inst.url}</div>
              </div>
              {inst.unread ? (
                <span className="mono text-[10px] px-2 py-0.5 rounded-full bg-accent text-bg font-bold tabular-nums">
                  {inst.unread}
                </span>
              ) : null}
              <button
                type="button"
                onClick={() => handleRemove(inst.id, inst.label ?? inst.id)}
                aria-label="Remover"
                className="w-8 h-8 rounded-lg hover:bg-surface-2 flex items-center justify-center text-text-dim hover:text-red-400 transition-colors ease-out-smooth"
              >
                <Trash2 size={15} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Scriptorium ─────────────────────────────────────────────────

function ScriptoriumPanel() {
  const [vaultPath, setVaultPath] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    invoke<{ scriptorium: { vaultPath: string | null } }>("cmd_get_config")
      .then((cfg) => setVaultPath(cfg.scriptorium.vaultPath ?? null))
      .catch(() => {});
  }, []);

  async function choose() {
    try {
      const selected = await openDialog({
        directory: true,
        multiple: false,
        title: "Escolher vault Obsidian",
      });
      if (typeof selected === "string") {
        setSaving(true);
        await invoke("cmd_set_scriptorium_vault", { vaultPath: selected });
        setVaultPath(selected);
        setSaving(false);
      }
    } catch (e) {
      console.warn("[Scriptorium] escolher pasta falhou:", e);
    }
  }

  async function clear() {
    await invoke("cmd_set_scriptorium_vault", { vaultPath: null });
    setVaultPath(null);
  }

  return (
    <div className="p-8 space-y-6">
      <header>
        <h3 className="serif text-2xl font-normal text-text mb-1 tracking-tight">
          Scriptorium
        </h3>
        <p className="text-text-dim text-sm">
          Onde as capturas ⌘⇧S e ⌘⇧B (e as regras <em>save_*</em> do Minos) vão escrever.
        </p>
      </header>

      <div className="space-y-2">
        <label className="text-[10px] uppercase tracking-widest text-text-dim block">
          Vault Obsidian
        </label>
        {vaultPath ? (
          <div className="flex items-center gap-2 p-3 bg-surface border border-border rounded-xl">
            <Check size={16} className="text-accent flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="mono text-xs text-text truncate">{vaultPath}</div>
              <div className="text-[11px] text-text-dim mt-0.5">
                Notas em <code className="mono">cocito/YYYY/MM/</code>
              </div>
            </div>
            <button
              type="button"
              onClick={choose}
              disabled={saving}
              className="px-3 py-1.5 text-xs border border-border rounded-md hover:border-accent hover:text-accent transition-colors"
            >
              Alterar
            </button>
            <button
              type="button"
              onClick={clear}
              className="px-3 py-1.5 text-xs text-text-dim hover:text-red-400 transition-colors"
            >
              Limpar
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={choose}
            className="w-full p-4 bg-surface border border-dashed border-border rounded-xl flex items-center justify-center gap-2 text-text-dim hover:border-accent hover:text-accent transition-colors ease-out-smooth"
          >
            <FolderOpen size={18} />
            Escolher pasta do vault…
          </button>
        )}
      </div>

      <div className="p-4 rounded-lg bg-surface border border-border text-xs text-text-dim leading-relaxed">
        <strong className="text-text">Sem vault configurado</strong>, as capturas falham
        silenciosamente (o evento continua no Virgílio, apenas não vai para disco).
      </div>
    </div>
  );
}

// ─── Atalhos ────────────────────────────────────────────────────

function ShortcutsPanel() {
  const items: { keys: string; label: string }[] = [
    { keys: "⌘ 1..9", label: "Trocar tema (Cocito, Crepúsculo, …)" },
    { keys: "⌘ ,", label: "Abrir Preferências" },
    { keys: "⌘ ⇧ S", label: "Scriptorium · guardar seleção como quote" },
    { keys: "⌘ ⇧ B", label: "Scriptorium · guardar URL breadcrumb" },
    { keys: "⌘ ⇧ P", label: "Scriptorium · página atual → markdown" },
    { keys: "⌘ ⇧ F", label: "Virgílio · pesquisa palette" },
    { keys: "⌘ K", label: "Beatriz · AI overlay" },
  ];

  return (
    <div className="p-8 space-y-6">
      <header>
        <h3 className="serif text-2xl font-normal text-text mb-1 tracking-tight">
          Atalhos
        </h3>
        <p className="text-text-dim text-sm">
          Por agora só para ver. Editar atalhos chega numa versão futura.
        </p>
      </header>

      <div className="space-y-1.5">
        {items.map((it) => (
          <div
            key={it.label}
            className="flex items-center justify-between p-3 bg-surface border border-border rounded-lg"
          >
            <span className="text-sm text-text">{it.label}</span>
            <kbd className="mono text-[11px] px-2 py-1 rounded bg-surface-2 border border-border text-text">
              {it.keys}
            </kbd>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Idioma (Babele) ────────────────────────────────────────────

function LanguagePanel() {
  const locale = useBabele((s) => s.locale);
  const setLocale = useBabele((s) => s.setLocale);
  return (
    <div className="p-8 space-y-6">
      <header>
        <h3 className="serif text-2xl font-normal text-text mb-1 tracking-tight">Babele</h3>
        <p className="text-text-dim text-sm">
          Traduções da UI do Cocito. {LOCALES.length} idiomas — cobre ~95% dos
          falantes mundiais (L1+L2). Não afeta o conteúdo dos serviços (esse
          vive dentro das webviews).
        </p>
      </header>

      <div className="space-y-2">
        {LOCALES.map((l) => (
          <button
            key={l.code}
            type="button"
            onClick={() => setLocale(l.code as Locale)}
            className={[
              "w-full bg-surface border rounded-lg p-3 flex items-center justify-between transition-all ease-out-smooth",
              l.code === locale
                ? "border-accent shadow-[0_0_0_1px_var(--accent)]"
                : "border-border hover:border-accent/60 hover:-translate-y-px",
            ].join(" ")}
          >
            <span className="flex-1 text-left">
              <span className="text-text text-sm font-medium block">{l.label}</span>
              <span className="text-[11px] text-text-dim block">{l.region}</span>
            </span>
            <span className="mono text-[10px] text-text-dim mr-3">{l.code}</span>
            {l.code === locale ? (
              <span className="w-5 h-5 rounded-full bg-accent text-bg flex items-center justify-center text-[13px] font-bold">
                ✓
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Sobre ──────────────────────────────────────────────────────

function AboutPanel() {
  // O plugin-shell do Tauri foi removido deliberadamente (ver memória do
  // projecto). Usamos `<a target="_blank">` — o Tauri intercepta links http(s)
  // externos e abre no browser do sistema sem precisar de invoke específico.
  const links = [
    {
      label: "GitHub",
      handle: "@fagnercandido",
      url: "https://github.com/fagnercandido",
      icon: (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
          <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56v-1.96c-3.2.7-3.87-1.54-3.87-1.54-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.69 1.25 3.34.96.1-.74.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.16 1.18a10.94 10.94 0 0 1 5.76 0c2.2-1.49 3.16-1.18 3.16-1.18.62 1.58.23 2.75.11 3.04.74.81 1.18 1.84 1.18 3.1 0 4.42-2.7 5.39-5.27 5.68.41.36.78 1.06.78 2.13v3.16c0 .31.21.67.8.56C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z" />
        </svg>
      ),
    },
    {
      label: "LinkedIn",
      handle: "in/fagner-souza-candido",
      url: "https://pt.linkedin.com/in/fagner-souza-candido",
      icon: (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
          <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.04-1.86-3.04-1.86 0-2.14 1.45-2.14 2.95v5.66H9.36V9h3.41v1.56h.05c.47-.9 1.64-1.86 3.37-1.86 3.6 0 4.27 2.37 4.27 5.45v6.3zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.55C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="p-8 space-y-6">
      <header>
        <h3 className="serif text-4xl font-light text-text mb-2 tracking-tight">
          Cocito · <span className="italic text-accent">IX</span>
        </h3>
        <p className="serif italic text-text-dim text-lg leading-snug">
          Onde todas as conversas convergem.
        </p>
      </header>

      <div className="space-y-3 text-sm text-text-dim leading-relaxed max-w-md">
        <p>
          Hub de comunicação desktop Dante-themed. Zero backend. Zero cloud.
          Cada serviço vive numa bolgia isolada — cookies e storage nunca cruzam.
        </p>
        <p className="serif italic text-text">
          «Qui si convien lasciare ogne sospetto.»<br />
          <span className="mono not-italic text-[11px] text-text-dim">— Inferno · III · 14</span>
        </p>
      </div>

      <div className="space-y-2 max-w-md">
        <span className="text-[10px] uppercase tracking-widest text-text-dim block">
          Autor · Fagner Candido
        </span>
        {links.map((l) => (
          <a
            key={l.label}
            href={l.url}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center gap-3 p-3 bg-surface border border-border rounded-xl hover:border-accent hover:-translate-y-px transition-all ease-out-smooth text-left group no-underline"
          >
            <span className="w-9 h-9 flex items-center justify-center rounded-lg bg-surface-2 border border-border text-text-dim group-hover:text-accent group-hover:border-accent/60 transition-colors">
              {l.icon}
            </span>
            <span className="flex-1 min-w-0">
              <span className="text-sm text-text font-medium block">{l.label}</span>
              <span className="mono text-[11px] text-text-dim block truncate">{l.handle}</span>
            </span>
            <span className="text-text-dim text-xs opacity-0 group-hover:opacity-100 transition-opacity">↗</span>
          </a>
        ))}
      </div>

      <div className="pt-4 border-t border-border mono text-[11px] text-text-dim">
        0.3.0 · Tauri 2 + React · Mac M1 64GB · qwen3:32b
      </div>
    </div>
  );
}
