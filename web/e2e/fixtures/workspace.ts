import { expect, type APIRequestContext } from "@playwright/test";

import { E2E_API_URL } from "./api";

/** Mirrors `validation.fixtures.SAMPLE_WORKSHEET` for stable API fixtures. */
export type IdeaWorksheet = {
  working_name: string;
  audience: string;
  problem_statement: string;
  current_workaround: string;
  solution_statement: string;
  secret_sauce: string;
  pricing_hypothesis: string;
  existing_evidence: string;
  competitors: string[];
  top_risky_assumption: string;
  disconfirming_evidence: string;
};

export const SAMPLE_WORKSHEET: IdeaWorksheet = {
  working_name: "Validation OS",
  audience: "Solo technical founders building paid SaaS before they have revenue.",
  problem_statement: "have trouble proving buyer demand before they build.",
  current_workaround: "They use Notion docs, ChatGPT, and spreadsheets.",
  solution_statement:
    "I am developing a local-first founder workbench to help solo founders " +
    "turn startup ideas into validation experiments.",
  secret_sauce: "Five harsh AI judges plus a persistent evidence ledger.",
  pricing_hypothesis: "$19 to $49 one-time self-hosted license.",
  existing_evidence: "Three founders asked for a validation template.",
  competitors: ["ChatGPT", "Notion templates", "Doing nothing"],
  top_risky_assumption: "Solo founders will return weekly to update validation evidence.",
  disconfirming_evidence: "Five founders say ChatGPT plus Notion is enough.",
};

export type WorkspaceDetailResponse = {
  workspace: { id: string; lifecycle: string };
  current_version: { id: string; worksheet: IdeaWorksheet };
  assumptions: Array<{ id: string; statement: string }>;
};

export type ReadinessResponse = {
  level: string;
  can_run_judges: boolean;
  checks: Array<{ id: string; passed: boolean; label: string }>;
};

type CreateWorkspaceOptions = {
  worksheet?: Partial<IdeaWorksheet>;
};

/** Create a workspace via API (setup helper — not the behavior under test). */
export async function createWorkspace(
  request: APIRequestContext,
  overrides: CreateWorkspaceOptions = {},
): Promise<WorkspaceDetailResponse> {
  const worksheet = { ...SAMPLE_WORKSHEET, ...overrides.worksheet };
  const response = await request.post(`${E2E_API_URL}/api/workspaces`, {
    data: { worksheet },
  });
  expect(response.status(), await response.text()).toBe(201);
  return response.json() as Promise<WorkspaceDetailResponse>;
}

/** Load the bundled demo workspace (`POST /api/workspaces/seed-sample`). */
export async function seedSampleWorkspace(
  request: APIRequestContext,
): Promise<WorkspaceDetailResponse> {
  const response = await request.post(`${E2E_API_URL}/api/workspaces/seed-sample`);
  expect(response.status(), await response.text()).toBe(201);
  return response.json() as Promise<WorkspaceDetailResponse>;
}

/** Fetch deterministic readiness gate state for a workspace. */
export async function getReadiness(
  request: APIRequestContext,
  workspaceId: string,
): Promise<ReadinessResponse> {
  const response = await request.get(`${E2E_API_URL}/api/workspaces/${workspaceId}/readiness`);
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.json() as Promise<ReadinessResponse>;
}

export type WorkspaceListResponse = {
  total: number;
  workspaces: Array<{ id: string; working_name: string }>;
};

/** List workspaces via API (setup/assertion helper). */
export async function listWorkspaces(request: APIRequestContext): Promise<WorkspaceListResponse> {
  const response = await request.get(`${E2E_API_URL}/api/workspaces`);
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.json() as Promise<WorkspaceListResponse>;
}
