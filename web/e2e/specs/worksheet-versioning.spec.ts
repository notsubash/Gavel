import { test, expect } from "../fixtures/test";

import { createWorkspace } from "../fixtures/workspace";
import {
  getWorkspaceDetail,
  getWorksheetVersionDiff,
  listWorksheetVersions,
} from "../fixtures/validation";
import { expectWorkspaceTab, openWorkspaceTab } from "../fixtures/worksheet";

test.describe.serial("worksheet versioning", { tag: "@extended" }, () => {
  let workspaceId: string;
  const originalAudience =
    "Solo technical founders building paid SaaS before they have revenue.";
  const revisedAudience =
    "Solo technical founders shipping B2B tools who need proof before writing code.";
  const revisedPricing = "$39/month with a 14-day validation sprint onboarding fee.";

  test.beforeAll(async ({ request }) => {
    const detail = await createWorkspace(request, {
      worksheet: {
        working_name: `E2E Worksheet ${Date.now()}`,
        audience: originalAudience,
      },
    });
    workspaceId = detail.workspace.id;
  });

  test("shows version history and blocks save until a meaningful edit", async ({ page }) => {
    await page.goto(`/workspaces/${workspaceId}/worksheet`);
    await expect(page.getByRole("button", { name: "v1 (current)" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Save worksheet" })).toBeDisabled();
    await expect(page.getByText("No changes to save yet.")).toBeVisible();
  });

  test("saves a new worksheet version when core fields change", async ({ page, request }) => {
    await page.goto(`/workspaces/${workspaceId}/worksheet`);
    await page.getByLabel("Audience").fill(revisedAudience);
    await page.getByLabel("Pricing hypothesis").fill(revisedPricing);

    await expect(page.getByText("This creates version 2")).toBeVisible();
    await page.getByRole("button", { name: "Save as version 2" }).click();
    await expect(page.getByText("Saved as version 2")).toBeVisible();
    await expect(page.getByRole("button", { name: "v2 (current)" })).toBeVisible();

    const detail = await getWorkspaceDetail(request, workspaceId);
    expect(detail.current_version.version).toBe(2);
    expect(detail.current_version.worksheet.audience).toBe(revisedAudience);
  });

  test("shows previous versions in history with a diff surface", async ({ page, request }) => {
    await page.goto(`/workspaces/${workspaceId}/worksheet`);

    await expect(page.getByRole("button", { name: /^v1$/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "v2 (current)" })).toBeVisible();

    // v1 has no parent version — history diff is empty, not the v2 audience edit.
    await page.getByRole("button", { name: /^v1$/ }).click();
    const historyDiff = page
      .getByRole("heading", { name: "Changes in this version" })
      .locator("..");
    await expect(historyDiff.getByText("No field changes from the prior version.")).toBeVisible();

    const versions = await listWorksheetVersions(request, workspaceId);
    const v2 = versions.find((v) => v.version === 2);
    expect(v2).toBeTruthy();
    const diff = await getWorksheetVersionDiff(request, workspaceId, v2!.id);
    const audienceChange = diff.changes.find((c) => c.field === "audience");
    expect(audienceChange?.before).toBe(originalAudience);
    expect(audienceChange?.after).toBe(revisedAudience);

    // Pending-changes panel uses the same diff component; scope to strike-through markup.
    const pendingAudience = `${revisedAudience} (pending v3)`;
    await page.getByLabel("Audience").fill(pendingAudience);
    const pendingPanel = page.getByRole("heading", { name: "Pending changes" }).locator("..");
    await expect(pendingPanel.locator(".line-through", { hasText: revisedAudience })).toBeVisible();
    await expect(pendingPanel.getByText(pendingAudience)).toBeVisible();
  });

  test("overview and judges surfaces use the latest worksheet content", async ({
    page,
    request,
  }) => {
    await page.goto(`/workspaces/${workspaceId}`);
    await expect(page.getByText("Version 2")).toBeVisible();
    await expect(page.getByText(revisedAudience)).toBeVisible();

    await openWorkspaceTab(page, "Judges");
    await expectWorkspaceTab(page, "Judges");
    await page.getByRole("button", { name: "Launch roast" }).click();
    await expect(page.getByRole("dialog", { name: "Readiness gate" })).toBeVisible();
    await expect(
      page.getByRole("listitem", { name: "Passed: Audience must be at least 10 characters" }),
    ).toBeVisible();

    const detail = await getWorkspaceDetail(request, workspaceId);
    expect(detail.current_version.version).toBe(2);
    expect(detail.current_version.worksheet.pricing_hypothesis).toBe(revisedPricing);
    expect(detail.current_version.worksheet.audience).toBe(revisedAudience);
  });

  test("worksheet edits persist across reload", async ({ page }) => {
    await page.goto(`/workspaces/${workspaceId}/worksheet`);
    await page.reload();

    await expect(page.getByLabel("Audience")).toHaveValue(revisedAudience);
    await expect(page.getByLabel("Pricing hypothesis")).toHaveValue(revisedPricing);
    await expect(page.getByRole("button", { name: "v2 (current)" })).toBeVisible();
  });
});
