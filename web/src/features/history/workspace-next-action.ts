import type { RunListItem } from "../../lib/api/types-helpers";
import { parseVerdict } from "../../lib/lineage/lineage.ts";
import { deriveWorkflowBrief } from "../run/structured-synthesis.ts";
import { HISTORY_COPY, RUN_PAGE_COPY } from "../run/run-page-copy.ts";

export type WorkspaceNextAction = {
  label: string;
  href: string;
  /** Full experiment copy for tooltip — not shown inline in the row. */
  detail?: string;
};

/** Status-only fallback when panel data is unavailable. */
export function deriveNextActionFromStatus(
  run: Pick<RunListItem, "run_id" | "status">,
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
    default:
      return {
        label: RUN_PAGE_COPY.completeExperiment,
        href: `${href}#next-actions-strip`,
      };
  }
}

/** Match run page `#next-actions-strip` — uses workflow experiment, not raw judge fix. */
export function deriveNextActionFromPanel(
  runId: string,
  status: RunListItem["status"],
  panelVerdicts: unknown[],
  synthesisProse: string | null = null,
  structuredSynthesis: unknown = null,
): WorkspaceNextAction {
  if (status !== "completed") {
    return deriveNextActionFromStatus({ run_id: runId, status });
  }

  const verdicts = panelVerdicts
    .map(parseVerdict)
    .filter((verdict): verdict is NonNullable<ReturnType<typeof parseVerdict>> => verdict !== null);

  const { experiment } = deriveWorkflowBrief(synthesisProse, structuredSynthesis, verdicts);
  const detail = experiment.trim();
  if (detail) {
    return {
      label: RUN_PAGE_COPY.completeExperiment,
      href: `/run/${runId}#next-actions-strip`,
      detail,
    };
  }

  return deriveNextActionFromStatus({ run_id: runId, status });
}
