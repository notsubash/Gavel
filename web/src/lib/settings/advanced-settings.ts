export const ADVANCED_SETTINGS_STORAGE_KEY = "rms-advanced-settings";

/** @deprecated Fold preference removed — workflow-first is the only default. */
const LEGACY_FOLD_STORAGE_KEY = "rms-run-fold-variant";

export type AdvancedSettings = {
  model_runtime: "local" | "deepseek";
  max_debate_rounds: number;
  enable_web_search: boolean;
};

export const DEFAULT_ADVANCED_SETTINGS: AdvancedSettings = {
  model_runtime: "deepseek",
  max_debate_rounds: 3,
  enable_web_search: false,
};

function clampDebateRounds(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return DEFAULT_ADVANCED_SETTINGS.max_debate_rounds;
  return Math.min(5, Math.max(1, Math.round(n)));
}

export function normalizeAdvancedSettings(raw: unknown): AdvancedSettings {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const runtime = obj.model_runtime === "local" ? "local" : "deepseek";

  return {
    model_runtime: runtime,
    max_debate_rounds: clampDebateRounds(obj.max_debate_rounds),
    enable_web_search: Boolean(obj.enable_web_search),
  };
}

export function loadAdvancedSettings(): AdvancedSettings {
  if (typeof window === "undefined") return DEFAULT_ADVANCED_SETTINGS;
  try {
    const raw = localStorage.getItem(ADVANCED_SETTINGS_STORAGE_KEY);
    if (raw) return normalizeAdvancedSettings(JSON.parse(raw));
  } catch {
    // ignore
  }
  return DEFAULT_ADVANCED_SETTINGS;
}

export function saveAdvancedSettings(partial: Partial<AdvancedSettings>): AdvancedSettings {
  const next = normalizeAdvancedSettings({ ...loadAdvancedSettings(), ...partial });
  localStorage.setItem(ADVANCED_SETTINGS_STORAGE_KEY, JSON.stringify(next));
  // Drop legacy fold key so old "Judges first" prefs can't resurrect.
  localStorage.removeItem(LEGACY_FOLD_STORAGE_KEY);
  return next;
}
