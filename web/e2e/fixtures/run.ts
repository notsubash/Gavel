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
  modelRuntime?: "local" | "deepseek";
  maxDebateRounds?: number;
  enableWebSearch?: boolean;
};

export type RunStatusResponse = {
  run_id: string;
  status: RunStatus;
  idea_preview: string;
  workspace_id?: string | null;
  version?: number;
};

/**
 * Launch a judge run via API.
 *
 * Requires backend `E2E_TEST_MODE=true` (set in Playwright webServer env).
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
      ...(options.modelRuntime ? { model_runtime: options.modelRuntime } : {}),
      ...(options.maxDebateRounds != null
        ? { max_debate_rounds: options.maxDebateRounds }
        : {}),
      ...(options.enableWebSearch != null
        ? { enable_web_search: options.enableWebSearch }
        : {}),
    },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.json() as Promise<CreateRunResponse>;
}

export async function getRunStatus(
  request: APIRequestContext,
  runId: string,
): Promise<RunStatusResponse> {
  const response = await request.get(`${E2E_API_URL}/api/runs/${runId}`);
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.json() as Promise<RunStatusResponse>;
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
  timeoutMs = 60_000,
): Promise<void> {
  await expect(page.getByText(TERMINAL_COPY[expectedStatus]).first()).toBeVisible({
    timeout: timeoutMs,
  });
}

/** Wait until the phase rail shows a step as current or completed. */
export async function waitForRunPhase(
  page: Page,
  phaseLabel: "Review" | "Debate" | "Synthesis",
  timeoutMs = 60_000,
): Promise<void> {
  const rail = page.getByRole("navigation", { name: "Run progress" });
  await expect(rail.getByText(phaseLabel, { exact: true })).toBeVisible({ timeout: timeoutMs });
}

/** Completed runs collapse judge cards into a closed <details> — open before asserting. */
export async function expandJudgeDetail(page: Page): Promise<void> {
  const judgeGroup = page.getByRole("group", { name: "Judge detail" });
  if ((await judgeGroup.count()) === 0) return;
  const summary = judgeGroup.locator(":scope > summary");
  if ((await summary.count()) === 0) return;
  const isOpen = await judgeGroup.evaluate((el) => (el as HTMLDetailsElement).open);
  if (!isOpen) await summary.click();
}

/** Context (related roasts / metrics) is a closed <details> — open before asserting. */
export async function expandContextDetail(page: Page): Promise<void> {
  const contextGroup = page.getByRole("group", { name: "Context" });
  if ((await contextGroup.count()) === 0) return;
  const summary = contextGroup.locator(":scope > summary");
  if ((await summary.count()) === 0) return;
  const isOpen = await contextGroup.evaluate((el) => (el as HTMLDetailsElement).open);
  if (!isOpen) await summary.click();
}

export async function expectStubJudgeVerdicts(
  page: Page,
  timeoutMs = 30_000,
): Promise<void> {
  await expandJudgeDetail(page);
  await expect(page.getByRole("article", { name: /The VC/i })).toBeVisible({ timeout: timeoutMs });
  await expect(page.getByRole("article", { name: /The Customer/i })).toBeVisible({
    timeout: timeoutMs,
  });
  await expect(page.getByText(/CONDITIONAL/).first()).toBeVisible({ timeout: timeoutMs });
}

export type SseEvent = {
  type: string;
  sequence: number;
  payload: Record<string, unknown>;
};

/** Fetch persisted SSE events for a run (setup/assertion helper). */
export async function fetchRunEvents(
  request: APIRequestContext,
  runId: string,
  options: { afterSequence?: number } = {},
): Promise<SseEvent[]> {
  const headers =
    options.afterSequence != null && options.afterSequence >= 0
      ? { "Last-Event-ID": String(options.afterSequence) }
      : undefined;
  const response = await request.get(`${E2E_API_URL}/api/runs/${runId}/events`, { headers });
  expect(response.ok(), await response.text()).toBeTruthy();
  const body = await response.text();
  const events: SseEvent[] = [];
  for (const chunk of body.split("\n\n")) {
    if (!chunk.trim() || chunk.trimStart().startsWith(":")) continue;
    let data: string | null = null;
    for (const line of chunk.split("\n")) {
      if (line.startsWith("data: ")) data = line.slice(6);
    }
    if (data) events.push(JSON.parse(data) as SseEvent);
  }
  return events;
}

/**
 * Drain the stub SSE stream and wait until the run is completed.
 *
 * Runs stay `created` until a client connects to `/events`, so this starts a
 * background drain and polls status until the pipeline finishes.
 */
export async function waitForStubRunCompleted(
  request: APIRequestContext,
  runId: string,
  { timeoutMs = 60_000 } = {},
): Promise<SseEvent[]> {
  const drain = fetchRunEvents(request, runId);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const status = await getRunStatus(request, runId);
    if (status.status === "completed") break;
    if (status.status === "failed" || status.status === "cancelled") {
      throw new Error(`Run ${runId} ended with status ${status.status}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  const events = await drain;
  expect(events.at(-1)?.type).toBe("run_completed");
  return events;
}

export async function postAppeal(
  request: APIRequestContext,
  runId: string,
  appealText: string,
): Promise<{ status: number; ok: boolean }> {
  const response = await request.post(`${E2E_API_URL}/api/runs/${runId}/appeal`, {
    data: { appeal_text: appealText },
  });
  return { status: response.status(), ok: response.ok() };
}

export async function fetchWorkspaceMarkdownExport(
  request: APIRequestContext,
  workspaceId: string,
): Promise<string> {
  const response = await request.get(
    `${E2E_API_URL}/api/workspaces/${workspaceId}/export/markdown`,
  );
  expect(response.ok(), await response.text()).toBeTruthy();
  const body = await response.text();
  expect(body).toContain("# ");
  return body;
}

export async function fetchJudgeBriefExport(
  request: APIRequestContext,
  workspaceId: string,
): Promise<string> {
  const response = await request.get(
    `${E2E_API_URL}/api/workspaces/${workspaceId}/export/judge-brief`,
  );
  expect(response.ok(), await response.text()).toBeTruthy();
  const body = await response.text();
  expect(body.length).toBeGreaterThan(50);
  return body;
}
