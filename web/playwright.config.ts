import { defineConfig, devices } from "@playwright/test";

import {
  E2E_API_PORT,
  E2E_API_URL,
  E2E_BASE_URL,
  E2E_WEB_PORT,
  REPO_ROOT,
  backendE2eEnv,
  resolvePython,
} from "./e2e/env";

const python = resolvePython();

const backendCommand = `node e2e/reset-data.mjs && ${python} -m uvicorn api.app:app --app-dir ../src --host 127.0.0.1 --port ${E2E_API_PORT}`;

export default defineConfig({
  testDir: "./e2e/specs",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [["html", { open: "never", outputFolder: "playwright-report" }], ["list"]],
  use: {
    baseURL: E2E_BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    ...devices["Desktop Chrome"],
  },
  webServer: [
    {
      command: backendCommand,
      cwd: __dirname,
      url: `${E2E_API_URL}/health`,
      env: backendE2eEnv(),
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: "node e2e/start-web.mjs",
      cwd: __dirname,
      url: E2E_BASE_URL,
      env: {
        ...process.env,
        E2E_API_URL,
        E2E_WEB_PORT,
        E2E_WEB_MODE: process.env.E2E_WEB_MODE ?? "dev",
      },
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
