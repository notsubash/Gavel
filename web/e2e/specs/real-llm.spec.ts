import { test, expect } from "../fixtures/test";

import { createLaunchReadyWorkspace, launchFromGate, openReadinessGate } from "../fixtures/readiness";
import {
  configureRealRunSettings,
  E2E_STUB_MARKER,
  probeModelRuntime,
  type ModelProbeResult,
} from "../fixtures/real-llm";
import { expandContextDetail, expandJudgeDetail, waitForRunTerminalState } from "../fixtures/run";

test.describe.serial("real LLM integration", { tag: "@real-llm" }, () => {
  let probe: ModelProbeResult;
  let workspaceId: string;

  test.beforeAll(async ({ request }) => {
    probe = await probeModelRuntime();
    if (!probe.available) return;

    const detail = await createLaunchReadyWorkspace(request);
    workspaceId = detail.workspace.id;
  });

  test("completes one low-round roast through the real pipeline", async ({ page }) => {
    test.skip(!probe.available, probe.available ? undefined : probe.reason);
    if (!probe.available) return;

    await configureRealRunSettings(page, probe.runtime);
    await openReadinessGate(page, workspaceId);
    const runId = await launchFromGate(page);

    await expect(page).toHaveURL(new RegExp(`/run/${runId}$`));
    await waitForRunTerminalState(page, "completed", 240_000);

    await expect(page.getByText(E2E_STUB_MARKER)).not.toBeVisible();
    // Decision card is outside the collapsed judge <details>; assert it first.
    await expect(page.getByRole("heading", { name: "Overall decision" })).toBeVisible({
      timeout: 30_000,
    });
    await expandJudgeDetail(page);
    await expect(page.getByRole("article", { name: /The VC/i })).toBeVisible({
      timeout: 30_000,
    });
    await expandContextDetail(page);
    await expect(page.locator('footer[aria-label="Run metrics"]')).toBeVisible();
  });
});
