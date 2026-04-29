/**
 * Smoke tests do Cocito (frontend-only).
 *
 * Não testam Tauri commands reais — usam o Vite dev server. Para isto,
 * mockamos o `window.__TAURI_INTERNALS__` para `invoke` devolver shapes
 * vazias (cmd_get_config = config default, cmd_list_services = []).
 */

import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    // Mock mínimo do Tauri IPC.
    (window as any).__TAURI_INTERNALS__ = {
      invoke: async (cmd: string) => {
        if (cmd === "cmd_get_config") {
          return {
            appearance: { theme: "cocito", mode: null, typography: "sobria" },
            instances: [],
            activeInstance: null,
            scriptorium: { vaultPath: null },
            virgilio: { retentionDays: 90, encryptionEnabled: false },
            beatriz: { ollamaUrl: null, allowSelfSignedTls: false },
          };
        }
        if (cmd === "cmd_list_services") return [];
        if (cmd === "cmd_messo_hosts") return [];
        if (cmd === "cmd_rules_active_count") return 0;
        return null;
      },
    };
  });
});

test("janela carrega e mostra empty state", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Nenhuma bolgia/i })).toBeVisible({
    timeout: 10_000,
  });
});

test("⌘, abre modal de Preferências", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Nenhuma bolgia/i })).toBeVisible();
  await page.keyboard.press("Meta+,");
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5_000 });
  await expect(page.getByText(/Preferências/i).first()).toBeVisible();
});

test("Escape fecha modal de Preferências", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Nenhuma bolgia/i })).toBeVisible();
  await page.keyboard.press("Meta+,");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden({ timeout: 3_000 });
});

test("⌘5 troca para tema Stige", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector("body");
  await page.keyboard.press("Meta+5");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "stige", {
    timeout: 3_000,
  });
});
