import fs from "node:fs";
import path from "node:path";

/** Repo root (parent of `web/`). */
export const REPO_ROOT = path.resolve(__dirname, "../..");

/** Isolated SQLite directory — wiped by `reset-data.mjs` before the API server starts. */
export const E2E_DATA_DIR = path.join(REPO_ROOT, ".e2e-data");

export const E2E_WEB_PORT = process.env.E2E_WEB_PORT ?? "3000";
export const E2E_API_PORT = process.env.E2E_API_PORT ?? "8000";

export const E2E_BASE_URL =
  process.env.E2E_BASE_URL ?? `http://127.0.0.1:${E2E_WEB_PORT}`;
export const E2E_API_URL = process.env.E2E_API_URL ?? `http://127.0.0.1:${E2E_API_PORT}`;

export function resolvePython(): string {
  const win = path.join(REPO_ROOT, ".venv", "Scripts", "python.exe");
  const unix = path.join(REPO_ROOT, ".venv", "bin", "python");
  if (fs.existsSync(win)) return win;
  if (fs.existsSync(unix)) return unix;
  return process.platform === "win32" ? "python" : "python3";
}

/** When true, backend uses the real pipeline (no stub). Requires model credentials or Ollama. */
export const E2E_REAL_LLM = process.env.E2E_REAL_LLM === "true";

/** `pr` = smoke + core flows only; `full` = entire deterministic suite (default in CI on main). */
export const E2E_CI_TIER = process.env.E2E_CI_TIER ?? "full";

/** Backend env passed to the Playwright API webServer subprocess. */
export function backendE2eEnv(): Record<string, string> {
  const webPort = process.env.E2E_WEB_PORT ?? "3000";
  const env: Record<string, string> = {
    PYTHONPATH: path.join(REPO_ROOT, "src"),
    RUNS_DB_PATH: path.join(E2E_DATA_DIR, "runs.db"),
    WORKSPACES_DB_PATH: path.join(E2E_DATA_DIR, "workspaces.db"),
    IDEAS_DB_PATH: path.join(E2E_DATA_DIR, "ideas.db"),
    RATE_LIMIT_ENABLED: "false",
    ENABLE_WEB_SEARCH: "false",
    ENABLE_SEMANTIC_MEMORY: "false",
    ROAST_CORS_ORIGINS: `http://127.0.0.1:${webPort},http://localhost:${webPort}`,
  };

  if (E2E_REAL_LLM) {
    env.E2E_TEST_MODE = "false";
    env.MAX_RUN_SECONDS = process.env.E2E_MAX_RUN_SECONDS ?? "300";
    env.MAX_DEBATE_ROUNDS = "1";
    if (process.env.DEEPSEEK_API_KEY) {
      env.DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
    }
    if (process.env.LOCAL_MODEL) {
      env.LOCAL_MODEL = process.env.LOCAL_MODEL;
    }
  } else {
    env.E2E_TEST_MODE = "true";
    env.MAX_RUN_SECONDS = "30";
  }

  return env;
}
