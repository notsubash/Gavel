import { expect, type APIRequestContext, type Page } from "@playwright/test";

import { E2E_API_URL } from "./api";
import { createWorkspace, getReadiness, type WorkspaceDetailResponse } from "./workspace";

/** Workspace that fails structural readiness checks (too vague). */
export async function createIncompleteWorkspace(
  request: APIRequestContext,
): Promise<WorkspaceDetailResponse> {
  return createWorkspace(request, {
    worksheet: {
      working_name: `E2E Incomplete ${Date.now()}`,
      pricing_hypothesis: "",
      existing_evidence: "",
    },
  });
}

/** Workspace with human evidence so readiness reaches ready/speculative with all checks passing. */
export async function createLaunchReadyWorkspace(
  request: APIRequestContext,
): Promise<WorkspaceDetailResponse> {
  const detail = await createWorkspace(request, {
    worksheet: { working_name: `E2E Launch Ready ${Date.now()}` },
  });
  const response = await request.post(
    `${E2E_API_URL}/api/workspaces/${detail.workspace.id}/evidence`,
    {
      data: {
        type: "interview_quote",
        content:
          "Four founders confirmed they would pay for a validation workbench after their first roast.",
        strength: "moderate",
        source: "E2E fixture interview",
      },
    },
  );
  expect(response.status(), await response.text()).toBe(201);
  const readiness = await getReadiness(request, detail.workspace.id);
  expect(readiness.can_run_judges).toBe(true);
  return detail;
}

export async function openReadinessGate(page: Page, workspaceId: string): Promise<void> {
  await page.goto(`/workspaces/${workspaceId}/judges`);
  await page.getByRole("button", { name: "Start review" }).click();
  await expect(page.getByRole("dialog", { name: "Readiness gate" })).toBeVisible();
}

export async function launchFromGate(
  page: Page,
  options: { override?: boolean } = {},
): Promise<string> {
  if (options.override) {
    await page.getByLabel(/override readiness gate/i).check();
  }
  await page.getByRole("button", { name: "Start review" }).click();
  await expect(page).toHaveURL(/\/run\/[0-9a-f-]+$/);
  const match = page.url().match(/\/run\/([^/?#]+)/);
  expect(match?.[1]).toBeTruthy();
  return match![1];
}
