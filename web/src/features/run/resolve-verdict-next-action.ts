import type { OverallRecommendation } from "./structured-synthesis.ts";
import { RUN_PAGE_COPY } from "./run-page-copy.ts";

export type VerdictNextAction = {
  /** Primary CTA kind for the completed-run fork. */
  kind: "submit_evidence" | "revise_pitch" | "view_evidence" | "open_review";
  label: string;
  href: string;
  /** When true, Run page should open the evidence modal instead of navigating. */
  useModal?: boolean;
};

export type VerdictSummaryCounts = {
  pass: number;
  fail: number;
  conditional: number;
};

/** Count PASS / FAIL / CONDITIONAL from panel verdict objects. */
export function countVerdictLabels(
  verdicts: Array<{ verdict?: string } | null | undefined>,
): VerdictSummaryCounts {
  const counts: VerdictSummaryCounts = { pass: 0, fail: 0, conditional: 0 };
  for (const raw of verdicts) {
    if (!raw || typeof raw !== "object") continue;
    const label = String(raw.verdict ?? "").toUpperCase();
    if (label === "PASS") counts.pass += 1;
    else if (label === "FAIL") counts.fail += 1;
    else if (label === "CONDITIONAL") counts.conditional += 1;
  }
  return counts;
}

/**
 * Infer GO / ITERATE / NO-GO when moderator structured output is missing.
 * pass > fail → GO (conditionals allowed — matches common moderator GO panels).
 */
export function inferRecommendationFromVerdictSummary(
  summary: VerdictSummaryCounts | null | undefined,
): OverallRecommendation {
  if (!summary) return "ITERATE";
  const { pass, fail, conditional } = summary;
  const total = pass + fail + conditional;
  if (total === 0) return "ITERATE";
  if (fail > pass && fail >= conditional) return "NO-GO";
  if (pass > fail) return "GO";
  return "ITERATE";
}

export function revisePitchHref(workspaceId: string | null | undefined, runId: string): string {
  if (workspaceId) return `/workspaces/${workspaceId}/worksheet?revise=1`;
  return `/run/${runId}#next-actions-strip`;
}

/**
 * One primary next action after a completed review.
 * GO / NO-GO → Revise pitch (or Open review if no workspace). ITERATE → Submit evidence.
 */
export function resolveVerdictNextAction(input: {
  runId: string;
  workspaceId?: string | null;
  recommendation?: OverallRecommendation | null;
  verdictSummary?: VerdictSummaryCounts | null;
  evidenceSubmitted?: boolean;
}): VerdictNextAction {
  const recommendation =
    input.recommendation ?? inferRecommendationFromVerdictSummary(input.verdictSummary);

  if (input.evidenceSubmitted) {
    return {
      kind: "view_evidence",
      label: RUN_PAGE_COPY.viewEvidenceResult,
      href: `/run/${input.runId}#appeal-result-heading`,
    };
  }

  if (recommendation === "ITERATE") {
    return {
      kind: "submit_evidence",
      label: RUN_PAGE_COPY.submitEvidence,
      href: `/run/${input.runId}#next-actions-strip`,
      useModal: true,
    };
  }

  if (input.workspaceId) {
    return {
      kind: "revise_pitch",
      label: RUN_PAGE_COPY.revisePitch,
      href: revisePitchHref(input.workspaceId, input.runId),
    };
  }

  // No workspace id — don't mislabel a scroll-to-self link as "Revise pitch".
  return {
    kind: "open_review",
    label: RUN_PAGE_COPY.openReview,
    href: `/run/${input.runId}#next-actions-strip`,
  };
}
