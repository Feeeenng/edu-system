import { defineConfig, devices } from "@playwright/test";

const e2ePort = Number(process.env.E2E_PORT ?? 3107);
const e2eBaseUrl = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${e2ePort}`;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  use: {
    baseURL: e2eBaseUrl,
    trace: "on-first-retry",
  },
  webServer: {
    command: `bun run dev -- --hostname 127.0.0.1 --port ${e2ePort}`,
    url: e2eBaseUrl,
    reuseExistingServer: process.env.PLAYWRIGHT_REUSE_SERVER === "1",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "large-desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 2560, height: 1440 } } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
