import type { RunListItem } from "../../lib/api/types-helpers";
import { HISTORY_COPY } from "../run/run-page-copy.ts";
import {
  countVerdictLabels,
  resolveVerdictNextAction,
  type VerdictSummaryCounts,
} from "../run/resolve-verdict-next-action.ts";

export type WorkspaceNextAction = {
  label: string;
  href: string;
  detail?: string;
};

function summaryFromRun(
  run: Pick<RunListItem, "verdict_summary">,
): VerdictSummaryCounts | null {
  const summary = run.verdict_summary;
  if (!summary) return null;
  return {
    pass: summary.pass ?? 0,
    fail: summary.fail ?? 0,
    conditional: summary.conditional ?? 0,
  };
}

/** Completed History rows deep-link to Run's CTA strip — Run owns the fork. */
function historyHrefForCompleted(runId: string, action: { kind: string; href: string }): string {
  if (action.kind === "view_evidence") return action.href;
  return `/run/${runId}#next-actions-strip`;
}

/** Status-only fallback when panel data is unavailable. */
export function deriveNextActionFromStatus(
  run: Pick<RunListItem, "run_id" | "status" | "verdict_summary" | "workspace_id">,
): WorkspaceNextAction {
  const href = `/run/${run.run_id}`;

  switch (run.status) {
    case "running":
    case "created":
      return { label: HISTORY_COPY.nextActionOpenReview, href };
    case "failed":
      return { label: HISTORY_COPY.nextActionViewFailed, href };
    case "cancelled":
      return { label: HISTORY_COPY.nextActionViewCancelled, href };
    case "completed":
    default: {
      const action = resolveVerdictNextAction({
        runId: run.run_id,
        workspaceId: run.workspace_id,
        verdictSummary: summaryFromRun(run),
      });
      return {
        label: action.label,
        href: historyHrefForCompleted(run.run_id, action),
      };
    }
  }
}

/** Panel path — counts judge labels when list summary is missing. */
export function deriveNextActionFromPanel(
  runId: string,
  status: RunListItem["status"],
  panelVerdicts: unknown[],
  options?: {
    workspaceId?: string | null;
    verdictSummary?: VerdictSummaryCounts | null;
    evidenceSubmitted?: boolean;
  },
): WorkspaceNextAction {
  if (status !== "completed") {
    return deriveNextActionFromStatus({ run_id: runId, status });
  }

  const counts =
    options?.verdictSummary ??
    countVerdictLabels(panelVerdicts as Array<{ verdict?: string }>);

  const action = resolveVerdictNextAction({
    runId,
    workspaceId: options?.workspaceId,
    verdictSummary: counts,
    evidenceSubmitted: options?.evidenceSubmitted,
  });

  return {
    label: action.label,
    href: historyHrefForCompleted(runId, action),
  };
}
