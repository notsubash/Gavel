import type { RunListItem } from "../api/types-helpers";
import { lineageCurrentScore, lineageScoreDelta } from "../confidence/confidence.ts";
/** View model for Phase 5 — lineage root is the workspace id until persistence lands. */
export type StartupWorkspace = {
  workspaceId: string;
  displayName: string;
  versionCount: number;
  currentScore: number | null;
  latestDelta: number | null;
  latestRunId: string;
  latestStatus: RunListItem["status"];
  lineage: RunListItem[];
};

export function deriveStartupWorkspace(lineage: RunListItem[]): StartupWorkspace {
  const root = lineage[0]!;
  const latest = lineage[lineage.length - 1]!;

  return {
    workspaceId: root.run_id,
    displayName: root.idea_preview,
    versionCount: lineage.length,
    currentScore: lineageCurrentScore(lineage),
    latestDelta: lineageScoreDelta(lineage),
    latestRunId: latest.run_id,
    latestStatus: latest.status,
    lineage,
  };
}
