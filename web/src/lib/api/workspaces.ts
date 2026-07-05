import { apiClient, ApiError, getApiBaseUrl } from "./client";
import type { WorksheetValues } from "@/features/worksheet/worksheet-schema";

export type WorkspaceLifecycle =
  | "draft"
  | "discovery"
  | "testing"
  | "evidence_ready"
  | "judged"
  | "iterating";

export type AssumptionStatus =
  | "untested"
  | "testing"
  | "supported"
  | "contradicted"
  | "retired";

export type Assumption = {
  id: string;
  workspace_id: string;
  statement: string;
  type: string;
  status: AssumptionStatus;
  confidence: number;
  disconfirming_criteria: string | null;
  worksheet_version_id: string | null;
  sort_order: number;
};

export type Experiment = {
  id: string;
  workspace_id: string;
  title: string;
  hypothesis: string;
  assumption_id: string | null;
  method: string | null;
  target: string | null;
  pass_fail_threshold: string | null;
  start_date: string | null;
  due_date: string | null;
  result: string | null;
  decision: string;
  status: "planned" | "active" | "completed";
  worksheet_version_id: string | null;
};

export type Evidence = {
  id: string;
  workspace_id: string;
  type: string;
  strength: "weak" | "moderate" | "strong";
  source: string | null;
  content: string;
  occurred_at: string | null;
  assumption_ids: string[];
  experiment_id: string | null;
  worksheet_version_id: string | null;
};

export type WorksheetFieldChange = {
  field: string;
  label: string;
  before: string;
  after: string;
  is_core: boolean;
};

export type WorksheetFieldPatch = {
  field_name: string;
  suggested_value: string;
  rationale: string;
};

export type CreateWorksheetVersionResponse = {
  version: WorksheetVersion;
  created: boolean;
  diff: WorksheetFieldChange[];
};

export type WorksheetVersionDiffResponse = {
  from_version_id: string;
  to_version_id: string;
  changes: WorksheetFieldChange[];
  change_summary: string | null;
};

export type InterviewNote = {
  id: string;
  workspace_id: string;
  person_label: string;
  segment: string | null;
  occurred_at: string | null;
  context: string | null;
  notes: string;
  quotes: string[];
  workaround: string | null;
  pain_cost: string | null;
  objections: string | null;
  assumption_ids: string[];
  ai_summary: string | null;
};

export type ValidationStage =
  | "problem_clarity"
  | "problem_evidence"
  | "solution_evidence"
  | "willingness_to_pay"
  | "channel"
  | "competition_moat";

export type ChecklistItem = {
  stage: ValidationStage;
  label: string;
  completed: boolean;
  completed_at: string | null;
  auto_completed: boolean;
};

export type ConfidenceChip = {
  dimension: "demand" | "pricing" | "competition" | "moat";
  label: string;
  drivers: string[];
};

export type ValidationOverview = {
  checklist: {
    items: ChecklistItem[];
    next_action: string;
    next_stage: ValidationStage | null;
  };
  confidence: { chips: ConfidenceChip[] };
  readiness: {
    level: "too_vague" | "speculative" | "ready";
    checks: { name: string; passed: boolean; detail: string | null }[];
    can_run_judges: boolean;
  };
  active_experiment: Experiment | null;
  top_assumptions: Assumption[];
};

export type InterviewQuestion = {
  question: string;
  rationale: string;
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

export function worksheetVersionsQueryKey(workspaceId: string) {
  return ["worksheet-versions", workspaceId] as const;
}

export function validationOverviewQueryKey(workspaceId: string) {
  return ["workspace-overview", workspaceId] as const;
}

export function validationDataQueryKey(workspaceId: string) {
  return ["validation-data", workspaceId] as const;
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

export async function getValidationOverview(workspaceId: string): Promise<ValidationOverview> {
  return apiClient<ValidationOverview>(`/api/workspaces/${workspaceId}/overview`);
}

export async function createWorkspace(body: {
  worksheet: WorksheetValues;
}): Promise<WorkspaceDetailResponse> {
  return apiClient<WorkspaceDetailResponse>("/api/workspaces", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function persistAssumptions(
  workspaceId: string,
  assumptions: Assumption[],
): Promise<{ assumptions: Assumption[] }> {
  return apiClient(`/api/workspaces/${workspaceId}/assumptions/bulk`, {
    method: "POST",
    body: JSON.stringify({ assumptions }),
  });
}

export async function listAssumptions(workspaceId: string): Promise<Assumption[]> {
  return apiClient<Assumption[]>(`/api/workspaces/${workspaceId}/assumptions`);
}

export async function createAssumption(
  workspaceId: string,
  body: { statement: string; type?: string; disconfirming_criteria?: string | null },
): Promise<Assumption> {
  return apiClient<Assumption>(`/api/workspaces/${workspaceId}/assumptions`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateAssumption(
  workspaceId: string,
  assumptionId: string,
  body: Partial<Pick<Assumption, "statement" | "type" | "status" | "confidence">>,
): Promise<Assumption> {
  return apiClient<Assumption>(`/api/workspaces/${workspaceId}/assumptions/${assumptionId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function listExperiments(workspaceId: string): Promise<Experiment[]> {
  return apiClient<Experiment[]>(`/api/workspaces/${workspaceId}/experiments`);
}

export async function createExperiment(
  workspaceId: string,
  body: Omit<Experiment, "id" | "workspace_id" | "result" | "decision" | "worksheet_version_id">,
): Promise<Experiment> {
  return apiClient<Experiment>(`/api/workspaces/${workspaceId}/experiments`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateExperiment(
  workspaceId: string,
  experimentId: string,
  body: Partial<Experiment>,
): Promise<Experiment> {
  return apiClient<Experiment>(`/api/workspaces/${workspaceId}/experiments/${experimentId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function listEvidence(workspaceId: string): Promise<Evidence[]> {
  return apiClient<Evidence[]>(`/api/workspaces/${workspaceId}/evidence`);
}

export async function createEvidence(
  workspaceId: string,
  body: Omit<Evidence, "id" | "workspace_id" | "worksheet_version_id">,
): Promise<Evidence> {
  return apiClient<Evidence>(`/api/workspaces/${workspaceId}/evidence`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function listInterviews(workspaceId: string): Promise<InterviewNote[]> {
  return apiClient<InterviewNote[]>(`/api/workspaces/${workspaceId}/interviews`);
}

export async function createInterview(
  workspaceId: string,
  body: Omit<InterviewNote, "id" | "workspace_id">,
): Promise<InterviewNote> {
  return apiClient<InterviewNote>(`/api/workspaces/${workspaceId}/interviews`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function suggestInterviewQuestions(
  workspaceId: string,
  assumptionId?: string,
): Promise<{ questions: InterviewQuestion[] }> {
  return apiClient(`/api/workspaces/${workspaceId}/assist/suggest-interview-questions`, {
    method: "POST",
    body: JSON.stringify({ assumption_id: assumptionId ?? null }),
  });
}

export async function suggestExperiment(
  workspaceId: string,
  body?: { assumption_id?: string; checklist_stage?: ValidationStage },
): Promise<{ experiment: Omit<Experiment, "id" | "workspace_id" | "result" | "decision" | "worksheet_version_id"> }> {
  return apiClient(`/api/workspaces/${workspaceId}/assist/suggest-experiment`, {
    method: "POST",
    body: JSON.stringify(body ?? {}),
  });
}

export async function summarizeInterview(
  workspaceId: string,
  body: { notes: string; person_label?: string; segment?: string },
): Promise<{
  summary: string;
  extracted_quotes: string[];
  suggested_assumption_ids: string[];
}> {
  return apiClient(`/api/workspaces/${workspaceId}/assist/summarize-interview`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function mapEvidence(
  workspaceId: string,
  body: { content: string; type: string; assumption_ids?: string[] },
): Promise<{ suggested_assumption_ids: string[]; rationale: string | null }> {
  return apiClient(`/api/workspaces/${workspaceId}/assist/map-evidence`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function validationCoach(
  workspaceId: string,
): Promise<{ narrative: string; suggested_actions: string[]; focus_stage: ValidationStage | null }> {
  return apiClient(`/api/workspaces/${workspaceId}/assist/validation-coach`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function listWorksheetVersions(workspaceId: string): Promise<WorksheetVersion[]> {
  return apiClient<WorksheetVersion[]>(`/api/workspaces/${workspaceId}/versions`);
}

export async function getWorksheetVersion(
  workspaceId: string,
  versionId: string,
): Promise<WorksheetVersion> {
  return apiClient<WorksheetVersion>(`/api/workspaces/${workspaceId}/versions/${versionId}`);
}

export async function getWorksheetVersionDiff(
  workspaceId: string,
  versionId: string,
  compareTo?: string,
): Promise<WorksheetVersionDiffResponse> {
  const qs = compareTo ? `?compare_to=${encodeURIComponent(compareTo)}` : "";
  return apiClient<WorksheetVersionDiffResponse>(
    `/api/workspaces/${workspaceId}/versions/${versionId}/diff${qs}`,
  );
}

export async function saveWorksheetVersion(
  workspaceId: string,
  body: {
    worksheet: WorksheetValues;
    minor_edit?: boolean;
    change_summary?: string | null;
    base_version_id?: string | null;
  },
): Promise<CreateWorksheetVersionResponse> {
  return apiClient<CreateWorksheetVersionResponse>(`/api/workspaces/${workspaceId}/versions`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function reviseFromEvidence(
  workspaceId: string,
  experimentId?: string,
): Promise<{ patches: WorksheetFieldPatch[]; summary: string }> {
  return apiClient(`/api/workspaces/${workspaceId}/assist/revise-from-evidence`, {
    method: "POST",
    body: JSON.stringify({ experiment_id: experimentId ?? null }),
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

export type ReadinessCheck = {
  name: string;
  passed: boolean;
  detail: string | null;
};

export type ReadinessResponse = {
  level: "too_vague" | "speculative" | "ready";
  checks: ReadinessCheck[];
  can_run_judges: boolean;
};

export type RunHandoffItem = {
  kind: "assumption" | "evidence_target" | "experiment";
  title: string;
  detail: string;
  source_judge: string | null;
};

export type RunHandoffResponse = {
  run_id: string;
  workspace_id: string;
  items: RunHandoffItem[];
};

export async function getReadiness(workspaceId: string): Promise<ReadinessResponse> {
  return apiClient<ReadinessResponse>(`/api/workspaces/${workspaceId}/readiness`);
}

export async function readinessBriefing(
  workspaceId: string,
): Promise<{ briefing: string }> {
  return apiClient(`/api/workspaces/${workspaceId}/assist/readiness-briefing`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function listWorkspaceRuns(
  workspaceId: string,
  params?: { limit?: number; offset?: number },
): Promise<{
  runs: Array<{
    run_id: string;
    status: string;
    idea_preview: string;
    created_at: string;
    workspace_id: string | null;
    worksheet_version_id: string | null;
    version: number;
    parent_run_id: string | null;
    verdict_summary: Record<string, unknown> | null;
  }>;
  total: number;
  limit: number;
  offset: number;
}> {
  const search = new URLSearchParams();
  if (params?.limit != null) search.set("limit", String(params.limit));
  if (params?.offset != null) search.set("offset", String(params.offset));
  const qs = search.toString();
  return apiClient(`/api/workspaces/${workspaceId}/runs${qs ? `?${qs}` : ""}`);
}

export async function getRunHandoff(runId: string): Promise<RunHandoffResponse> {
  return apiClient<RunHandoffResponse>(`/api/runs/${runId}/handoff`);
}

export type WeeklyReviewResponse = {
  summary: string;
  highlights: string[];
  open_questions: string[];
  period_days: number;
  evidence_count: number;
};

export type CompetitorScanResponse = {
  query: string | null;
  findings: Array<{ title: string; url: string; snippet: string }>;
  suggested_evidence: string;
  available: boolean;
};

export async function seedSampleWorkspace(): Promise<WorkspaceDetailResponse> {
  return apiClient<WorkspaceDetailResponse>("/api/workspaces/seed-sample", {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function weeklyReview(workspaceId: string): Promise<WeeklyReviewResponse> {
  return apiClient<WeeklyReviewResponse>(
    `/api/workspaces/${workspaceId}/assist/weekly-review`,
    { method: "POST", body: JSON.stringify({}) },
  );
}

export async function competitorScan(workspaceId: string): Promise<CompetitorScanResponse> {
  return apiClient<CompetitorScanResponse>(
    `/api/workspaces/${workspaceId}/assist/competitor-scan`,
    { method: "POST", body: JSON.stringify({}) },
  );
}

function exportSlug(name: string): string {
  const slug = name.trim().replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "");
  return (slug || "workspace").slice(0, 80);
}

async function downloadTextExport(path: string, fallbackName: string): Promise<void> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}${path}`);
  if (!res.ok) {
    const body = await res.text();
    throw new ApiError(res.status, body);
  }
  const text = await res.text();
  const disposition = res.headers.get("content-disposition") ?? "";
  const match = disposition.match(/filename="([^"]+)"/);
  const filename = match?.[1] ?? fallbackName;
  const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function exportWorkspaceMarkdown(workspaceId: string, workingName: string) {
  const slug = exportSlug(workingName);
  return downloadTextExport(
    `/api/workspaces/${workspaceId}/export/markdown`,
    `${slug}-export.md`,
  );
}

export function exportJudgeBrief(workspaceId: string, workingName: string) {
  const slug = exportSlug(workingName);
  return downloadTextExport(
    `/api/workspaces/${workspaceId}/export/judge-brief`,
    `${slug}-judge-brief.md`,
  );
}

export const CONFIDENCE_DISPLAY: Record<string, string> = {
  unknown: "Unknown",
  weak: "Weak",
  some_signal: "Some signal",
  strong: "Strong",
  interest: "Interest",
  commitment: "Commitment",
  mapped: "Mapped",
  switching_clear: "Switching clear",
  claimed: "Claimed",
  evidence_backed: "Evidence-backed",
};

export const ASSUMPTION_COLUMNS: AssumptionStatus[] = [
  "untested",
  "testing",
  "supported",
  "contradicted",
  "retired",
];
