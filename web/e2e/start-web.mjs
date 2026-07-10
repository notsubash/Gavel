import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
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
  PORT: port,
  HOSTNAME: "127.0.0.1",
};

function run(cmd, args, { shell = true, cwd = webDir } = {}) {
  const child = spawn(cmd, args, { cwd, env, stdio: "inherit", shell });
  child.on("exit", (code) => process.exit(code ?? 0));
  return child;
}

if (process.env.E2E_WEB_MODE === "start") {
  if (process.env.E2E_SKIP_BUILD !== "true") {
    const build = spawnSync("npm", ["run", "build"], {
      cwd: webDir,
      env,
      stdio: "inherit",
      shell: true,
    });
    if (build.status !== 0) process.exit(build.status ?? 1);
  }

  // next.config uses output: "standalone" — next start warns and is unsupported;
  // run the standalone server the same way the Dockerfile does.
  const standaloneServer = path.join(webDir, ".next", "standalone", "server.js");
  if (!fs.existsSync(standaloneServer)) {
    console.error(
      `Missing ${standaloneServer}. Run npm run build (or build:e2e) before E2E_WEB_MODE=start.`,
    );
    process.exit(1);
  }

  // Standalone server expects static assets next to itself (Docker copies them in).
  const standaloneStatic = path.join(webDir, ".next", "standalone", ".next", "static");
  const buildStatic = path.join(webDir, ".next", "static");
  if (!fs.existsSync(standaloneStatic) && fs.existsSync(buildStatic)) {
    fs.cpSync(buildStatic, standaloneStatic, { recursive: true });
  }
  const standalonePublic = path.join(webDir, ".next", "standalone", "public");
  const buildPublic = path.join(webDir, "public");
  if (!fs.existsSync(standalonePublic) && fs.existsSync(buildPublic)) {
    fs.cpSync(buildPublic, standalonePublic, { recursive: true });
  }

  run(process.execPath, ["server.js"], {
    shell: false,
    cwd: path.join(webDir, ".next", "standalone"),
  });
} else {
  run("npm", ["run", "dev", "--", "--hostname", "127.0.0.1", "--port", port]);
}
