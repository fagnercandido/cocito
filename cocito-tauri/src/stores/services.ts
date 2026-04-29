import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

// ─── Tipos ─────────────────────────────────────────────────────────

/** Definição de um serviço no catálogo (services.json). */
export interface ServiceDef {
  id: string;
  name: string;
  url: string;
  icon: string;
  userAgent: string;
  canHaveMultipleInstances?: boolean;
  titleBadgePattern?: string;
  senderParser?: string;
}

/** Uma instância ativa na sidebar (um Slack Work é uma instance do Slack). */
export interface ServiceInstance {
  /** ID único — slug do service + opcional tag ("slack-work", "gmail-personal"). */
  id: string;
  serviceId: string;
  label?: string;  // ex: "Work", "Personal"
  url: string;     // pode diferir do default do service (ex: workspace-specific)
  userAgent: string;
  unread?: number;
  /** Tag de 1 caractere sobreposto ao ícone (W=Work, P=Personal). */
  tag?: string;
  /** Último sender extraído pelo parser pack (efêmero, só em runtime). */
  lastSender?: string;
  /** Último channel extraído pelo parser pack (efêmero, só em runtime). */
  lastChannel?: string;
}

export interface ServicesState {
  catalog: ServiceDef[];
  instances: ServiceInstance[];
  activeInstanceId: string | null;

  loadCatalog: () => Promise<void>;
  addInstance: (i: ServiceInstance) => void;
  removeInstance: (id: string) => void;
  reorderInstances: (ids: string[]) => void;
  setActive: (id: string | null) => void;
  setUnread: (id: string, count: number) => void;
  setLastParsed: (id: string, parsed: { sender?: string; channel?: string }) => void;
}

export const useServices = create<ServicesState>((set) => ({
  catalog: [],
  instances: [],
  activeInstanceId: null,

  async loadCatalog() {
    try {
      const catalog = await invoke<ServiceDef[]>("cmd_list_services");
      set({ catalog });
    } catch (e) {
      console.warn("[services] loadCatalog falhou:", e);
    }
  },

  addInstance(i) {
    set((s) => ({ instances: [...s.instances, i] }));
  },

  removeInstance(id) {
    set((s) => ({
      instances: s.instances.filter((x) => x.id !== id),
      activeInstanceId: s.activeInstanceId === id ? null : s.activeInstanceId,
    }));
  },

  reorderInstances(ids) {
    set((s) => {
      const byId = new Map(s.instances.map((i) => [i.id, i]));
      return { instances: ids.map((id) => byId.get(id)!).filter(Boolean) };
    });
  },

  setActive(id) {
    set({ activeInstanceId: id });
  },

  setUnread(id, count) {
    set((s) => ({
      instances: s.instances.map((i) =>
        i.id === id ? { ...i, unread: count } : i
      ),
    }));
    // Persiste no Rust (best-effort, não bloqueia UI).
    invoke("cmd_set_unread", { instanceId: id, unread: count }).catch(() => {});
  },

  setLastParsed(id, parsed) {
    set((s) => ({
      instances: s.instances.map((i) =>
        i.id === id
          ? { ...i, lastSender: parsed.sender, lastChannel: parsed.channel }
          : i,
      ),
    }));
  },
}));
