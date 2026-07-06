import {
  configuredLocalModelName,
  DEFAULT_LOCAL_MODEL,
  ollamaHasModel,
} from "./model-runtime.mjs";

const ollamaHost = process.env.OLLAMA_HOST ?? "http://127.0.0.1:11434";

async function main() {
  const wanted = configuredLocalModelName();

  try {
    const response = await fetch(`${ollamaHost}/api/tags`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (response.ok) {
      const body = await response.json();
      const models = body.models ?? [];
      if (ollamaHasModel(models, wanted)) {
        console.log(`Ollama ready at ${ollamaHost} with model ${wanted}`);
        return;
      }
      if (models.length > 0) {
        console.error(
          `Ollama at ${ollamaHost} is running but ${wanted} is not pulled. ` +
            `Run: ollama pull ${wanted.split(":")[0]}`,
        );
        process.exit(1);
      }
      console.error(`Ollama at ${ollamaHost} has no pulled models`);
      process.exit(1);
    }
  } catch {
    // fall through to DeepSeek check
  }

  if (process.env.DEEPSEEK_API_KEY?.trim()) {
    console.log("DEEPSEEK_API_KEY is set — DeepSeek runtime available");
    return;
  }

  console.error(
    `No model runtime available for real-LLM E2E. ` +
      `Start Ollama with ${DEFAULT_LOCAL_MODEL} or set DEEPSEEK_API_KEY.`,
  );
  process.exit(1);
}

main();
