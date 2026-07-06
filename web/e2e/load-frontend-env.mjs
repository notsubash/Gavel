import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const webDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Parse `web/.env.e2e` into a plain key/value map. */
export function loadFrontendE2eEnv() {
  const parsed = {};
  const envFile = path.join(webDir, ".env.e2e");
  if (!fs.existsSync(envFile)) return parsed;
  for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    parsed[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
  }
  return parsed;
}
