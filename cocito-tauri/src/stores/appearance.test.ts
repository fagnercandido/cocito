/**
 * Purgatorio · store de aparência: troca de tema/modo/typography aplica
 * `data-*` attributes no <html>.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock do invoke do Tauri (não temos backend nos testes).
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(() => Promise.resolve({})),
}));

import { useAppearance, THEME_ORDER } from "./appearance";

describe("useAppearance", () => {
  beforeEach(() => {
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.removeAttribute("data-mode");
    document.documentElement.removeAttribute("data-typography");
  });

  it("setTheme aplica data-theme no <html>", async () => {
    await useAppearance.getState().setTheme("stige");
    expect(document.documentElement.getAttribute("data-theme")).toBe("stige");
  });

  it("setMode = 'auto' remove data-mode", async () => {
    await useAppearance.getState().setMode("dark");
    expect(document.documentElement.getAttribute("data-mode")).toBe("dark");
    await useAppearance.getState().setMode("auto");
    expect(document.documentElement.getAttribute("data-mode")).toBe(null);
  });

  it("setTypography aplica data-typography", async () => {
    await useAppearance.getState().setTypography("literaria");
    expect(document.documentElement.getAttribute("data-typography")).toBe("literaria");
  });

  it("THEME_ORDER tem 9 temas únicos", () => {
    expect(THEME_ORDER).toHaveLength(9);
    const set = new Set(THEME_ORDER);
    expect(set.size).toBe(9);
  });

  it("primeiro tema é cocito (default)", () => {
    expect(THEME_ORDER[0]).toBe("cocito");
  });
});
