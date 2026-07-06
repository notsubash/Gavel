import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadFrontendE2eEnv } from "./load-frontend-env.mjs";

const webDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const apiUrl = process.env.E2E_API_URL ?? "http://127.0.0.1:8000";

const env = {
  ...process.env,
  ...loadFrontendE2eEnv(),
  NEXT_PUBLIC_API_URL: apiUrl,
};

const result = spawnSync("npm", ["run", "build"], {
  cwd: webDir,
  env,
  stdio: "inherit",
  shell: true,
});

process.exit(result.status ?? 1);
