/**
 * MinosPanel · editor visual de regras (v1.2 com dnd-kit).
 *
 * Cada regra é um cartão com form-based triggers + ações + handle de drag.
 * Reorder por arrastar a pega à esquerda. Grava no rules.json via Rust.
 */

import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Plus, Trash2, Save, GripVertical } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type Trigger = Partial<{
  service: string;
  instance: string;
  titleContains: string;
  titleMatches: string;
  bodyContains: string;
  bodyMatches: string;
  timeBetween: string;
  dayOfWeek: string[];
}>;

type Action =
  | { action: "silence" }
  | { action: "priority_notify"; sound?: string }
  | { action: "set_theme"; theme: string; durationMin?: number }
  | { action: "save_breadcrumb"; tag?: string }
  | { action: "save_quote"; tag?: string };

interface Rule {
  id: string;
  name: string;
  enabled: boolean;
  when: Trigger;
  do: Action[];
}

const ACTION_TYPES: Action["action"][] = [
  "silence",
  "priority_notify",
  "set_theme",
  "save_breadcrumb",
  "save_quote",
];

export function MinosPanel() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [dirty, setDirty] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    invoke<Rule[]>("cmd_list_rules").then(setRules).catch(() => {});
  }, []);

  function update(idx: number, patch: Partial<Rule>) {
    setRules((rs) => rs.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
    setDirty(true);
  }

  function updateWhen(idx: number, patch: Trigger) {
    setRules((rs) =>
      rs.map((r, i) => (i === idx ? { ...r, when: { ...r.when, ...patch } } : r)),
    );
    setDirty(true);
  }

  function addAction(idx: number, kind: Action["action"]) {
    const def: Record<Action["action"], Action> = {
      silence: { action: "silence" },
      priority_notify: { action: "priority_notify", sound: "Glass" },
      set_theme: { action: "set_theme", theme: "stige" },
      save_breadcrumb: { action: "save_breadcrumb" },
      save_quote: { action: "save_quote" },
    };
    setRules((rs) =>
      rs.map((r, i) => (i === idx ? { ...r, do: [...r.do, def[kind]] } : r)),
    );
    setDirty(true);
  }

  function removeAction(ri: number, ai: number) {
    setRules((rs) =>
      rs.map((r, i) =>
        i === ri ? { ...r, do: r.do.filter((_, j) => j !== ai) } : r,
      ),
    );
    setDirty(true);
  }

  function newRule() {
    const id = `rule-${Date.now()}`;
    setRules((rs) => [
      ...rs,
      { id, name: "Nova regra", enabled: true, when: {}, do: [] },
    ]);
    setDirty(true);
  }

  function removeRule(idx: number) {
    setRules((rs) => rs.filter((_, i) => i !== idx));
    setDirty(true);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setRules((rs) => {
      const from = rs.findIndex((r) => r.id === active.id);
      const to = rs.findIndex((r) => r.id === over.id);
      return arrayMove(rs, from, to);
    });
    setDirty(true);
  }

  async function save() {
    const clean = rules.map((r) => ({
      ...r,
      when: Object.fromEntries(
        Object.entries(r.when).filter(([, v]) => v !== "" && v !== undefined),
      ),
    }));
    try {
      await invoke("cmd_save_rules", { rules: clean });
      setDirty(false);
    } catch (e) {
      console.warn("[Minos] save falhou:", e);
    }
  }

  return (
    <div className="p-8 space-y-6">
      <header className="flex items-start justify-between">
        <div>
          <h3 className="serif text-2xl font-normal text-text mb-1 tracking-tight">Minos</h3>
          <p className="text-text-dim text-sm">
            {rules.length === 0
              ? "Sem regras. Adiciona a primeira — PROD em Slack → tema Stige, por exemplo."
              : `${rules.length} ${rules.length === 1 ? "regra" : "regras"} · hot-reload automático.`}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={newRule}
            className="px-3 py-1.5 text-xs bg-surface border border-border rounded-md hover:border-accent hover:text-accent transition-colors flex items-center gap-1.5"
          >
            <Plus size={14} /> Nova
          </button>
          {dirty ? (
            <button
              type="button"
              onClick={save}
              className="px-3 py-1.5 text-xs bg-accent text-bg rounded-md font-semibold hover:-translate-y-px transition-transform flex items-center gap-1.5"
            >
              <Save size={14} /> Gravar
            </button>
          ) : null}
        </div>
      </header>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={rules.map((r) => r.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {rules.map((r, idx) => (
              <SortableRule
                key={r.id}
                rule={r}
                idx={idx}
                update={update}
                updateWhen={updateWhen}
                addAction={addAction}
                removeAction={removeAction}
                removeRule={removeRule}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <p className="text-text-dim text-[11px] mono leading-relaxed border-t border-border pt-4 mt-6">
        Rules ficam em <code>~/Library/Application Support/app.cocito.desktop/rules.json</code>.
        Hot-reload automático. Arrasta pelas pegas <GripVertical size={11} className="inline" /> para reordenar.
      </p>
    </div>
  );
}

interface SortableRuleProps {
  rule: Rule;
  idx: number;
  update: (idx: number, patch: Partial<Rule>) => void;
  updateWhen: (idx: number, patch: Trigger) => void;
  addAction: (idx: number, kind: Action["action"]) => void;
  removeAction: (ri: number, ai: number) => void;
  removeRule: (idx: number) => void;
}

function SortableRule({
  rule: r,
  idx,
  update,
  updateWhen,
  addAction,
  removeAction,
  removeRule,
}: SortableRuleProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: r.id,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <article
      ref={setNodeRef}
      style={style}
      className="bg-surface border border-border rounded-xl p-4 space-y-3"
    >
      <header className="flex items-center gap-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label="Arrastar para reordenar"
          className="text-text-dim hover:text-text cursor-grab active:cursor-grabbing"
        >
          <GripVertical size={14} />
        </button>
        <input
          type="checkbox"
          checked={r.enabled}
          onChange={(e) => update(idx, { enabled: e.target.checked })}
          className="accent-accent"
        />
        <input
          type="text"
          value={r.name}
          onChange={(e) => update(idx, { name: e.target.value })}
          className="flex-1 bg-transparent border-none text-text font-medium focus:outline-none text-sm"
        />
        <button
          type="button"
          onClick={() => removeRule(idx)}
          className="text-text-dim hover:text-red-400 transition-colors p-1"
        >
          <Trash2 size={14} />
        </button>
      </header>

      <div className="grid grid-cols-2 gap-2">
        <TriggerInput label="service" value={r.when.service ?? ""} onChange={(v) => updateWhen(idx, { service: v || undefined })} />
        <TriggerInput label="instance" value={r.when.instance ?? ""} onChange={(v) => updateWhen(idx, { instance: v || undefined })} />
        <TriggerInput label="titleContains" value={r.when.titleContains ?? ""} onChange={(v) => updateWhen(idx, { titleContains: v || undefined })} />
        <TriggerInput label="bodyContains" value={r.when.bodyContains ?? ""} onChange={(v) => updateWhen(idx, { bodyContains: v || undefined })} />
        <TriggerInput label="titleMatches (regex)" value={r.when.titleMatches ?? ""} onChange={(v) => updateWhen(idx, { titleMatches: v || undefined })} />
        <TriggerInput label="timeBetween (22:00-06:00)" value={r.when.timeBetween ?? ""} onChange={(v) => updateWhen(idx, { timeBetween: v || undefined })} />
      </div>

      <div className="border-t border-border pt-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="mono text-[10px] uppercase tracking-widest text-text-dim">
            Ações · {r.do.length}
          </span>
          <select
            onChange={(e) => {
              if (e.target.value) {
                addAction(idx, e.target.value as Action["action"]);
                e.target.value = "";
              }
            }}
            value=""
            className="text-xs bg-surface-2 border border-border rounded px-2 py-1 mono text-text-dim"
          >
            <option value="">+ Adicionar ação…</option>
            {ACTION_TYPES.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>

        {r.do.map((a, ai) => (
          <div key={ai} className="flex items-center gap-2 p-2 bg-surface-2 rounded-md text-xs">
            <span className="mono text-accent font-semibold">{a.action}</span>
            {a.action === "priority_notify" && (
              <input
                type="text"
                value={(a as any).sound ?? ""}
                onChange={(e) => {
                  const next = [...r.do];
                  next[ai] = { ...a, sound: e.target.value } as Action;
                  update(idx, { do: next });
                }}
                placeholder="sound"
                className="bg-bg border border-border rounded px-2 py-0.5 text-text mono text-[11px]"
              />
            )}
            {a.action === "set_theme" && (
              <input
                type="text"
                value={(a as any).theme ?? ""}
                onChange={(e) => {
                  const next = [...r.do];
                  next[ai] = { ...a, theme: e.target.value } as Action;
                  update(idx, { do: next });
                }}
                placeholder="theme (cocito, stige, …)"
                className="bg-bg border border-border rounded px-2 py-0.5 text-text mono text-[11px]"
              />
            )}
            {(a.action === "save_breadcrumb" || a.action === "save_quote") && (
              <input
                type="text"
                value={(a as any).tag ?? ""}
                onChange={(e) => {
                  const next = [...r.do];
                  next[ai] = { ...a, tag: e.target.value } as Action;
                  update(idx, { do: next });
                }}
                placeholder="tag"
                className="bg-bg border border-border rounded px-2 py-0.5 text-text mono text-[11px]"
              />
            )}
            <button
              type="button"
              onClick={() => removeAction(idx, ai)}
              className="ml-auto text-text-dim hover:text-red-400"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>
    </article>
  );
}

function TriggerInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-widest text-text-dim mb-1 block">
        {label}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-surface-2 border border-border rounded px-2 py-1 text-xs text-text mono focus:outline-none focus:border-accent"
      />
    </label>
  );
}
