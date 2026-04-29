/**
 * Purgatorio · Babele i18n.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { useBabele } from "./index";

describe("useBabele", () => {
  beforeEach(() => {
    useBabele.getState().setLocale("pt-PT");
  });

  it("traduz por chave conhecida", () => {
    const t = useBabele.getState().t;
    expect(t("prefs.title")).toBe("Preferências");
  });

  it("muda quando setLocale altera", () => {
    useBabele.getState().setLocale("en");
    expect(useBabele.getState().t("prefs.title")).toBe("Preferences");
  });

  it("interpola variáveis", () => {
    const t = useBabele.getState().t;
    const out = t("services.count", { n: 3 });
    expect(out).toContain("3");
  });

  it("devolve a chave quando não conhece", () => {
    const t = useBabele.getState().t;
    expect(t("nao.existe")).toBe("nao.existe");
  });
});
