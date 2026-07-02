/** Phase 5 rollback — set NEXT_PUBLIC_WORKSPACE_HISTORY=false to restore card lineage list. */
export function isWorkspaceHistoryEnabled(): boolean {
  return process.env.NEXT_PUBLIC_WORKSPACE_HISTORY !== "false";
}
