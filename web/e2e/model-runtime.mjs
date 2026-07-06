/** Default backend local model — keep in sync with `src/config.py`. */
export const DEFAULT_LOCAL_MODEL = "ollama:qwen3.5:9b";

export function configuredLocalModelName() {
  const raw = process.env.LOCAL_MODEL ?? DEFAULT_LOCAL_MODEL;
  return raw.replace(/^ollama:/, "").replace(/:latest$/, "");
}

/** Ollama tag names omit the `ollama:` prefix and may include `:latest`. */
export function ollamaHasModel(models, wanted) {
  const base = wanted.replace(/:latest$/, "");
  const baseRoot = base.split(":")[0];
  return models.some((model) => {
    const name = model.name.replace(/:latest$/, "");
    return name === base || name.startsWith(`${baseRoot}:`) || name === baseRoot;
  });
}
