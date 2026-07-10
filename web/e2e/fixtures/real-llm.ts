import { env as nodeEnv } from "node:process";

/** Matches `src/api/e2e_test_support.py` — absent when the real pipeline runs. */
export const E2E_STUB_MARKER = "E2E stub verdict";

const DEFAULT_LOCAL_MODEL = "ollama:qwen3.5:9b";

function configuredLocalModelName(): string {
  const raw = nodeEnv.LOCAL_MODEL ?? DEFAULT_LOCAL_MODEL;
  return raw.replace(/^ollama:/, "").replace(/:latest$/, "");
}

function ollamaHasModel(models: Array<{ name: string }>, wanted: string): boolean {
  const base = wanted.replace(/:latest$/, "");
  const baseRoot = base.split(":")[0];
  return models.some((model) => {
    const name = model.name.replace(/:latest$/, "");
    return name === base || name.startsWith(`${baseRoot}:`) || name === baseRoot;
  });
}

export type ModelRuntime = "local" | "deepseek";

export type ModelProbeResult =
  | { available: true; runtime: ModelRuntime; detail: string; localModel?: string }
  | { available: false; reason: string };

/** Probe Ollama or DeepSeek credentials before launching a real roast run. */
export async function probeModelRuntime(): Promise<ModelProbeResult> {
  if (nodeEnv.E2E_REAL_LLM !== "true") {
    return { available: false, reason: "Set E2E_REAL_LLM=true to run @real-llm tests" };
  }

  const ollamaHost = nodeEnv.OLLAMA_HOST ?? "http://127.0.0.1:11434";
  const wanted = configuredLocalModelName();

  try {
    const response = await fetch(`${ollamaHost}/api/tags`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (response.ok) {
      const body = (await response.json()) as { models?: Array<{ name: string }> };
      const models = body.models ?? [];
      if (ollamaHasModel(models, wanted)) {
        return {
          available: true,
          runtime: "local",
          detail: `Ollama at ${ollamaHost} with ${wanted}`,
          localModel: wanted,
        };
      }
      if (models.length > 0) {
        return {
          available: false,
          reason: `Ollama at ${ollamaHost} is running but ${wanted} is not pulled`,
        };
      }
      return { available: false, reason: `Ollama at ${ollamaHost} has no pulled models` };
    }
  } catch {
    // ponytail: try DeepSeek only when local Ollama is unreachable
  }

  if (nodeEnv.DEEPSEEK_API_KEY?.trim()) {
    return { available: true, runtime: "deepseek", detail: "DEEPSEEK_API_KEY is set" };
  }

  return {
    available: false,
    reason:
      "No model runtime available — start Ollama with the configured LOCAL_MODEL or set DEEPSEEK_API_KEY",
  };
}

/**
 * Pin advanced settings for a fast real integration run.
 * Writes localStorage directly — avoids brittle Select option label matching.
 */
export async function configureRealRunSettings(
  page: import("@playwright/test").Page,
  runtime: ModelRuntime,
): Promise<void> {
  await page.goto("/settings");
  await page.evaluate((modelRuntime) => {
    const key = "rms-advanced-settings";
    const raw = localStorage.getItem(key);
    const current = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    localStorage.setItem(
      key,
      JSON.stringify({
        ...current,
        model_runtime: modelRuntime,
        max_debate_rounds: 1,
        enable_web_search: false,
      }),
    );
  }, runtime);
  // Reload so the settings page (and later launch) read the pinned values.
  await page.reload();
}
