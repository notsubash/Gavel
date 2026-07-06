import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const e2eDataDir = path.join(repoRoot, ".e2e-data");

fs.rmSync(e2eDataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
fs.mkdirSync(e2eDataDir, { recursive: true });

console.log(`[e2e] reset ${e2eDataDir}`);
