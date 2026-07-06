import { test, expect } from "../fixtures/test";

import { createLaunchReadyWorkspace } from "../fixtures/readiness";
import {
  createStubRun,
  expectStubJudgeVerdicts,
  fetchRunEvents,
  getRunStatus,
  postAppeal,
  waitForRunPhase,
  waitForRunTerminalState,
  waitForStubRunCompleted,
} from "../fixtures/run";

test.describe.serial("live run view, SSE, and post-run actions", () => {
  let workspaceId: string;
  let completedRunId: string;

  test.beforeAll(async ({ request }) => {
    const detail = await createLaunchReadyWorkspace(request);
    workspaceId = detail.workspace.id;
    const created = await createStubRun(request, workspaceId);
    completedRunId = created.run_id;
    await waitForStubRunCompleted(request, completedRunId);
  });

  test("shows phase progression and stub judge verdicts while streaming", async ({
    page,
    request,
  }) => {
    const fresh = await createStubRun(request, workspaceId);
    await page.goto(`/run/${fresh.run_id}`);

    const rail = page.getByRole("navigation", { name: "Run progress" });
    await expect(rail).toBeVisible();
    await waitForRunPhase(page, "Review");
    await waitForRunTerminalState(page, "completed");
    await expect(rail.getByText("completed")).toHaveCount(2);
    await expectStubJudgeVerdicts(page);
    await expect(page.getByRole("heading", { name: "Overall decision" })).toBeVisible();
  });

  test("reconciles debate token deltas with final debate messages", async ({ page }) => {
    await page.goto(`/run/${completedRunId}`);
    await waitForRunTerminalState(page, "completed");

    const transcriptSection = page.getByRole("group", { name: "Debate transcript" });
    const transcriptSummary = transcriptSection.locator(":scope > summary");
    if ((await transcriptSummary.count()) > 0) {
      const isOpen = await transcriptSection.evaluate((el) => (el as HTMLDetailsElement).open);
      if (!isOpen) {
        await transcriptSummary.click();
      }
    }
    await expect(transcriptSection.getByLabel(/Round 1: The VC/i)).toContainText(
      "moat is thin until founders show repeat weekly usage",
    );
  });

  test("shows structured synthesis and run metrics after completion", async ({ page }) => {
    await page.goto(`/run/${completedRunId}`);
    await waitForRunTerminalState(page, "completed");

    await expect(page.getByRole("heading", { name: "Overall decision" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Iterate" })).toBeVisible();
    await expect(page.locator('footer[aria-label="Run metrics"]')).toContainText(/0 tokens|Roast/i);
  });

  test("shows post-roast handoff items on the judges page", async ({ page }) => {
    await page.goto(`/workspaces/${workspaceId}/judges`);
    await expect(
      page.getByRole("heading", { name: "Turn judge feedback into validation tasks" }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(
      page.getByRole("button", { name: /Add as assumption|Log evidence|Start experiment/i }).first(),
    ).toBeVisible();
  });

  test("cancels a running stub run from the UI", async ({ page, request }) => {
    const created = await createStubRun(request, workspaceId);
    await page.goto(`/run/${created.run_id}`);
    await page.getByRole("button", { name: "Stop" }).click();
    await page.getByRole("button", { name: "Stop the run" }).click();
    await waitForRunTerminalState(page, "cancelled");
  });

  test("hydrates a completed run after refresh", async ({ page, request }) => {
    await page.goto(`/run/${completedRunId}`);
    await waitForRunTerminalState(page, "completed");

    await page.reload();
    await waitForRunTerminalState(page, "completed");
    await expectStubJudgeVerdicts(page);
    const status = await getRunStatus(request, completedRunId);
    expect(status.status).toBe("completed");
  });

  test("submits evidence once and shows revised outcome", async ({ page, request }) => {
    const created = await createStubRun(request, workspaceId);
    await page.goto(`/run/${created.run_id}`);
    await waitForRunTerminalState(page, "completed");
    await expect(page.getByRole("button", { name: "Complete experiment" })).toBeVisible({
      timeout: 30_000,
    });

    await page.getByRole("button", { name: "Complete experiment" }).click();
    const dialog = page.getByRole("dialog", { name: "Complete experiment" });
    await dialog.getByLabel("What happened?").fill(
      "We ran five buyer interviews and three founders signed LOIs after the pilot demo.",
    );
    await dialog.getByRole("button", { name: "Submit evidence" }).click();

    await expect(page.getByRole("heading", { name: "Evidence result" })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText(/appeal synthesis/i)).toBeVisible();

    const second = await postAppeal(
      request,
      created.run_id,
      "Second appeal attempt should be rejected by the API.",
    );
    expect(second.status).toBe(409);
  });

  test("does not block the main result when related reviews are unavailable", async ({ page }) => {
    await page.goto(`/run/${completedRunId}`);
    await waitForRunTerminalState(page, "completed");
    await expect(page.getByRole("heading", { name: "Overall decision" })).toBeVisible();
    await expect(page.getByText("Could not load related reviews.")).not.toBeVisible();
  });

  test("survives reload mid-stream without duplicate terminal state", async ({ page, request }) => {
    const created = await createStubRun(request, workspaceId);
    await page.goto(`/run/${created.run_id}`);
    await page.reload();
    await waitForRunTerminalState(page, "completed");
    await expect(page.getByText("Run complete").first()).toBeVisible();
  });

  test("replays SSE from Last-Event-ID without skipping terminal events", async ({ request }) => {
    const events = await fetchRunEvents(request, completedRunId);
    expect(events[0]?.type).toBe("stream_connected");
    expect(events.at(-1)?.type).toBe("run_completed");

    const midpoint = events[Math.floor(events.length / 2)]?.sequence ?? 0;
    const replay = await fetchRunEvents(request, completedRunId, { afterSequence: midpoint });
    expect(replay.length).toBeGreaterThan(0);
    expect(replay[0]?.sequence).toBeGreaterThan(midpoint);
    expect(replay.at(-1)?.type).toBe("run_completed");
  });
});
