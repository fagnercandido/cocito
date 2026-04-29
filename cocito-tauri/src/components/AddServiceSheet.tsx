/**
 * AddServiceSheet · modal para adicionar um serviço à sidebar.
 *
 * Fluxo em 2 passos:
 *   1. Escolher o serviço do catálogo (grid de ícones)
 *   2. Opcionalmente dar um label e tag (para distinguir Pessoal de Trabalho)
 *
 * Princípio UX: "só mostrar opções que funcionam" — não listamos
 * serviços não configuráveis nem mostramos campos irrelevantes para serviços
 * de instância única (`canHaveMultipleInstances: false`).
 */

import { useState } from "react";
import { X } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { ServiceIcon } from "./ServiceIcon";
import type { ServiceDef, ServiceInstance } from "../stores/services";
import { useServices } from "../stores/services";
import { useBabele } from "../locales";
import { useModalA11y } from "../hooks/useModalA11y";

interface Props {
  catalog: ServiceDef[];
  onClose: () => void;
}

export function AddServiceSheet({ catalog, onClose }: Props) {
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [tag, setTag] = useState("");
  const [url, setUrl] = useState("");
  const t = useBabele((s) => s.t);
  const addInstance = useServices((s) => s.addInstance);
  const setActive = useServices((s) => s.setActive);
  const existingInstances = useServices((s) => s.instances);
  const ref = useModalA11y(onClose);

  const picked = pickedId ? catalog.find((s) => s.id === pickedId) ?? null : null;

  async function confirm() {
    if (!picked) return;

    const trimmedLabel = label.trim();
    const trimmedUrl = url.trim();

    // ID da instância — cada ID equivale a uma bolgia (partition) isolada.
    // Sem label → primeira instância usa o id base (ex: "slack"); a partir
    // da segunda auto-incrementa "slack-2", "slack-3", … para garantir que
    // cada workspace tem cookies/storage próprios.
    const taken = new Set(existingInstances.map((i) => i.id));
    let id: string;
    if (!picked.canHaveMultipleInstances) {
      id = picked.id;
    } else if (trimmedLabel) {
      const slug = slugify(trimmedLabel) || picked.id;
      id = uniqueId(`${picked.id}-${slug}`, taken);
    } else {
      id = uniqueId(picked.id, taken);
    }

    const instance: ServiceInstance = {
      id,
      serviceId: picked.id,
      label: trimmedLabel || picked.name,
      url: trimmedUrl || picked.url,
      userAgent: picked.userAgent,
      tag: tag.trim().slice(0, 2) || undefined,
    };

    try {
      await invoke("cmd_add_instance", { instance: toRustShape(instance, picked) });
      addInstance(instance);
      setActive(id);
      onClose();
    } catch (e) {
      console.warn("[AddService] falhou:", e);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={t("add.title")}
        className="bg-surface border border-border rounded-2xl shadow-2xl w-[min(620px,92vw)] max-h-[88vh] overflow-hidden flex flex-col focus:outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h2 className="serif text-2xl font-normal text-text tracking-tight">
              {picked ? (
                <>
                  {t("add.confirm")} <span className="italic text-accent">{picked.name}</span>
                </>
              ) : (
                t("add.title")
              )}
            </h2>
            <p className="text-text-dim text-xs mt-1">
              {picked
                ? picked.canHaveMultipleInstances
                  ? t("add.label")
                  : t("add.title")
                : t("add.count", { n: catalog.length })}
            </p>
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
        <div className="flex-1 overflow-y-auto p-5">
          {!picked ? (
            <div className="grid grid-cols-4 gap-3">
              {catalog.map((svc) => (
                <button
                  key={svc.id}
                  type="button"
                  onClick={() => {
                    setPickedId(svc.id);
                    setUrl(svc.url);
                  }}
                  className="p-4 rounded-xl bg-surface-2 border border-border hover:border-accent hover:-translate-y-0.5 transition-all ease-out-smooth flex flex-col items-center gap-2.5"
                >
                  <ServiceIcon icon={svc.icon} className="w-10 h-10" />
                  <span className="text-xs font-medium text-text">{svc.name}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {picked.canHaveMultipleInstances && (
                <Field label={t("add.label")}>
                  <input
                    type="text"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder={t("add.labelPlaceholder")}
                    autoFocus
                    className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-text focus:border-accent focus:outline-none transition-colors ease-out-smooth"
                  />
                </Field>
              )}

              {picked.canHaveMultipleInstances && (
                <Field label={t("add.tag")}>
                  <input
                    type="text"
                    value={tag}
                    onChange={(e) => setTag(e.target.value.toUpperCase().slice(0, 2))}
                    placeholder="A · P · T …"
                    maxLength={2}
                    className="w-20 bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-text text-center font-bold uppercase focus:border-accent focus:outline-none transition-colors ease-out-smooth"
                  />
                </Field>
              )}

              <Field label={t("add.url")}>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-text mono focus:border-accent focus:outline-none transition-colors ease-out-smooth"
                />
              </Field>

              <div className="text-xs text-text-dim leading-relaxed p-3 rounded-lg bg-surface-2 border border-border">
                <strong className="text-text">Malebolge:</strong> esta instância vai viver numa bolgia isolada.
                Cookies e storage dela nunca cruzam com outros serviços — nem sequer
                com outras instâncias do mesmo serviço.
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="flex items-center justify-between p-5 border-t border-border gap-3">
          {picked ? (
            <button
              type="button"
              onClick={() => {
                setPickedId(null);
                setLabel("");
                setTag("");
                setUrl("");
              }}
              className="text-sm text-text-dim hover:text-text transition-colors ease-out-smooth"
            >
              {t("add.back")}
            </button>
          ) : (
            <span />
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-border text-text text-sm hover:border-accent hover:text-accent transition-colors ease-out-smooth"
            >
              {t("add.cancel")}
            </button>
            {picked && (
              <button
                type="button"
                onClick={confirm}
                className="px-4 py-2 rounded-lg bg-accent text-bg text-sm font-semibold hover:-translate-y-px transition-transform ease-out-smooth"
              >
                {t("add.confirm")}
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-widest text-text-dim mb-1.5 block">
        {label}
      </span>
      {children}
    </label>
  );
}

function uniqueId(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Converte forma camelCase (React) → snake_case esperado pelo Rust. */
function toRustShape(inst: ServiceInstance, _svc: ServiceDef) {
  return {
    id: inst.id,
    serviceId: inst.serviceId,
    label: inst.label ?? null,
    url: inst.url,
    userAgent: inst.userAgent,
    tag: inst.tag ?? null,
  };
}
