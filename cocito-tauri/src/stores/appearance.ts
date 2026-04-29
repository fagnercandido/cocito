import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

// ─── Tipos ─────────────────────────────────────────────────────────

export type ThemeSlug =
  | "cocito"
  | "crepuscolo"
  | "bufera"
  | "autunno"
  | "oro"
  | "stige"
  | "ferro"
  | "flegetonte"
  | "malebolge";

export type ModeSlug = "auto" | "light" | "dark";

export type TypographySlug = "sobria" | "literaria" | "nativa";

export interface AppearanceState {
  theme: ThemeSlug;
  mode: ModeSlug;
  typography: TypographySlug;

  setTheme: (t: ThemeSlug) => Promise<void>;
  setMode: (m: ModeSlug) => Promise<void>;
  setTypography: (t: TypographySlug) => Promise<void>;
  hydrate: () => Promise<void>;
}

// ─── Ordem canónica dos temas (para atalhos ⌘1..⌘9) ──────────────────

export const THEME_ORDER: ThemeSlug[] = [
  "cocito",
  "crepuscolo",
  "bufera",
  "autunno",
  "oro",
  "stige",
  "ferro",
  "flegetonte",
  "malebolge",
];

// ─── Aplicação ao DOM ────────────────────────────────────────────────

function applyToDom(appearance: { theme: ThemeSlug; mode: ModeSlug; typography: TypographySlug }) {
  const html = document.documentElement;
  html.setAttribute("data-theme", appearance.theme);
  html.setAttribute("data-typography", appearance.typography);
  if (appearance.mode === "auto") html.removeAttribute("data-mode");
  else html.setAttribute("data-mode", appearance.mode);
}

// ─── Persistência no backend Rust ────────────────────────────────────

async function persist(appearance: {
  theme: ThemeSlug;
  mode: ModeSlug;
  typography: TypographySlug;
}) {
  try {
    await invoke("cmd_set_appearance", {
      appearance: {
        theme: appearance.theme,
        mode: appearance.mode === "auto" ? null : appearance.mode,
        typography: appearance.typography,
      },
    });
  } catch (e) {
    console.warn("[appearance] persist falhou:", e);
  }
}

// ─── Store ───────────────────────────────────────────────────────────

export const useAppearance = create<AppearanceState>((set, get) => ({
  theme: "cocito",
  mode: "auto",
  typography: "sobria",

  async setTheme(theme) {
    set({ theme });
    applyToDom({ ...get(), theme });
    await persist({ ...get(), theme });
  },

  async setMode(mode) {
    set({ mode });
    applyToDom({ ...get(), mode });
    await persist({ ...get(), mode });
  },

  async setTypography(typography) {
    set({ typography });
    applyToDom({ ...get(), typography });
    await persist({ ...get(), typography });
  },

  async hydrate() {
    try {
      const cfg = await invoke<{
        appearance: { theme: string; mode: string | null; typography: string };
      }>("cmd_get_config");
      const next = {
        theme: (cfg.appearance.theme as ThemeSlug) ?? "cocito",
        mode: (cfg.appearance.mode as ModeSlug | null) ?? "auto",
        typography: (cfg.appearance.typography as TypographySlug) ?? "sobria",
      };
      set(next);
      applyToDom(next);
    } catch (e) {
      console.warn("[appearance] hydrate falhou, a usar defaults:", e);
      applyToDom(get());
    }
  },
}));
