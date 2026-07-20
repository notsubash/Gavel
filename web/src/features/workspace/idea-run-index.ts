import type { RunListItem } from "@/lib/api/types-helpers";
import {
  deriveStartupWorkspace,
  type StartupWorkspace,
} from "@/lib/lineage/workspace";

function sortRunsForWorkspace(runs: RunListItem[]): RunListItem[] {
  return [...runs].sort((a, b) => {
    const versionDelta = (a.version ?? 0) - (b.version ?? 0);
    if (versionDelta !== 0) return versionDelta;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
}

/**
 * Map persisted workspace id → KPI view model for the Ideas list.
 * Groups by workspace_id (not parent lineage) so a truncated run feed still
 * attaches the newest run present for each idea.
 * ponytail: client join of listRuns; upgrade = score/delta on WorkspaceListItem API.
 */
export function indexRunsByWorkspaceId(
  runs: RunListItem[],
): Map<string, StartupWorkspace> {
  const byWorkspace = new Map<string, RunListItem[]>();
  for (const run of runs) {
    const workspaceId = run.workspace_id;
    if (!workspaceId) continue;
    const bucket = byWorkspace.get(workspaceId) ?? [];
    bucket.push(run);
    byWorkspace.set(workspaceId, bucket);
  }

  const map = new Map<string, StartupWorkspace>();
  for (const [workspaceId, bucket] of byWorkspace) {
    map.set(workspaceId, deriveStartupWorkspace(sortRunsForWorkspace(bucket)));
  }
  return map;
}
