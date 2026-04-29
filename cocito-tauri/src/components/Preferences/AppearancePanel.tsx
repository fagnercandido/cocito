/**
 * AppearancePanel · conteúdo da tab "Aparência" dentro do PreferencesModal.
 * Contém Tema (grid 3×3), Modo (auto/light/dark), Tipografia (3 stacks).
 */

import { Sun, Moon, Contrast } from "lucide-react";
import {
  useAppearance,
  type ThemeSlug,
  type ModeSlug,
  type TypographySlug,
} from "../../stores/appearance";

const THEMES: { slug: ThemeSlug; name: string; roman: string; circle: string }[] = [
  { slug: "cocito", name: "Cocito", roman: "IX", circle: "Traição · default" },
  { slug: "crepuscolo", name: "Crepúsculo", roman: "I", circle: "Limbo" },
  { slug: "bufera", name: "Bufera", roman: "II", circle: "Luxúria" },
  { slug: "autunno", name: "Autunno", roman: "III", circle: "Gula" },
  { slug: "oro", name: "Oro", roman: "IV", circle: "Avareza" },
  { slug: "stige", name: "Stige", roman: "V", circle: "Ira" },
  { slug: "ferro", name: "Ferro", roman: "VI", circle: "Heresia" },
  { slug: "flegetonte", name: "Flegetonte", roman: "VII", circle: "Violência" },
  { slug: "malebolge", name: "Malebolge", roman: "VIII", circle: "Fraude" },
];

const MODES: { slug: ModeSlug; label: string; sub: string; icon: JSX.Element }[] = [
  { slug: "auto", label: "Auto", sub: "Segue o sistema", icon: <Contrast size={18} /> },
  { slug: "light", label: "Claro", sub: "Sempre light", icon: <Sun size={18} /> },
  { slug: "dark", label: "Escuro", sub: "Sempre dark", icon: <Moon size={18} /> },
];

const TYPOS: { slug: TypographySlug; name: string; sub: string }[] = [
  { slug: "sobria", name: "Sóbria", sub: "Inter + Newsreader + JetBrains" },
  { slug: "literaria", name: "Literária", sub: "Inter + Spectral + Geist Mono" },
  { slug: "nativa", name: "Nativa", sub: "SF Pro / New York · system" },
];

export function AppearancePanel() {
  const theme = useAppearance((s) => s.theme);
  const mode = useAppearance((s) => s.mode);
  const typography = useAppearance((s) => s.typography);
  const setTheme = useAppearance((s) => s.setTheme);
  const setMode = useAppearance((s) => s.setMode);
  const setTypography = useAppearance((s) => s.setTypography);

  return (
    <div className="p-8 space-y-8">
      {/* Tema */}
      <section>
        <SectionHead
          title="Tema"
          hint={
            <>
              Nove círculos. Atalho{" "}
              <kbd className="mono bg-surface-2 px-1.5 py-px rounded text-[10px] text-text">
                ⌘1..⌘9
              </kbd>
              .
            </>
          }
        />
        <div className="grid grid-cols-3 gap-2.5">
          {THEMES.map((t) => (
            <ThemeCard
              key={t.slug}
              meta={t}
              selected={t.slug === theme}
              onClick={() => setTheme(t.slug)}
            />
          ))}
        </div>
      </section>

      {/* Modo */}
      <section>
        <SectionHead title="Modo" hint="Segue prefers-color-scheme. Forçar ignora o sistema." />
        <div className="grid grid-cols-3 gap-2">
          {MODES.map((m) => (
            <button
              key={m.slug}
              type="button"
              onClick={() => setMode(m.slug)}
              className={[
                "bg-surface border rounded-lg p-3 flex items-center gap-3 text-left transition-all ease-out-smooth",
                m.slug === mode
                  ? "border-accent shadow-[0_0_0_1px_var(--accent)]"
                  : "border-border hover:border-accent/60 hover:-translate-y-px",
              ].join(" ")}
            >
              <span className="text-accent">{m.icon}</span>
              <span>
                <span className="block text-sm font-medium text-text">{m.label}</span>
                <span className="block text-[11px] text-text-dim">{m.sub}</span>
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Tipografia */}
      <section>
        <SectionHead
          title="Tipografia"
          hint="Três stacks curadas. O brand mantém Newsreader italic em qualquer uma."
        />
        <div className="space-y-2">
          {TYPOS.map((t) => (
            <button
              key={t.slug}
              type="button"
              onClick={() => setTypography(t.slug)}
              className={[
                "w-full bg-surface border rounded-lg p-3 flex items-center justify-between gap-4 transition-all ease-out-smooth text-left",
                t.slug === typography
                  ? "border-accent shadow-[0_0_0_1px_var(--accent)]"
                  : "border-border hover:border-accent/60 hover:-translate-y-px",
              ].join(" ")}
            >
              <span>
                <span className="serif text-xl font-normal text-text block leading-tight">
                  {t.name}
                </span>
                <span className="block text-[11px] text-text-dim mono mt-0.5">{t.sub}</span>
              </span>
              {t.slug === typography ? (
                <span className="w-5 h-5 rounded-full bg-accent text-bg flex items-center justify-center text-[13px] font-bold">
                  ✓
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </section>

      {/* Identidade fixa */}
      <div className="p-3 rounded-lg bg-surface border border-border text-[12px] text-text-dim leading-relaxed">
        <strong className="text-accent">Identidade fixa:</strong> o nome da app no título e no
        hero é sempre Newsreader italic, qualquer que seja a stack escolhida.
      </div>
    </div>
  );
}

function SectionHead({ title, hint }: { title: string; hint: React.ReactNode }) {
  return (
    <header className="flex items-baseline justify-between gap-4 mb-3">
      <h3 className="serif text-lg font-normal text-text">{title}</h3>
      <p className="text-[11.5px] text-text-dim text-right max-w-[60%]">{hint}</p>
    </header>
  );
}

interface ThemeCardProps {
  meta: (typeof THEMES)[number];
  selected: boolean;
  onClick: () => void;
}

function ThemeCard({ meta, selected, onClick }: ThemeCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-theme={meta.slug}
      className={[
        "relative h-[88px] rounded-lg border overflow-hidden text-left transition-all ease-out-smooth",
        selected
          ? "border-accent shadow-[0_0_0_1.5px_var(--accent)]"
          : "border-border hover:-translate-y-0.5",
      ].join(" ")}
      style={{ background: "var(--bg)", backgroundImage: "var(--grad)" }}
    >
      <div className="p-2.5 flex flex-col justify-between h-full">
        <div className="serif font-normal text-[15px] leading-tight" style={{ color: "var(--text)" }}>
          {meta.name}
        </div>
        <div
          className="flex items-center justify-between text-[9px] uppercase tracking-widest"
          style={{ color: "var(--text-dim)" }}
        >
          <span>
            {meta.roman} · {meta.circle.split(" · ")[0]}
          </span>
          <span
            className="w-2 h-2 rounded-full"
            style={{ background: "var(--accent)", boxShadow: "0 0 8px var(--accent)" }}
          />
        </div>
      </div>
      {selected ? (
        <div
          className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold"
          style={{ background: "var(--accent)", color: "var(--bg)" }}
        >
          ✓
        </div>
      ) : null}
    </button>
  );
}
