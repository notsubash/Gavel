import type { components } from "./types";

export type RunPanelResponse = components["schemas"]["RunPanelResponse"] & {
  confidence_snapshot?: Record<string, unknown> | null;
};

export type AppealResponse = components["schemas"]["AppealResponse"] & {
  revised_structured_synthesis?: Record<string, unknown> | null;
  confidence_before_after?: Record<string, unknown> | null;
  experiment_context?: {
    experiment_id?: string | null;
    status?: "submitted" | "reviewed";
    changed_assumption?: string | null;
    artifact_links?: string[];
  } | null;
};

export type AppealRequest = components["schemas"]["AppealRequest"] & {
  experiment_context?: {
    experiment_id?: string;
    changed_assumption?: string;
    artifact_links?: string[];
  };
};

export type CreateRunRequest = {
  workspace_id: string;
  worksheet_version_id?: string | null;
  model_runtime?: "local" | "deepseek";
  execution_flow?: "deterministic";
  max_debate_rounds?: number;
  enable_web_search?: boolean;
  parent_run_id?: string | null;
  readiness_override?: boolean;
  version?: number;
};

export type RunStatusResponse = components["schemas"]["RunStatusResponse"] & {
  workspace_id?: string | null;
  worksheet_version_id?: string | null;
  working_name?: string | null;
};
export type RunCreatedResponse = components["schemas"]["RunCreatedResponse"];
export type RunListResponse = components["schemas"]["RunListResponse"];
export type RunListItem = components["schemas"]["RunListItem"];
export type VerdictSummary = components["schemas"]["VerdictSummary"];
export type SimilarRunsResponse = components["schemas"]["SimilarRunsResponse"];
export type SimilarRunItem = components["schemas"]["SimilarRunItem"];

export type ApiRunStatus = RunStatusResponse["status"];

/** Mirror ``src/api/schemas.py`` appeal bounds (OpenAPI does not emit min/max). */
export const APPEAL_MIN_LENGTH = 10;
export const APPEAL_MAX_LENGTH = 4000;

export const RATE_LIMIT_MESSAGE =
  "Too many run requests. Please try again shortly.";

export const APPEAL_RATE_LIMIT_MESSAGE =
  "Too many appeal requests. Please try again shortly.";

export function parseApiDetail(body: string): string | null {
  try {
    const parsed = JSON.parse(body) as { detail?: unknown };
    if (typeof parsed.detail === "string") return parsed.detail;
    if (Array.isArray(parsed.detail)) {
      const first = parsed.detail[0] as { msg?: string } | undefined;
      return first?.msg ?? null;
    }
  } catch {
    /* ponytail: body wasn't JSON */
  }
  return null;
}
