import { test, expect } from "../fixtures/test";

import {
  createIncompleteWorkspace,
  createLaunchReadyWorkspace,
  launchFromGate,
  openReadinessGate,
} from "../fixtures/readiness";
import { getReadiness } from "../fixtures/workspace";
import { openWorkspaceTab } from "../fixtures/worksheet";

test.describe.serial("readiness gate and judges launch", { tag: "@core" }, () => {
  let incompleteWorkspaceId: string;
  let readyWorkspaceId: string;
  let settingsWorkspaceId: string;

  test.beforeAll(async ({ request }) => {
    const incomplete = await createIncompleteWorkspace(request);
    incompleteWorkspaceId = incomplete.workspace.id;

    const ready = await createLaunchReadyWorkspace(request);
    readyWorkspaceId = ready.workspace.id;

    const settingsReady = await createLaunchReadyWorkspace(request);
    settingsWorkspaceId = settingsReady.workspace.id;
  });

  test("blocks launch when readiness checks fail", async ({ page, request }) => {
    const readiness = await getReadiness(request, incompleteWorkspaceId);
    expect(readiness.can_run_judges).toBe(false);
    expect(readiness.level).toBe("too_vague");

    await openReadinessGate(page, incompleteWorkspaceId);
    await expect(page.getByText(/Status: Too vague/i)).toBeVisible();
    await expect(
      page.getByRole("listitem", { name: /Failed:.*pricing hypothesis/i }),
    ).toBeVisible();
    await expect(page.getByLabel(/override readiness gate/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "Start review" })).toBeDisabled();
  });

  test("launches with readiness override when checks fail", async ({ page }) => {
    await openReadinessGate(page, incompleteWorkspaceId);
    const runId = await launchFromGate(page, { override: true });
    await expect(page.getByText(/Run complete|panel is reviewing|judges are/i)).toBeVisible();
    expect(runId.length).toBeGreaterThan(8);
  });

  test("launches without override when workspace is ready", async ({ page, request }) => {
    const readiness = await getReadiness(request, readyWorkspaceId);
    expect(readiness.can_run_judges).toBe(true);

    await openReadinessGate(page, readyWorkspaceId);
    await expect(page.getByText(/Status: Ready for judges|Status: Speculative/i)).toBeVisible();
    await expect(page.getByLabel(/override readiness gate/i)).not.toBeVisible();
    const runId = await launchFromGate(page);
    await expect(page).toHaveURL(new RegExp(`/run/${runId}$`));
  });

  test("includes advanced settings in the launch payload", async ({ page }) => {
    await page.goto("/settings");
    await page.getByLabel("Model runtime").click();
    await page.getByRole("option", { name: "Local (free, slower)" }).click();
    await page.getByRole("switch", { name: "Enable web search for new reviews" }).click();
    await page.evaluate(() => {
      const key = "rms-advanced-settings";
      const raw = localStorage.getItem(key);
      const current = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      localStorage.setItem(key, JSON.stringify({ ...current, max_debate_rounds: 2 }));
    });

    const launchRequest = page.waitForRequest(
      (req) => req.method() === "POST" && req.url().includes("/api/runs"),
    );

    await openReadinessGate(page, settingsWorkspaceId);
    await launchFromGate(page);

    const request = await launchRequest;
    const body = request.postDataJSON() as Record<string, unknown>;
    expect(body.workspace_id).toBe(settingsWorkspaceId);
    expect(body.model_runtime).toBe("local");
    expect(body.max_debate_rounds).toBe(2);
    expect(body.enable_web_search).toBe(true);
    expect(body.readiness_override).toBe(false);
  });

  test("judges page lists launched runs for the workspace", async ({ page }) => {
    await page.goto(`/workspaces/${readyWorkspaceId}/judges`);
    await openWorkspaceTab(page, "Judges");
    await expect(page.getByRole("heading", { name: "Run history" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Run [0-9a-f]{8}/i }).first()).toBeVisible();
  });
});
