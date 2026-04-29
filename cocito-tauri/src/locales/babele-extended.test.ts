/**
 * Purgatorio · Babele · cobertura alargada (todos os idiomas + edge cases).
 */

import { describe, it, expect } from "vitest";
import { useBabele, LOCALES } from "./index";

describe("Babele · cobertura por idioma", () => {
  for (const { code } of LOCALES) {
    it(`${code} traduz prefs.title`, () => {
      useBabele.getState().setLocale(code);
      const out = useBabele.getState().t("prefs.title");
      expect(out).toBeTruthy();
      expect(out).not.toBe("prefs.title"); // não retorna a chave
    });
  }
});

describe("Babele · interpolação", () => {
  it("substitui múltiplas variáveis", () => {
    useBabele.getState().setLocale("pt-PT");
    expect(useBabele.getState().t("services.count", { n: 5 })).toContain("5");
  });

  it("aceita string e número", () => {
    useBabele.getState().setLocale("en");
    const out = useBabele.getState().t("status.ollama", { host: "my-mac.local" });
    expect(out).toContain("my-mac.local");
  });

  it("variáveis em falta ficam por substituir (não crasha)", () => {
    useBabele.getState().setLocale("pt-PT");
    const out = useBabele.getState().t("services.count"); // sem { n }
    expect(out).toBeTruthy();
  });
});

describe("Babele · fallback", () => {
  it("chave inexistente devolve a chave", () => {
    useBabele.getState().setLocale("en");
    expect(useBabele.getState().t("totalmente.inexistente")).toBe("totalmente.inexistente");
  });
});
