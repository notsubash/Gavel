import type { JudgeId, Verdict } from "../sse/types.ts";
import {
  collectRecommendedFixes,
  parseDecisionVerdictProse,
  parseStructuredSynthesis,
} from "../../features/run/structured-synthesis.ts";

export type ExperimentStatus =
  | "suggested"
  | "in_progress"
  | "submitted"
  | "reviewed";

export interface Experiment {
  experimentId: string;
  title: string;
  audience: string;
  questions: string[];
  effortMinutes: number;
  status: ExperimentStatus;
  hypothesis: string;
  sourceJudge: JudgeId | null;
}

export interface ExperimentCompletionContext {
  changedAssumption: string;
  artifactLinks: string[];
}

export function experimentIdForRun(runId: string): string {
  return `exp-${runId.slice(0, 8)}`;
}

function legacyExperimentFromVerdicts(
  runId: string,
  verdicts: Verdict[],
  status: ExperimentStatus,
): Experiment | null {
  const fixes = collectRecommendedFixes(verdicts);
  const primaryFix = fixes[0]?.trim();
  if (!primaryFix) return null;

  const source =
    verdicts.find((verdict) => verdict.recommended_fix?.trim() === primaryFix) ??
    verdicts.find((verdict) => verdict.verdict !== "PASS") ??
    null;

  return {
    experimentId: experimentIdForRun(runId),
    title: primaryFix,
    audience: "Your target customer segment",
    questions: [
      "What is the smallest test that could invalidate the panel's top concern?",
      "What did you learn that you did not know before running it?",
      "What metric or artifact would convince a skeptical buyer?",
    ],
    effortMinutes: 120,
    status,
    hypothesis: source?.key_concern?.trim()
      ? `Test whether: ${source.key_concern.trim()}`
      : "Validate the panel's top concern with primary research.",
    sourceJudge: source?.judge ?? null,
  };
}

/** Read experiment from moderator structured output; legacy verdict fallback only. */
export function deriveExperiment(
  runId: string,
  synthesisProse: string | null,
  structuredSynthesis: unknown,
  verdicts: Verdict[],
  status: ExperimentStatus = "suggested",
): Experiment {
  const structured =
    parseStructuredSynthesis(structuredSynthesis) ??
    (synthesisProse ? parseDecisionVerdictProse(synthesisProse) : null);

  const fromModerator = structured?.recommended_experiment;
  if (fromModerator) {
    return {
      experimentId: experimentIdForRun(runId),
      title: fromModerator.title,
      audience: fromModerator.audience,
      questions: fromModerator.questions,
      effortMinutes: fromModerator.effort_minutes,
      status,
      hypothesis: fromModerator.hypothesis,
      sourceJudge: null,
    };
  }

  const legacy = legacyExperimentFromVerdicts(runId, verdicts, status);
  if (legacy) return legacy;

  return {
    experimentId: experimentIdForRun(runId),
    title: "Run customer discovery on the panel's top concern",
    audience: "5–10 people in your target segment",
    questions: [
      "What workflow pain do they rank in their top three, unprompted?",
      "Have they tried alternatives? What failed?",
      "Would they pay for a solution, and how much?",
    ],
    effortMinutes: 120,
    status,
    hypothesis: "The core risk assumed by the panel can be tested quickly.",
    sourceJudge: null,
  };
}

/** Legacy one-liner when experiment entity flag is off. */
export function formatExperimentLegacy(experiment: Experiment): string {
  return `${experiment.title} (~${experiment.effortMinutes} min with ${experiment.audience})`;
}

export function experimentSummaryLine(experiment: Experiment): string {
  return experiment.title;
}

export function resolveExperimentStatus(
  experiment: Experiment,
  options: { hasAppeal: boolean; storedStatus?: ExperimentStatus | null },
): Experiment {
  if (options.hasAppeal) return { ...experiment, status: "reviewed" };
  if (options.storedStatus) return { ...experiment, status: options.storedStatus };
  return experiment;
}

export function nextExperimentStatus(
  current: ExperimentStatus,
  event: "start" | "submit",
): ExperimentStatus {
  if (event === "start" && current === "suggested") return "in_progress";
  if (event === "submit" && (current === "suggested" || current === "in_progress")) {
    return "submitted";
  }
  return current;
}

export function formatEffort(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round((minutes / 60) * 10) / 10;
  return hours === 1 ? "1 hour" : `${hours} hours`;
}

export const EXPERIMENT_STATUS_LABELS: Record<ExperimentStatus, string> = {
  suggested: "Suggested",
  in_progress: "In progress",
  submitted: "Submitted",
  reviewed: "Reviewed",
};
