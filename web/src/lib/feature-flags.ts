/** Phase 5 rollback — set NEXT_PUBLIC_WORKSPACE_HISTORY=false to restore card lineage list. */
export function isWorkspaceHistoryEnabled(): boolean {
  return process.env.NEXT_PUBLIC_WORKSPACE_HISTORY !== "false";
}

/** Phase 6 rollback — set NEXT_PUBLIC_CONFIDENCE_ENGINE=false to hide confidence module. */
export function isConfidenceEngineEnabled(): boolean {
  return process.env.NEXT_PUBLIC_CONFIDENCE_ENGINE !== "false";
}

/** Phase 7 rollback — set NEXT_PUBLIC_EXPERIMENT_ENTITY=false for plain-text experiment. */
export function isExperimentEntityEnabled(): boolean {
  return process.env.NEXT_PUBLIC_EXPERIMENT_ENTITY !== "false";
}
