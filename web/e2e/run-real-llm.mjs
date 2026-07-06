import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const webDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

process.env.E2E_REAL_LLM = "true";

const child = spawn("npx", ["playwright", "test", "--grep", "@real-llm"], {
  cwd: webDir,
  env: process.env,
  stdio: "inherit",
  shell: true,
});

child.on("exit", (code) => process.exit(code ?? 0));
