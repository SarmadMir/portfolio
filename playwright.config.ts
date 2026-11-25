import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end checks of the runtime, against the PRODUCTION build:
 *   npm run build && npm run e2e
 * Port 3100 is the QA port (never 3001). A server already on it fails the run
 * rather than being reused, so the specs never test a stale build.
 */
const PORT = Number(process.env.E2E_PORT ?? 3100);
if (PORT === 3001) throw new Error("Port 3001 belongs to the Input2PDF dev server. Set E2E_PORT to another port.");

export default defineConfig({
  testDir: "tests/e2e",
  outputDir: "test-results",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
