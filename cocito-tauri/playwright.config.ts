import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config para o Cocito.
 *
 * Os testes E2E correm contra o frontend Vite (sem janela Tauri nativa) —
 * suficiente para validar que UI principal renderiza, modais abrem/fecham,
 * focus trap funciona, atalhos de teclado pegam.
 *
 * Para testes que precisam do backend Rust (WebViews reais, partitions,
 * Cérbero IPC) há que correr `pnpm tauri:dev` à parte e fazer driver via
 * AppleScript / Accessibility API — fica para v1.4 quando houver CI Mac.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "list",
  use: {
    baseURL: "http://localhost:1420",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:1420",
    reuseExistingServer: !process.env.CI,
    stdout: "pipe",
    stderr: "pipe",
    timeout: 60_000,
  },
});
