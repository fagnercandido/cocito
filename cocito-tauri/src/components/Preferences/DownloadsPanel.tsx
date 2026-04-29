/**
 * DownloadsPanel · política de descarregas das WebViews.
 *
 * Três modos:
 *   · auto   → tudo cai em ~/Downloads (default do SO), sem perguntar.
 *   · fixed  → tudo cai numa pasta escolhida pelo utilizador.
 *   · ask    → diálogo nativo a cada download (escolhe destino caso a caso).
 *
 * O hook real está em `caronte::on_download` (Rust). Aqui só persistimos a
 * preferência via `cmd_set_downloads`.
 */

import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { Download, FolderOpen, MessageCircleQuestion, Check } from "lucide-react";

type Mode = "auto" | "fixed" | "ask";

interface Cfg {
  downloads: {
    mode: Mode;
    path: string | null;
  };
}

export function DownloadsPanel() {
  const [mode, setMode] = useState<Mode>("auto");
  const [path, setPath] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    invoke<Cfg>("cmd_get_config")
      .then((cfg) => {
        setMode((cfg.downloads?.mode ?? "auto") as Mode);
        setPath(cfg.downloads?.path ?? null);
      })
      .catch(() => {});
  }, []);

  async function persist(nextMode: Mode, nextPath: string | null) {
    setSaving(true);
    try {
      await invoke("cmd_set_downloads", { mode: nextMode, path: nextPath });
      setMode(nextMode);
      setPath(nextPath);
    } catch (e) {
      console.warn("[Downloads] persist falhou:", e);
    } finally {
      setSaving(false);
    }
  }

  async function chooseFolder() {
    try {
      const selected = await openDialog({
        directory: true,
        multiple: false,
        title: "Escolher pasta para downloads",
      });
      if (typeof selected === "string") {
        await persist("fixed", selected);
      }
    } catch (e) {
      console.warn("[Downloads] escolher pasta falhou:", e);
    }
  }

  const options: {
    id: Mode;
    icon: JSX.Element;
    title: string;
    desc: string;
  }[] = [
    {
      id: "auto",
      icon: <Download size={18} />,
      title: "Pasta Downloads do sistema",
      desc:
        "Default — tudo o que descarregares vai direto para ~/Downloads (ou equivalente Windows/Linux), como qualquer browser.",
    },
    {
      id: "fixed",
      icon: <FolderOpen size={18} />,
      title: "Sempre numa pasta específica",
      desc:
        "Escolhe uma pasta uma vez. Todos os downloads (de qualquer serviço) vão para lá. Útil se queres tudo organizado num projeto.",
    },
    {
      id: "ask",
      icon: <MessageCircleQuestion size={18} />,
      title: "Perguntar a cada vez",
      desc:
        "Abre um diálogo nativo a cada download para escolheres destino. Mais lento, mas controlas tudo.",
    },
  ];

  return (
    <div className="p-8 space-y-6">
      <header>
        <h3 className="serif text-2xl font-normal text-text mb-1 tracking-tight">
          Downloads
        </h3>
        <p className="text-text-dim text-sm">
          Para onde vão os ficheiros descarregados pelas webviews dos serviços
          (anexos do Gmail, partilhas no Slack, exports do Linear…).
        </p>
      </header>

      <div className="space-y-2">
        {options.map((opt) => {
          const active = opt.id === mode;
          return (
            <button
              key={opt.id}
              type="button"
              disabled={saving}
              onClick={() => {
                if (opt.id === "fixed") {
                  // Se ainda não há path, abrir picker imediatamente.
                  // Caso contrário, só ativar o modo (mantém path anterior).
                  if (!path) chooseFolder();
                  else persist("fixed", path);
                } else {
                  persist(opt.id, path);
                }
              }}
              className={[
                "w-full text-left p-4 rounded-xl border transition-all ease-out-smooth flex gap-3",
                active
                  ? "border-accent bg-surface shadow-[0_0_0_1px_var(--accent)]"
                  : "border-border bg-surface hover:border-accent/60 hover:-translate-y-px",
              ].join(" ")}
            >
              <span
                className={[
                  "w-9 h-9 flex-shrink-0 rounded-lg flex items-center justify-center border",
                  active
                    ? "bg-accent text-bg border-accent"
                    : "bg-surface-2 text-text-dim border-border",
                ].join(" ")}
              >
                {opt.icon}
              </span>
              <span className="flex-1 min-w-0">
                <span className="text-sm font-medium text-text block">
                  {opt.title}
                </span>
                <span className="text-[12px] text-text-dim block leading-relaxed mt-0.5">
                  {opt.desc}
                </span>
              </span>
              {active ? (
                <span className="w-5 h-5 rounded-full bg-accent text-bg flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Check size={13} strokeWidth={3} />
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Detalhe da pasta — visível só quando modo = fixed */}
      {mode === "fixed" ? (
        <div className="space-y-2">
          <label className="text-[10px] uppercase tracking-widest text-text-dim block">
            Pasta de destino
          </label>
          {path ? (
            <div className="flex items-center gap-2 p-3 bg-surface border border-border rounded-xl">
              <Check size={16} className="text-accent flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="mono text-xs text-text truncate">{path}</div>
                <div className="text-[11px] text-text-dim mt-0.5">
                  Todos os downloads vão para aqui.
                </div>
              </div>
              <button
                type="button"
                onClick={chooseFolder}
                disabled={saving}
                className="px-3 py-1.5 text-xs border border-border rounded-md hover:border-accent hover:text-accent transition-colors"
              >
                Alterar
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={chooseFolder}
              className="w-full p-4 bg-surface border border-dashed border-border rounded-xl flex items-center justify-center gap-2 text-text-dim hover:border-accent hover:text-accent transition-colors ease-out-smooth"
            >
              <FolderOpen size={18} />
              Escolher pasta…
            </button>
          )}
        </div>
      ) : null}

      <div className="p-4 rounded-lg bg-surface border border-border text-xs text-text-dim leading-relaxed">
        <strong className="text-text">Privacidade.</strong> O Cocito nunca olha
        para o que descarregas — só decide para onde. Os bytes vão da webview
        para o disco directamente, sem passar por nenhum índice.
      </div>
    </div>
  );
}
