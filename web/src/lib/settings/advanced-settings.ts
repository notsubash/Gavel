import {
  DEFAULT_RUN_FOLD_VARIANT,
  parseFoldQueryParam,
  type RunFoldVariant,
} from "../../features/run/run-fold-layout.ts";

export const ADVANCED_SETTINGS_STORAGE_KEY = "rms-advanced-settings";

/** @deprecated Migrated into ADVANCED_SETTINGS_STORAGE_KEY */
const LEGACY_FOLD_STORAGE_KEY = "rms-run-fold-variant";

export type AdvancedSettings = {
  model_runtime: "local" | "deepseek";
  max_debate_rounds: number;
  enable_web_search: boolean;
  run_fold_variant: RunFoldVariant;
};

export const DEFAULT_ADVANCED_SETTINGS: AdvancedSettings = {
  model_runtime: "deepseek",
  max_debate_rounds: 3,
  enable_web_search: false,
  run_fold_variant: DEFAULT_RUN_FOLD_VARIANT,
};

function clampDebateRounds(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return DEFAULT_ADVANCED_SETTINGS.max_debate_rounds;
  return Math.min(5, Math.max(1, Math.round(n)));
}

function normalizeAdvancedSettings(raw: unknown): AdvancedSettings {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const runtime = obj.model_runtime === "local" ? "local" : "deepseek";
  const fold =
    parseFoldQueryParam(typeof obj.run_fold_variant === "string" ? obj.run_fold_variant : null) ??
    DEFAULT_RUN_FOLD_VARIANT;

  return {
    model_runtime: runtime,
    max_debate_rounds: clampDebateRounds(obj.max_debate_rounds),
    enable_web_search: Boolean(obj.enable_web_search),
    run_fold_variant: fold,
  };
}

export function readStoredFoldVariant(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ADVANCED_SETTINGS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { run_fold_variant?: string };
      if (parsed.run_fold_variant) return parsed.run_fold_variant;
    }
  } catch {
    // ponytail: corrupt storage falls through to legacy key / default
  }
  return localStorage.getItem(LEGACY_FOLD_STORAGE_KEY);
}

export { normalizeAdvancedSettings };

export function loadAdvancedSettings(): AdvancedSettings {
  if (typeof window === "undefined") return DEFAULT_ADVANCED_SETTINGS;
  try {
    const raw = localStorage.getItem(ADVANCED_SETTINGS_STORAGE_KEY);
    if (raw) return normalizeAdvancedSettings(JSON.parse(raw));
  } catch {
    // ignore
  }
  const legacyFold = localStorage.getItem(LEGACY_FOLD_STORAGE_KEY);
  if (legacyFold) {
    return {
      ...DEFAULT_ADVANCED_SETTINGS,
      run_fold_variant:
        parseFoldQueryParam(legacyFold) ?? DEFAULT_ADVANCED_SETTINGS.run_fold_variant,
    };
  }
  return DEFAULT_ADVANCED_SETTINGS;
}

export function saveAdvancedSettings(partial: Partial<AdvancedSettings>): AdvancedSettings {
  const next = normalizeAdvancedSettings({ ...loadAdvancedSettings(), ...partial });
  localStorage.setItem(ADVANCED_SETTINGS_STORAGE_KEY, JSON.stringify(next));
  localStorage.removeItem(LEGACY_FOLD_STORAGE_KEY);
  return next;
}
