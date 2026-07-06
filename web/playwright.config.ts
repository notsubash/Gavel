import { defineConfig, devices } from "@playwright/test";

import {
  E2E_API_PORT,
  E2E_API_URL,
  E2E_BASE_URL,
  E2E_CI_TIER,
  E2E_REAL_LLM,
  E2E_WEB_PORT,
  backendE2eEnv,
  resolvePython,
} from "./e2e/env";

const python = resolvePython();
const isCi = !!process.env.CI;

const backendCommand = `node e2e/reset-data.mjs && ${python} -m uvicorn api.app:app --app-dir ../src --host 127.0.0.1 --port ${E2E_API_PORT}`;

export default defineConfig({
  testDir: "./e2e/specs",
  fullyParallel: false,
  workers: 1,
  forbidOnly: isCi,
  retries: isCi ? 2 : 0,
  timeout: E2E_REAL_LLM ? 300_000 : 60_000,
  grep: E2E_REAL_LLM ? /@real-llm/ : E2E_CI_TIER === "pr" ? /@core/ : undefined,
  grepInvert: E2E_REAL_LLM ? undefined : /@real-llm/,
  reporter: isCi
    ? [
        ["html", { open: "never", outputFolder: "playwright-report" }],
        ["github"],
        ["list"],
      ]
    : [["html", { open: "never", outputFolder: "playwright-report" }], ["list"]],
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
      env: { ...process.env, ...backendE2eEnv() } as Record<string, string>,
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
        E2E_WEB_MODE: process.env.E2E_WEB_MODE ?? (isCi ? "start" : "dev"),
        ...(process.env.E2E_SKIP_BUILD || isCi ? { E2E_SKIP_BUILD: process.env.E2E_SKIP_BUILD ?? "true" } : {}),
      },
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
