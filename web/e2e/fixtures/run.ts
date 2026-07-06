import { expect, type APIRequestContext, type Page } from "@playwright/test";

import { E2E_API_URL } from "./api";

export type RunStatus = "created" | "running" | "completed" | "failed" | "cancelled";

export type CreateRunResponse = {
  run_id: string;
  status: string;
};

type CreateStubRunOptions = {
  readinessOverride?: boolean;
  parentRunId?: string;
  worksheetVersionId?: string;
};

/**
 * Launch a judge run via API.
 *
 * Phase 6 adds `E2E_TEST_MODE` so this returns quickly without real LLM calls.
 * Until then, calling this in default E2E will start the real pipeline — avoid in CI smoke.
 */
export async function createStubRun(
  request: APIRequestContext,
  workspaceId: string,
  options: CreateStubRunOptions = {},
): Promise<CreateRunResponse> {
  const response = await request.post(`${E2E_API_URL}/api/runs`, {
    data: {
      workspace_id: workspaceId,
      readiness_override: options.readinessOverride ?? false,
      ...(options.parentRunId ? { parent_run_id: options.parentRunId } : {}),
      ...(options.worksheetVersionId
        ? { worksheet_version_id: options.worksheetVersionId }
        : {}),
    },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.json() as Promise<CreateRunResponse>;
}

const TERMINAL_COPY: Record<RunStatus, RegExp> = {
  completed: /Run complete/i,
  failed: /Run failed/i,
  cancelled: /Run cancelled/i,
  created: /./,
  running: /./,
};

/** Wait for a visible terminal banner on `/run/{runId}` (no arbitrary sleeps). */
export async function waitForRunTerminalState(
  page: Page,
  expectedStatus: Extract<RunStatus, "completed" | "failed" | "cancelled">,
  timeoutMs = 120_000,
): Promise<void> {
  await expect(page.getByText(TERMINAL_COPY[expectedStatus])).toBeVisible({ timeout: timeoutMs });
}
