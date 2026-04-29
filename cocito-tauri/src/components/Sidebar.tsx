/**
 * Sidebar · lista de bolgie (serviços isolados).
 *
 * Cada botão tem:
 *   · ícone real da app (ServiceIcon — cores brand)
 *   · casing temático (border, surface, accent glow quando ativo)
 *   · badge de unreads
 *   · tag de instância (A/P) quando o serviço suporta múltiplas
 *   · tooltip lateral com o nome completo
 */

import { useState } from "react";
import { Plus, Settings } from "lucide-react";
import { ServiceIcon, getBrandColor } from "./ServiceIcon";
import type { ServiceInstance } from "../stores/services";
import { useBabele } from "../locales";

interface Props {
  instances: ServiceInstance[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onOpenPreferences: () => void;
  onReorder: (ids: string[]) => void;
  serviceIconMap: Map<string, string>; // serviceId → icon slug
}

export function Sidebar({
  instances,
  activeId,
  onSelect,
  onAdd,
  onOpenPreferences,
  onReorder,
  serviceIconMap,
}: Props) {
  const t = useBabele((s) => s.t);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  function handleDrop(targetId: string) {
    if (!dragId || dragId === targetId) {
      setDragId(null);
      setOverId(null);
      return;
    }
    const ids = instances.map((i) => i.id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    const next = [...ids];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onReorder(next);
    setDragId(null);
    setOverId(null);
  }

  return (
    <aside
      className="w-[72px] border-r border-border flex flex-col items-center py-4 gap-1.5 flex-shrink-0 relative"
      style={{
        // Gradient subtil que distingue a sidebar do main (topo mais claro,
        // fundo mais escuro — sugere elevação) e reforça a hierarquia visual.
        background:
          "linear-gradient(180deg, color-mix(in srgb, var(--surface) 100%, transparent) 0%, color-mix(in srgb, var(--surface) 70%, var(--bg)) 100%)",
        boxShadow: "inset -1px 0 0 0 color-mix(in srgb, var(--accent) 8%, transparent)",
      }}
      aria-label="Serviços"
    >
      {instances.map((inst) => (
        <ServiceButton
          key={inst.id}
          instance={inst}
          icon={serviceIconMap.get(inst.serviceId) ?? inst.serviceId}
          active={inst.id === activeId}
          dragging={dragId === inst.id}
          over={overId === inst.id && dragId !== inst.id}
          onClick={() => onSelect(inst.id)}
          onDragStart={() => setDragId(inst.id)}
          onDragEnd={() => {
            setDragId(null);
            setOverId(null);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            if (dragId && dragId !== inst.id) setOverId(inst.id);
          }}
          onDrop={() => handleDrop(inst.id)}
        />
      ))}

      <div className="flex-1" />

      {/* Separador subtil entre instâncias e utilitários */}
      {instances.length > 0 ? (
        <div
          className="w-7 h-px my-1"
          style={{ background: "color-mix(in srgb, var(--text-dim) 30%, transparent)" }}
          aria-hidden="true"
        />
      ) : null}

      <button
        type="button"
        onClick={onAdd}
        aria-label={t("sidebar.add")}
        style={{ borderRadius: 14 }}
        className="group relative w-12 h-12 border border-dashed text-text-dim
                   hover:border-accent hover:text-accent hover:-translate-y-0.5
                   transition-all duration-200 ease-out-smooth
                   flex items-center justify-center"
      >
        <Plus size={20} strokeWidth={2} />
        <Tooltip label={t("sidebar.add")} />
      </button>

      <button
        type="button"
        onClick={onOpenPreferences}
        aria-label={t("sidebar.preferences")}
        style={{ borderRadius: 14 }}
        className="group relative w-12 h-12 text-text-dim border border-transparent
                   hover:text-accent hover:border-border hover:bg-surface-2
                   transition-all duration-200 ease-out-smooth
                   flex items-center justify-center mt-0.5"
      >
        <Settings size={19} strokeWidth={2} />
        <Tooltip label={`${t("sidebar.preferences")} · ⌘,`} />
      </button>
    </aside>
  );
}

// ─── Botão individual ────────────────────────────────────────────────

interface ButtonProps {
  instance: ServiceInstance;
  icon: string;
  active: boolean;
  dragging: boolean;
  over: boolean;
  onClick: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
}

function ServiceButton({
  instance,
  icon,
  active,
  dragging,
  over,
  onClick,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: ButtonProps) {
  const name = instance.label ?? instance.id;
  const brand = getBrandColor(icon);

  // Tooltip enriquecido: nome + último sender/channel se houver, e contagem.
  const tooltipParts: string[] = [name];
  if (instance.lastSender) {
    tooltipParts.push(`· ${instance.lastSender}`);
  } else if (instance.lastChannel) {
    tooltipParts.push(`· ${instance.lastChannel}`);
  }
  if (instance.unread && instance.unread > 0) {
    tooltipParts.push(`· ${instance.unread} unread`);
  }
  const tooltipLabel = tooltipParts.join(" ");

  // Casing: squircle Apple-like (border-radius ~28%) + tint brand subtil
  // radial por baixo do logo para dar assinatura da marca sem quebrar o tema.
  const style: React.CSSProperties = {
    // 14px em 48×48 = squircle suave; reutilizável entre temas.
    borderRadius: 14,
    // Tint radial do brand (baixa opacidade) sobre o surface-2 do tema.
    backgroundColor: "var(--surface-2)",
    backgroundImage: `radial-gradient(ellipse 80% 70% at 50% 120%, ${brand}38 0%, ${brand}12 40%, transparent 75%)`,
  };

  return (
    <button
      type="button"
      draggable
      onClick={onClick}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
      aria-label={name}
      aria-current={active ? "true" : undefined}
      style={style}
      className={[
        "group relative w-12 h-12 overflow-hidden flex items-center justify-center",
        "border transition-all duration-200 ease-out-smooth",
        dragging ? "opacity-40 scale-95" : "",
        over ? "ring-2 ring-accent ring-offset-2 ring-offset-surface" : "",
        active
          ? "border-accent shadow-[0_0_0_2px_var(--accent),0_6px_20px_-6px_var(--accent)]"
          : "border-border hover:-translate-y-0.5 hover:border-accent/70 hover:shadow-[0_4px_14px_-6px_rgba(0,0,0,0.5)]",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <ServiceIcon icon={icon} className="w-[26px] h-[26px] block drop-shadow-sm" />

      {instance.tag ? (
        <span
          className="absolute bottom-0.5 right-0.5 bg-surface text-text border border-border rounded-[5px] px-[3px] text-[8px] font-bold leading-[1.4] tracking-wide"
          aria-hidden="true"
        >
          {instance.tag}
        </span>
      ) : null}

      {instance.unread && instance.unread > 0 ? (
        <span
          className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-bg text-[10px] font-bold flex items-center justify-center border-2 border-surface tabular-nums"
          aria-label={`${instance.unread} não lidas`}
        >
          {instance.unread > 99 ? "99+" : instance.unread}
        </span>
      ) : null}

      <Tooltip label={tooltipLabel} />
    </button>
  );
}

// ─── Tooltip lateral ────────────────────────────────────────────────

function Tooltip({ label }: { label: string }) {
  return (
    <span
      role="tooltip"
      className="pointer-events-none absolute left-[calc(100%+12px)] top-1/2 -translate-y-1/2 z-10
                 bg-surface-2 text-text text-[11px] px-2.5 py-1 rounded-md whitespace-nowrap
                 border border-border opacity-0 group-hover:opacity-100 transition-opacity duration-150 ease-out-smooth"
    >
      {label}
    </span>
  );
}
