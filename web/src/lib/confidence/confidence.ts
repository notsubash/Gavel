import type { RunListItem } from "../api/types-helpers";
import type { JudgeId, Verdict } from "../sse/types";

export const CONFIDENCE_DIMENSIONS = [
  "demand",
  "pricing",
  "competition",
  "moat",
] as const;

export type ConfidenceDimension = (typeof CONFIDENCE_DIMENSIONS)[number];

export type ConfidenceTier = "Low" | "Medium" | "High";

export type ConfidenceDimensionScore = {
  dimension: ConfidenceDimension;
  label: string;
  value: number;
  tier: ConfidenceTier;
  driver: string | null;
  nextAction: string | null;
};

export type ConfidenceSnapshot = {
  dimensions: ConfidenceDimensionScore[];
  weakest: ConfidenceDimension | null;
  source: "llm" | "deterministic";
};

export const DIMENSION_LABELS: Record<ConfidenceDimension, string> = {
  demand: "Demand",
  pricing: "Pricing",
  competition: "Competition",
  moat: "Moat",
};

/** ponytail: fixed judge→dimension map; fallback only when LLM snapshot missing. */
const DIMENSION_JUDGES: Record<ConfidenceDimension, JudgeId[]> = {
  demand: ["pm", "customer"],
  pricing: ["customer"],
  competition: ["competitor"],
  moat: ["vc", "engineer"],
};

export function confidenceTier(value: number): ConfidenceTier {
  if (value < 40) return "Low";
  if (value < 70) return "Medium";
  return "High";
}

function isConfidenceDimension(value: unknown): value is ConfidenceDimension {
  return (
    typeof value === "string" &&
    (CONFIDENCE_DIMENSIONS as readonly string[]).includes(value)
  );
}

function normalizeDimensionScore(raw: unknown): ConfidenceDimensionScore | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  const dimension = item.dimension;
  const value = item.value;
  if (!isConfidenceDimension(dimension) || typeof value !== "number") return null;
  const driver = typeof item.driver === "string" ? item.driver.trim() : null;
  const nextAction =
    typeof item.next_action === "string"
      ? item.next_action.trim()
      : typeof item.nextAction === "string"
        ? item.nextAction.trim()
        : null;
  return {
    dimension,
    label: DIMENSION_LABELS[dimension],
    value: Math.min(100, Math.max(0, Math.round(value))),
    tier: confidenceTier(value),
    driver: driver || null,
    nextAction: nextAction || null,
  };
}

export function parseConfidenceSnapshot(raw: unknown): ConfidenceSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  const dimensions = Array.isArray(data.dimensions)
    ? data.dimensions
        .map(normalizeDimensionScore)
        .filter((item): item is ConfidenceDimensionScore => item !== null)
    : [];
  if (dimensions.length === 0) return null;
  const weakestRaw = data.weakest;
  const weakest = isConfidenceDimension(weakestRaw)
    ? weakestRaw
    : [...dimensions].sort((left, right) => left.value - right.value)[0]!.dimension;
  const source = data.source === "deterministic" ? "deterministic" : "llm";
  return { dimensions, weakest, source };
}

export function parseConfidenceFromStructuredSynthesis(
  structuredSynthesis: unknown,
): ConfidenceSnapshot | null {
  if (!structuredSynthesis || typeof structuredSynthesis !== "object") return null;
  const dimensions = (structuredSynthesis as Record<string, unknown>).confidence_dimensions;
  if (!Array.isArray(dimensions)) return null;
  const parsed = dimensions
    .map(normalizeDimensionScore)
    .filter((item): item is ConfidenceDimensionScore => item !== null);
  if (parsed.length !== 4) return null;
  const weakest = [...parsed].sort((left, right) => left.value - right.value)[0]!.dimension;
  return { dimensions: parsed, weakest, source: "llm" };
}

function judgesForDimension(
  verdicts: Verdict[],
  judges: JudgeId[],
): Verdict[] {
  return judges
    .map((id) => verdicts.find((verdict) => verdict.judge === id))
    .filter((verdict): verdict is Verdict => verdict !== undefined);
}

function dimensionValue(judges: Verdict[]): number | null {
  if (judges.length === 0) return null;
  const avg = judges.reduce((sum, verdict) => sum + verdict.score, 0) / judges.length;
  return Math.round(avg * 10);
}

function dimensionDriver(judges: Verdict[]): string | null {
  if (judges.length === 0) return null;
  const weakest = [...judges].sort((left, right) => left.score - right.score)[0]!;
  const concern = weakest.key_concern.trim();
  return concern || null;
}

/** Deterministic fallback when moderator dimensions are unavailable. */
export function computeConfidenceFromVerdicts(verdicts: Verdict[]): ConfidenceSnapshot | null {
  if (verdicts.length === 0) return null;

  const dimensions = CONFIDENCE_DIMENSIONS.flatMap((dimension) => {
    const judges = judgesForDimension(verdicts, DIMENSION_JUDGES[dimension]);
    const value = dimensionValue(judges);
    if (value == null) return [];
    return [
      {
        dimension,
        label: DIMENSION_LABELS[dimension],
        value,
        tier: confidenceTier(value),
        driver: dimensionDriver(judges),
        nextAction: null,
      },
    ];
  });

  if (dimensions.length === 0) return null;

  const weakest = [...dimensions].sort((left, right) => left.value - right.value)[0]!.dimension;

  return { dimensions, weakest, source: "deterministic" };
}

export function resolveConfidenceSnapshot(input: {
  structuredSynthesis?: unknown;
  snapshot?: unknown;
  verdicts?: Verdict[];
  allowDeterministicFallback?: boolean;
}): ConfidenceSnapshot | null {
  const fromApi = parseConfidenceSnapshot(input.snapshot);
  if (fromApi) return fromApi;
  const fromStructured = parseConfidenceFromStructuredSynthesis(input.structuredSynthesis);
  if (fromStructured) return fromStructured;
  if (input.allowDeterministicFallback === false) return null;
  if (!input.verdicts?.length) return null;
  return computeConfidenceFromVerdicts(input.verdicts);
}

export function weakestDimensionAction(snapshot: ConfidenceSnapshot): string | null {
  if (!snapshot.weakest) return null;
  const item = snapshot.dimensions.find((entry) => entry.dimension === snapshot.weakest);
  return item?.nextAction ?? item?.driver ?? null;
}

export function parseConfidenceMovement(raw: unknown): {
  before: ConfidenceSnapshot | null;
  after: ConfidenceSnapshot | null;
} | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  return {
    before: parseConfidenceSnapshot(data.before),
    after: parseConfidenceSnapshot(data.after),
  };
}

export function confidenceDelta(
  before: ConfidenceSnapshot | null,
  after: ConfidenceSnapshot | null,
): Partial<Record<ConfidenceDimension, number>> {
  if (!before || !after) return {};
  const delta: Partial<Record<ConfidenceDimension, number>> = {};
  for (const dimension of CONFIDENCE_DIMENSIONS) {
    const prior = before.dimensions.find((item) => item.dimension === dimension)?.value;
    const next = after.dimensions.find((item) => item.dimension === dimension)?.value;
    if (prior == null || next == null) continue;
    const change = next - prior;
    if (change !== 0) delta[dimension] = change;
  }
  return delta;
}

/** Score delta between the two latest completed versions in a lineage. */
export function lineageScoreDelta(lineage: RunListItem[]): number | null {
  const completed = lineage.filter(
    (run) => run.status === "completed" && run.verdict_summary?.avg_score != null,
  );
  if (completed.length < 2) return null;
  const latest = completed[completed.length - 1]!;
  const prior = completed[completed.length - 2]!;
  const latestScore = latest.verdict_summary!.avg_score!;
  const priorScore = prior.verdict_summary!.avg_score!;
  return Math.round((latestScore - priorScore) * 10) / 10;
}

export function lineageCurrentScore(lineage: RunListItem[]): number | null {
  for (let index = lineage.length - 1; index >= 0; index -= 1) {
    const run = lineage[index]!;
    const avg = run.verdict_summary?.avg_score;
    if (run.status === "completed" && avg != null) return avg;
  }
  return null;
}
