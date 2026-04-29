/**
 * useModalA11y · acessibilidade básica para modais/overlays.
 *
 *   1. Trap de focus dentro do dialog (Tab fica preso)
 *   2. Escape fecha
 *   3. Foca o primeiro elemento focável ao abrir
 *   4. Devolve o focus ao trigger original quando fecha
 */

import { useEffect, useRef } from "react";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export function useModalA11y(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const previousActiveRef = useRef<Element | null>(null);

  useEffect(() => {
    previousActiveRef.current = document.activeElement;
    const node = ref.current;
    if (!node) return;

    // Foca o primeiro elemento focável; senão o próprio container.
    const focusables = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE));
    const first = focusables.find((el) => !el.hasAttribute("data-autofocus-skip"));
    if (first) {
      first.focus();
    } else {
      node.setAttribute("tabindex", "-1");
      node.focus();
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const list = Array.from(node!.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (list.length === 0) return;
      const head = list[0];
      const tail = list[list.length - 1];
      const active = document.activeElement as HTMLElement;
      if (e.shiftKey && active === head) {
        e.preventDefault();
        tail.focus();
      } else if (!e.shiftKey && active === tail) {
        e.preventDefault();
        head.focus();
      }
    }

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      // Devolve o focus ao trigger original.
      const prev = previousActiveRef.current as HTMLElement | null;
      if (prev && typeof prev.focus === "function") {
        prev.focus();
      }
    };
  }, [onClose]);

  return ref;
}
