/** Section keys for the decision-first run fold (Feature 1). */
export type RunFoldSection =
  | "decision"
  | "version"
  | "judges"
  | "appeal"
  | "transcript"
  | "context";

/** A = panel before version deltas; B = version deltas before full panel (roadmap winner). */
export type RunFoldVariant = "panel-first" | "iterate-first";

/** @deprecated Use ADVANCED_SETTINGS_STORAGE_KEY via advanced-settings.ts */
export const RUN_FOLD_STORAGE_KEY = "rms-run-fold-variant";

/** Default after local A/B validation — matches proposed IA (coach brief before panel). */
export const DEFAULT_RUN_FOLD_VARIANT: RunFoldVariant = "iterate-first";

export const RUN_FOLD_SECTION_LABELS: Record<RunFoldSection, string> = {
  decision: "Decision and next steps",
  version: "Version comparison (vs your last roast)",
  judges: "Full roast panel (all five judges)",
  appeal: "Appeal a verdict",
  transcript: "Debate transcript (collapsed)",
  context: "Context: sources, metrics, related roasts (collapsed)",
};

export const RUN_FOLD_VARIANTS: Record<
  RunFoldVariant,
  {
    label: string;
    queryFlag: "a" | "b";
    summary: string;
    bestFor: string;
  }
> = {
  "panel-first": {
    label: "Scores first",
    queryFlag: "a",
    summary:
      "Read every judge's score and roast before checking whether this version improved on the last one.",
    bestFor: "Best when you care about the raw panel verdict before iteration context.",
  },
  "iterate-first": {
    label: "Progress first",
    queryFlag: "b",
    summary:
      "See decision and version deltas before scrolling through all five judge cards.",
    bestFor: "Best when you are refining a pitch and want proof of progress up front.",
  },
};

export const RUN_FOLD_ORDERS: Record<RunFoldVariant, RunFoldSection[]> = {
  "panel-first": ["decision", "judges", "version", "appeal", "transcript", "context"],
  "iterate-first": ["decision", "version", "judges", "appeal", "transcript", "context"],
};

export function formatFoldSectionOrder(variant: RunFoldVariant): string[] {
  return RUN_FOLD_ORDERS[variant].map((section) => RUN_FOLD_SECTION_LABELS[section]);
}

const QUERY_TO_VARIANT: Record<string, RunFoldVariant> = {
  a: "panel-first",
  b: "iterate-first",
  "panel-first": "panel-first",
  "iterate-first": "iterate-first",
};

export function parseFoldQueryParam(value: string | null | undefined): RunFoldVariant | null {
  if (!value) return null;
  return QUERY_TO_VARIANT[value.toLowerCase()] ?? null;
}

export function foldVariantToQueryFlag(variant: RunFoldVariant): "a" | "b" {
  return RUN_FOLD_VARIANTS[variant].queryFlag;
}

export function resolveRunFoldVariant(
  queryParam: string | null | undefined,
  stored: string | null | undefined,
): RunFoldVariant {
  return (
    parseFoldQueryParam(queryParam) ??
    parseFoldQueryParam(stored) ??
    DEFAULT_RUN_FOLD_VARIANT
  );
}
