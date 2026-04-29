/**
 * Titlebar · chrome da janela com traffic lights à esquerda,
 * "Cocito · <conteúdo>" ao centro em Newsreader italic (identidade fixa).
 *
 * No macOS o `titleBarStyle: "Overlay"` do tauri.conf.json deixa esta div
 * livre sobre o espaço do title bar nativo — as traffic lights ficam
 * sobrepostas mas o espaço é reservado via padding.
 *
 * Drag: usamos **handler explícito** via `getCurrentWindow().startDragging()`
 * em vez de `data-tauri-drag-region`. O atributo data-* depende de timing
 * de injeção do wry e em algumas builds (release notarizado, paths com
 * espaços, etc.) não dispara consistentemente. O handler manual no
 * `onMouseDown` é o caminho oficial recomendado para drag em Tauri 2 e
 * funciona em qualquer cenário.
 *
 * Bonus: `onDoubleClick` chama `toggleMaximize()` — comportamento nativo
 * macOS (duplo-clique no título maximiza).
 */

import { getCurrentWindow } from "@tauri-apps/api/window";

interface Props {
  subtitle?: string;
}

async function startDrag(e: React.MouseEvent<HTMLElement>) {
  // Só botão esquerdo, single click — não interferir com right-click,
  // text selection ou multi-click.
  if (e.button !== 0) return;
  // Detecta interactive children (botões, inputs) — se o target tem o
  // atributo data-no-drag, ignora.
  const target = e.target as HTMLElement;
  if (target.closest("[data-no-drag]")) return;
  try {
    await getCurrentWindow().startDragging();
  } catch (err) {
    console.warn("[Titlebar] startDragging falhou:", err);
  }
}

async function toggleMax() {
  try {
    await getCurrentWindow().toggleMaximize();
  } catch (err) {
    console.warn("[Titlebar] toggleMaximize falhou:", err);
  }
}

export function Titlebar({ subtitle }: Props) {
  return (
    <header
      className="h-10 flex items-center border-b border-border/80 flex-shrink-0 relative select-none"
      style={{ paddingLeft: 78 /* espaço para traffic lights no mac */ }}
      onMouseDown={startDrag}
      onDoubleClick={toggleMax}
      // Mantemos também o atributo como cinto-e-suspensórios — se o handler
      // explícito falhar por alguma razão, o data-attr ainda cobre.
      data-tauri-drag-region
    >
      <div
        className="flex-1 text-center text-xs text-text-dim tracking-wide pointer-events-none"
      >
        <span className="brand-lake mr-2 text-sm text-text">Cocito</span>
        {subtitle ? <span>{subtitle}</span> : null}
      </div>
    </header>
  );
}
