import { expect, type APIRequestContext, type Page } from "@playwright/test";

import { E2E_API_URL } from "./api";

export type Assumption = {
  id: string;
  statement: string;
  status: string;
};

export type ValidationOverview = {
  checklist: {
    next_action: string;
    items: Array<{ stage: string; label: string; completed: boolean }>;
  };
  confidence: { chips: Array<{ dimension: string; label: string }> };
};

export async function getWorkspaceDetail(
  request: APIRequestContext,
  workspaceId: string,
): Promise<{
  workspace: { id: string };
  current_version: { id: string; version: number; worksheet: Record<string, unknown> };
}> {
  const response = await request.get(`${E2E_API_URL}/api/workspaces/${workspaceId}`);
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.json();
}

export async function getValidationOverview(
  request: APIRequestContext,
  workspaceId: string,
): Promise<ValidationOverview> {
  const response = await request.get(`${E2E_API_URL}/api/workspaces/${workspaceId}/overview`);
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.json();
}

export async function createAssumption(
  request: APIRequestContext,
  workspaceId: string,
  body: { statement: string; type?: string },
): Promise<Assumption> {
  const response = await request.post(`${E2E_API_URL}/api/workspaces/${workspaceId}/assumptions`, {
    data: body,
  });
  expect(response.status(), await response.text()).toBe(201);
  return response.json();
}

export async function updateAssumption(
  request: APIRequestContext,
  workspaceId: string,
  assumptionId: string,
  body: { statement?: string; status?: string },
): Promise<Assumption> {
  const response = await request.patch(
    `${E2E_API_URL}/api/workspaces/${workspaceId}/assumptions/${assumptionId}`,
    { data: body },
  );
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.json();
}

export async function deleteAssumption(
  request: APIRequestContext,
  workspaceId: string,
  assumptionId: string,
): Promise<void> {
  const response = await request.delete(
    `${E2E_API_URL}/api/workspaces/${workspaceId}/assumptions/${assumptionId}`,
  );
  expect(response.status()).toBe(204);
}

export async function createExperiment(
  request: APIRequestContext,
  workspaceId: string,
  body: {
    title: string;
    hypothesis: string;
    pass_fail_threshold: string;
    status?: string;
    method?: string;
    target?: string;
  },
): Promise<{ id: string; title: string; status: string }> {
  const response = await request.post(`${E2E_API_URL}/api/workspaces/${workspaceId}/experiments`, {
    data: {
      status: "planned",
      method: "Landing page smoke test with 50 targeted visitors.",
      target: "Solo founders in early validation stage.",
      ...body,
    },
  });
  expect(response.status(), await response.text()).toBe(201);
  return response.json();
}

export async function listAssumptions(
  request: APIRequestContext,
  workspaceId: string,
): Promise<Assumption[]> {
  const response = await request.get(`${E2E_API_URL}/api/workspaces/${workspaceId}/assumptions`);
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.json();
}

export type WorksheetVersionSummary = { id: string; version: number };

export type WorksheetVersionDiff = {
  changes: Array<{ field: string; before: string; after: string; label: string }>;
};

export async function listWorksheetVersions(
  request: APIRequestContext,
  workspaceId: string,
): Promise<WorksheetVersionSummary[]> {
  const response = await request.get(`${E2E_API_URL}/api/workspaces/${workspaceId}/versions`);
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.json();
}

export async function getWorksheetVersionDiff(
  request: APIRequestContext,
  workspaceId: string,
  versionId: string,
): Promise<WorksheetVersionDiff> {
  const response = await request.get(
    `${E2E_API_URL}/api/workspaces/${workspaceId}/versions/${versionId}/diff`,
  );
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.json();
}

/** Phase 2: primary may be the only visible action; others live under Add… */
export async function clickValidationAction(page: Page, name: string | RegExp) {
  const button = page.getByRole("button", { name });
  if (await button.isVisible()) {
    await button.click();
    return;
  }
  await page.locator("summary").filter({ hasText: "Add…" }).click();
  await page.getByRole("button", { name }).click();
}
