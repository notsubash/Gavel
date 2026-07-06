import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadFrontendE2eEnv } from "./load-frontend-env.mjs";

const webDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const apiUrl = process.env.E2E_API_URL ?? "http://127.0.0.1:8000";
const port = process.env.E2E_WEB_PORT ?? "3000";

const env = {
  ...process.env,
  ...loadFrontendE2eEnv(),
  NEXT_PUBLIC_API_URL: apiUrl,
};

function run(cmd, args) {
  const child = spawn(cmd, args, { cwd: webDir, env, stdio: "inherit", shell: true });
  child.on("exit", (code) => process.exit(code ?? 0));
  return child;
}

if (process.env.E2E_WEB_MODE === "start") {
  const build = spawnSync("npm", ["run", "build"], { cwd: webDir, env, stdio: "inherit", shell: true });
  if (build.status !== 0) process.exit(build.status ?? 1);
  run("npm", ["run", "start", "--", "--hostname", "127.0.0.1", "--port", port]);
} else {
  run("npm", ["run", "dev", "--", "--hostname", "127.0.0.1", "--port", port]);
}
