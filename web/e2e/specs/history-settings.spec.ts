import { test, expect } from "../fixtures/test";

import { E2E_API_URL } from "../fixtures/api";
import { createLaunchReadyWorkspace } from "../fixtures/readiness";
import {
  createStubRun,
  fetchJudgeBriefExport,
  fetchWorkspaceMarkdownExport,
  waitForRunTerminalState,
  waitForStubRunCompleted,
} from "../fixtures/run";

test.describe.serial("history, exports, and settings", { tag: "@extended" }, () => {
  let workspaceId: string;
  let workingName: string;
  let completedRunId: string;

  test.beforeAll(async ({ request }) => {
    const detail = await createLaunchReadyWorkspace(request);
    workspaceId = detail.workspace.id;
    workingName = detail.current_version.worksheet.working_name as string;
    const created = await createStubRun(request, workspaceId);
    completedRunId = created.run_id;
    await waitForStubRunCompleted(request, completedRunId);
  });

  test("lists completed runs grouped by workspace on /history", async ({ page }) => {
    await page.goto("/history");
    await expect(page.getByRole("heading", { name: "Startups you're iterating" })).toBeVisible();
    await expect(page.getByText(workingName)).toBeVisible();
    await expect(page.getByRole("link", { name: workingName })).toHaveAttribute(
      "href",
      `/run/${completedRunId}`,
    );
  });

  test("links a completed run back to its workspace", async ({ page }) => {
    await page.goto(`/run/${completedRunId}`);
    await waitForRunTerminalState(page, "completed");
    await page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link", { name: workingName }).click();
    await expect(page).toHaveURL(new RegExp(`/workspaces/${workspaceId}$`));
  });

  test("downloads workspace markdown export from the overview UI", async ({ page }) => {
    await page.goto(`/workspaces/${workspaceId}`);

    const downloadPromise = page.waitForEvent("download");
    await page.locator("summary").filter({ hasText: "More actions" }).click();
    await page.getByRole("button", { name: "Export markdown" }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/-export\.md$/);
    const path = await download.path();
    expect(path).toBeTruthy();
  });

  test("returns a valid judge brief export for the latest worksheet", async ({ request }) => {
    const brief = await fetchJudgeBriefExport(request, workspaceId);
    expect(brief).toContain(workingName);
    expect(brief.toLowerCase()).toMatch(/judge|brief|worksheet/);
  });

  test("returns workspace markdown via export API", async ({ request }) => {
    const markdown = await fetchWorkspaceMarkdownExport(request, workspaceId);
    expect(markdown).toContain(workingName);
    expect(markdown).toContain("## Worksheet");
  });

  test("persists advanced settings in local storage", async ({ page }) => {
    await page.goto("/settings");
    await page.getByLabel("Model runtime").click();
    await page.getByRole("option", { name: "Local (free, slower)" }).click();
    await page.getByRole("switch", { name: "Enable web search for new reviews" }).click();

    const stored = await page.evaluate(() => localStorage.getItem("rms-advanced-settings"));
    expect(stored).toContain('"model_runtime":"local"');
    expect(stored).toContain('"enable_web_search":true');
  });

  test("shows a recovery path when history cannot reach the API", async ({ page }) => {
    await page.route(`**${E2E_API_URL}/api/runs**`, (route) => route.abort("failed"));
    await page.goto("/history");
    await expect(page.getByRole("alert").getByText("Could not load workspaces")).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  });
});
