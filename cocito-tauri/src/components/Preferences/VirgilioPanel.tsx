/**
 * VirgilioPanel · "Vírgilio · Tour"
 *
 * Carrossel animado que apresenta as features do Cocito uma a uma. O nome é
 * uma homenagem dupla: Vírgilio guia Dante pelo Inferno; aqui guia o
 * utilizador pelos 10 módulos do app. Não confundir com o módulo Virgílio
 * (search/SQLite) — este é só um tour visual no painel de Preferências.
 *
 * Estado: index do slide actual + auto-advance opcional. Animação com
 * Framer Motion: slides entram/saem com slide horizontal + fade. Cada slide
 * mostra um "mock" da feature em vez de screenshot real (resiliente a
 * mudanças de UI futuras, e mantém o painel leve sem assets pesados).
 */

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Layers,
  Bell,
  Scale,
  Search,
  FileText,
  Sparkles,
  Palette,
  Languages,
  Compass,
  Pause,
  Play,
} from "lucide-react";

interface Slide {
  id: string;
  module: string;
  title: string;
  body: string;
  shortcut?: string;
  icon: JSX.Element;
  /** Demo visual minimalista — desenhado em SVG/divs para não depender de assets. */
  demo: JSX.Element;
}

const SLIDES: Slide[] = [
  {
    id: "caronte",
    module: "Caronte · Malebolge",
    title: "Cada serviço numa bolgia isolada",
    body:
      "WebViews nativas com partition própria por instância. Cookies, storage e cache nunca cruzam. Slack pessoal e Slack do trabalho lado a lado, login independente.",
    icon: <Layers size={18} />,
    demo: (
      <div className="flex items-end gap-3 justify-center">
        {["S", "G", "W", "T"].map((c, i) => (
          <motion.div
            key={c}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 * i, type: "spring", stiffness: 200 }}
            className="w-14 h-14 rounded-2xl bg-surface-2 border border-border flex items-center justify-center text-text font-bold text-lg shadow-md"
          >
            {c}
          </motion.div>
        ))}
      </div>
    ),
  },
  {
    id: "cerbero",
    module: "Cérbero",
    title: "Backbone event-driven",
    body:
      "Intercepta window.Notification em todas as webviews. Zero scraping. Cada notif é normalizada, publicada num bus, dispara notif nativa do macOS e atualiza o badge do título.",
    icon: <Bell size={18} />,
    demo: (
      <div className="relative h-20 flex items-center justify-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: [0, 1.2, 1] }}
          transition={{ duration: 0.6 }}
          className="absolute w-3 h-3 rounded-full bg-accent shadow-[0_0_20px_var(--accent)]"
        />
        {[40, 70, 100].map((r, i) => (
          <motion.div
            key={r}
            initial={{ scale: 0, opacity: 0.6 }}
            animate={{ scale: 1, opacity: 0 }}
            transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.3 }}
            className="absolute rounded-full border border-accent/40"
            style={{ width: r, height: r }}
          />
        ))}
      </div>
    ),
  },
  {
    id: "minos",
    module: "Minos",
    title: "Regras sobre o stream",
    body:
      "7 gatilhos × 5 ações. Silencia notifs de baixa prioridade, troca tema quando entras em foco, salva quotes automaticamente. Editor visual com drag & drop, hot-reload sem reiniciar.",
    icon: <Scale size={18} />,
    demo: (
      <div className="space-y-1.5 max-w-[280px] mx-auto">
        {[
          { trigger: "notification.received", action: "silence" },
          { trigger: "title.changed", action: "priority_notify" },
          { trigger: "focus", action: "set_theme" },
        ].map((rule, i) => (
          <motion.div
            key={rule.trigger}
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: i * 0.15 }}
            className="flex items-center gap-2 text-[10px] mono p-2 rounded-md bg-surface-2 border border-border"
          >
            <span className="text-accent">{rule.trigger}</span>
            <span className="text-text-dim">→</span>
            <span className="text-text">{rule.action}</span>
          </motion.div>
        ))}
      </div>
    ),
  },
  {
    id: "virgilio",
    module: "Virgílio · Search",
    title: "Pesquisa cross-service",
    body:
      "SQLite + FTS5 indexa todas as notifs, navegação e capturas. Palette ⌘⇧F devolve resultados de qualquer serviço numa só lista. Sem indexar conversas silenciosas — sem notif, sem memória.",
    shortcut: "⌘ ⇧ F",
    icon: <Search size={18} />,
    demo: (
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="max-w-[320px] mx-auto bg-surface-2 border border-border rounded-xl p-3 shadow-lg"
      >
        <div className="flex items-center gap-2 mb-2 text-text-dim text-xs">
          <Search size={13} />
          <span>cliente x · prazo</span>
          <span className="ml-auto mono text-[9px] opacity-60">12 hits</span>
        </div>
        {["Slack · #vendas", "Gmail · acordo.pdf", "Linear · #PROJ-42"].map((r, i) => (
          <motion.div
            key={r}
            initial={{ x: -10, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.1 + i * 0.08 }}
            className="text-[11px] py-1 px-2 text-text rounded hover:bg-surface"
          >
            {r}
          </motion.div>
        ))}
      </motion.div>
    ),
  },
  {
    id: "scriptorium",
    module: "Scriptorium",
    title: "Captura para Obsidian",
    body:
      "Selecção → quote (⌘⇧S). URL → breadcrumb (⌘⇧B). Página → markdown completo (⌘⇧P). Tudo em .md no vault Obsidian, organizado por ano/mês. Integra com regras Minos save_*.",
    shortcut: "⌘ ⇧ S · ⌘ ⇧ B · ⌘ ⇧ P",
    icon: <FileText size={18} />,
    demo: (
      <div className="flex justify-center gap-3">
        {[
          { k: "⌘⇧S", l: "Quote" },
          { k: "⌘⇧B", l: "URL" },
          { k: "⌘⇧P", l: "Markdown" },
        ].map((b, i) => (
          <motion.div
            key={b.k}
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: i * 0.12 }}
            className="text-center"
          >
            <kbd className="mono text-[10px] px-2 py-1.5 rounded bg-surface-2 border border-border block mb-1">
              {b.k}
            </kbd>
            <span className="text-[10px] text-text-dim">{b.l}</span>
          </motion.div>
        ))}
      </div>
    ),
  },
  {
    id: "beatriz",
    module: "Beatriz · AI",
    title: "Ollama local, zero cloud",
    body:
      "Overlay ⌘K com streaming token-a-token. Contexto opcional do Virgílio (RAG sobre as tuas notifs). Messo descobre o host Ollama via mDNS na LAN. Zero OpenAI, zero Anthropic.",
    shortcut: "⌘ K",
    icon: <Sparkles size={18} />,
    demo: (
      <div className="max-w-[300px] mx-auto bg-surface-2 border border-border rounded-xl p-3">
        <div className="text-[11px] text-text-dim mb-1.5">⌘K · qwen3:32b</div>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: "100%" }}
          transition={{ duration: 1.4, ease: "easeOut" }}
          className="text-[12px] text-text overflow-hidden whitespace-nowrap"
        >
          O cliente respondeu sobre o prazo às 14h32…
        </motion.div>
        <motion.span
          animate={{ opacity: [1, 0, 1] }}
          transition={{ duration: 0.8, repeat: Infinity }}
          className="inline-block w-[6px] h-[12px] bg-accent ml-0.5 align-middle"
        />
      </div>
    ),
  },
  {
    id: "appearance",
    module: "Aparência",
    title: "Três eixos ortogonais",
    body:
      "9 temas (Cocito, Crepúsculo, Inferno, Purgatorio, Paradiso…) × light/dark/auto × 3 stacks tipográficas (Sóbria, Literária, Nativa). Tudo aplicado em runtime, zero reload.",
    icon: <Palette size={18} />,
    demo: (
      <div className="flex justify-center gap-1.5">
        {["#5b9bd5", "#c45656", "#7c5fc7", "#d4a55a", "#5cad7d", "#c8c8c8", "#9c4569", "#3d8b8b", "#6b5b3d"].map((c, i) => (
          <motion.div
            key={c}
            initial={{ scale: 0, rotate: -45 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: i * 0.06, type: "spring", stiffness: 250 }}
            className="w-7 h-7 rounded-full border-2 border-surface shadow-md"
            style={{ background: c }}
          />
        ))}
      </div>
    ),
  },
  {
    id: "babele",
    module: "Babele",
    title: "28 idiomas, ~95% do mundo",
    body:
      "Mandarim, Hindi, Árabe (RTL), Bengali, Russo, Japonês, Coreano, Alemão, Suaíli, e mais 19. Detecção automática do SO, fallback para PT-PT. UI inteira muda em runtime.",
    icon: <Languages size={18} />,
    demo: (
      <div className="flex flex-wrap justify-center gap-1.5 max-w-[320px] mx-auto">
        {[
          "Olá", "Hello", "你好", "नमस्ते", "مرحبا", "Hola", "Bonjour",
          "こんにちは", "안녕", "Hallo", "Привет", "Selam",
        ].map((g, i) => (
          <motion.span
            key={g}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="text-[11px] px-2 py-1 rounded-md bg-surface-2 border border-border text-text"
          >
            {g}
          </motion.span>
        ))}
      </div>
    ),
  },
];

export function VirgilioPanel() {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [auto, setAuto] = useState(true);

  // Auto-advance: 6s por slide. Pausa em hover (ver onMouseEnter no wrapper).
  useEffect(() => {
    if (!auto) return;
    const id = setTimeout(() => {
      setDirection(1);
      setIndex((i) => (i + 1) % SLIDES.length);
    }, 6000);
    return () => clearTimeout(id);
  }, [auto, index]);

  function go(delta: number) {
    setDirection(delta);
    setIndex((i) => (i + delta + SLIDES.length) % SLIDES.length);
  }

  const slide = SLIDES[index];

  return (
    <div className="p-8 space-y-6" onMouseEnter={() => setAuto(false)}>
      <header className="flex items-start justify-between gap-4">
        <div>
          <h3 className="serif text-2xl font-normal text-text mb-1 tracking-tight flex items-center gap-2">
            <Compass size={20} className="text-accent" /> Vírgilio · Tour
          </h3>
          <p className="text-text-dim text-sm">
            «Lo bel pianeto che d'amar conforta…» Um guia rápido pelas features
            do Cocito. Pausa ao passar o rato.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAuto((a) => !a)}
          aria-label={auto ? "Pausar" : "Reproduzir"}
          className="w-8 h-8 rounded-lg border border-border hover:border-accent hover:text-accent text-text-dim flex items-center justify-center transition-colors"
        >
          {auto ? <Pause size={14} /> : <Play size={14} />}
        </button>
      </header>

      {/* Carrossel */}
      <div
        className="relative bg-surface border border-border rounded-2xl overflow-hidden"
        style={{ minHeight: 380 }}
      >
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={slide.id}
            custom={direction}
            initial={{ x: direction * 60, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -direction * 60, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
            className="absolute inset-0 p-7 flex flex-col"
          >
            {/* Cabeçalho do slide: módulo + ícone + atalho */}
            <div className="flex items-center justify-between mb-4">
              <span className="flex items-center gap-2 text-text-dim text-xs">
                <span className="text-accent">{slide.icon}</span>
                <span className="mono uppercase tracking-widest text-[10px]">{slide.module}</span>
              </span>
              {slide.shortcut ? (
                <kbd className="mono text-[10px] px-2 py-1 rounded bg-surface-2 border border-border text-text">
                  {slide.shortcut}
                </kbd>
              ) : null}
            </div>

            {/* Título + corpo */}
            <h4 className="serif text-2xl font-normal text-text mb-2 leading-tight">
              {slide.title}
            </h4>
            <p className="text-sm text-text-dim leading-relaxed max-w-[480px]">
              {slide.body}
            </p>

            {/* Demo visual — empurrado para baixo com flex */}
            <div className="flex-1 flex items-center justify-center mt-6 mb-2">
              {slide.demo}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Navegação */}
        <button
          type="button"
          onClick={() => go(-1)}
          aria-label="Anterior"
          className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-surface-2/80 backdrop-blur border border-border hover:border-accent hover:text-accent text-text-dim flex items-center justify-center transition-colors z-10"
        >
          <ChevronLeft size={18} />
        </button>
        <button
          type="button"
          onClick={() => go(1)}
          aria-label="Próximo"
          className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-surface-2/80 backdrop-blur border border-border hover:border-accent hover:text-accent text-text-dim flex items-center justify-center transition-colors z-10"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Indicadores (dots) */}
      <div className="flex justify-center gap-2">
        {SLIDES.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => {
              setDirection(i > index ? 1 : -1);
              setIndex(i);
            }}
            aria-label={`Ir para ${s.module}`}
            aria-current={i === index ? "true" : undefined}
            className={[
              "h-1.5 rounded-full transition-all ease-out-smooth",
              i === index ? "w-8 bg-accent" : "w-1.5 bg-text-dim/40 hover:bg-text-dim/70",
            ].join(" ")}
          />
        ))}
      </div>

      <div className="text-center text-[10px] mono text-text-dim">
        {index + 1} / {SLIDES.length}
      </div>
    </div>
  );
}
