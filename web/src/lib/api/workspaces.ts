import { apiClient } from "./client";
import type { WorksheetValues } from "@/features/worksheet/worksheet-schema";

export type WorkspaceLifecycle =
  | "draft"
  | "discovery"
  | "testing"
  | "evidence_ready"
  | "judged"
  | "iterating";

export type Assumption = {
  id: string;
  workspace_id: string;
  statement: string;
  type: string;
  status: string;
  confidence: number;
  disconfirming_criteria: string | null;
  worksheet_version_id: string | null;
  sort_order: number;
};

export type Workspace = {
  id: string;
  lifecycle: WorkspaceLifecycle;
  current_version_id: string | null;
  created_at: string;
  updated_at: string;
};

export type WorksheetVersion = {
  id: string;
  workspace_id: string;
  version: number;
  worksheet: WorksheetValues;
  generated_document: string;
  change_summary: string | null;
  parent_version_id: string | null;
  created_at: string;
};

export type WorkspaceListItem = {
  id: string;
  working_name: string;
  lifecycle: WorkspaceLifecycle;
  created_at: string;
  updated_at: string;
  assumption_count: number;
};

export type WorkspaceListResponse = {
  workspaces: WorkspaceListItem[];
  total: number;
  limit: number;
  offset: number;
};

export type WorkspaceDetailResponse = {
  workspace: Workspace;
  current_version: WorksheetVersion;
  assumptions: Assumption[];
};

export type DraftFromNotesResponse = {
  worksheet: WorksheetValues;
  ai_drafted_fields: string[];
};

export type ClarifyFieldResponse = {
  field_name: string;
  clarified_value: string;
};

export function workspacesQueryKey(params?: { limit?: number; offset?: number }) {
  return ["workspaces", params ?? {}] as const;
}

export function workspaceQueryKey(workspaceId: string) {
  return ["workspace", workspaceId] as const;
}

export async function listWorkspaces(params?: {
  limit?: number;
  offset?: number;
}): Promise<WorkspaceListResponse> {
  const search = new URLSearchParams();
  if (params?.limit != null) search.set("limit", String(params.limit));
  if (params?.offset != null) search.set("offset", String(params.offset));
  const qs = search.toString();
  return apiClient<WorkspaceListResponse>(`/api/workspaces${qs ? `?${qs}` : ""}`);
}

export async function getWorkspace(workspaceId: string): Promise<WorkspaceDetailResponse> {
  return apiClient<WorkspaceDetailResponse>(`/api/workspaces/${workspaceId}`);
}

export async function createWorkspace(body: {
  worksheet: WorksheetValues;
}): Promise<WorkspaceDetailResponse> {
  return apiClient<WorkspaceDetailResponse>("/api/workspaces", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function draftFromNotes(notes: string): Promise<DraftFromNotesResponse> {
  return apiClient<DraftFromNotesResponse>("/api/workspaces/draft-from-notes", {
    method: "POST",
    body: JSON.stringify({ notes }),
  });
}

export async function clarifyField(body: {
  field_name: string;
  current_value: string;
  worksheet_context?: WorksheetValues;
}): Promise<ClarifyFieldResponse> {
  return apiClient<ClarifyFieldResponse>("/api/workspaces/clarify-field", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
