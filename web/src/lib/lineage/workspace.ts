import type { RunListItem } from "../api/types-helpers";
import { lineageCurrentScore, lineageScoreDelta } from "../confidence/confidence.ts";

/** View model for History. */
export type StartupWorkspace = {
  /** Stable row key (lineage root run id). */
  workspaceId: string;
  /** Real workspace id when the API provides it — never invent one from a run id. */
  persistedWorkspaceId: string | null;
  displayName: string;
  versionCount: number;
  currentScore: number | null;
  latestDelta: number | null;
  latestRunId: string;
  latestStatus: RunListItem["status"];
  lineage: RunListItem[];
  verdictSummary: RunListItem["verdict_summary"];
};

export function deriveStartupWorkspace(lineage: RunListItem[]): StartupWorkspace {
  const root = lineage[0]!;
  const latest = lineage[lineage.length - 1]!;
  const persistedWorkspaceId =
    latest.workspace_id ??
    [...lineage].reverse().find((run) => run.workspace_id)?.workspace_id ??
    null;

  return {
    workspaceId: root.run_id,
    persistedWorkspaceId,
    displayName: root.idea_preview,
    versionCount: lineage.length,
    currentScore: lineageCurrentScore(lineage),
    latestDelta: lineageScoreDelta(lineage),
    latestRunId: latest.run_id,
    latestStatus: latest.status,
    lineage,
    verdictSummary: latest.verdict_summary,
  };
}
