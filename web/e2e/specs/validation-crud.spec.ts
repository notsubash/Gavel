import { test, expect } from "../fixtures/test";

import { createWorkspace } from "../fixtures/workspace";
import {
  createAssumption,
  createExperiment,
  deleteAssumption,
  getValidationOverview,
  updateAssumption,
} from "../fixtures/validation";
import { openWorkspaceTab } from "../fixtures/worksheet";

test.describe.serial("validation workbench CRUD", { tag: "@extended" }, () => {
  let workspaceId: string;
  const addedAssumptionText = "Paid founders will log evidence weekly without reminders.";
  const editedAssumptionText = "Paid founders will log evidence weekly after the first roast.";

  test.beforeAll(async ({ request }) => {
    const detail = await createWorkspace(request, {
      worksheet: { working_name: `E2E Validation ${Date.now()}` },
    });
    workspaceId = detail.workspace.id;
  });

  test("overview and checklist render before records are added", async ({ page, request }) => {
    const overviewBefore = await getValidationOverview(request, workspaceId);
    const completedBefore = overviewBefore.checklist.items.filter((i) => i.completed).length;

    await page.goto(`/workspaces/${workspaceId}`);
    await expect(page.getByText("Validation progress")).toBeVisible();
    await expect(page.getByRole("progressbar")).toBeVisible();
    await expect(page.getByText(`${completedBefore}/`)).toBeVisible();
  });

  test("adds, edits, and deletes assumptions with browser verification", async ({
    page,
    request,
  }) => {
    const created = await createAssumption(request, workspaceId, {
      statement: addedAssumptionText,
      type: "demand",
    });

    await page.goto(`/workspaces/${workspaceId}/validation`);
    await expect(page.getByText(addedAssumptionText)).toBeVisible();

    const card = page
      .getByRole("list", { name: "Assumption kanban columns" })
      .locator("li")
      .filter({ hasText: addedAssumptionText });
    await card.getByRole("combobox", { name: /Move assumption/i }).click();
    await page.getByRole("option", { name: "Testing" }).click();
    await expect(card.getByText("Type: Demand")).toBeVisible();

    await updateAssumption(request, workspaceId, created.id, {
      statement: editedAssumptionText,
    });
    await page.reload();
    await expect(page.getByText(editedAssumptionText)).toBeVisible();
    await expect(page.getByText(addedAssumptionText)).not.toBeVisible();

    await deleteAssumption(request, workspaceId, created.id);
    await page.reload();
    await expect(page.getByText(editedAssumptionText)).not.toBeVisible();
  });

  test("logs evidence through the dialog and persists after reload", async ({ page }) => {
    const evidenceText =
      "Four founders confirmed they skip formal validation until after they ship a v1.";

    await page.goto(`/workspaces/${workspaceId}/validation`);
    await page.getByRole("button", { name: "Add evidence" }).click();
    await expect(page.getByRole("dialog", { name: "Add evidence" })).toBeVisible();

    await page.getByLabel("Content").fill(evidenceText);
    await expect(page.getByRole("button", { name: "Save evidence" })).toBeEnabled();
    await page.getByRole("button", { name: "Save evidence" }).click();

    await expect(page.getByRole("dialog", { name: "Add evidence" })).not.toBeVisible();
    await expect(page.getByText(evidenceText)).toBeVisible();

    await page.reload();
    await expect(page.getByText(evidenceText)).toBeVisible();
  });

  test("blocks invalid interview submissions in the dialog", async ({ page }) => {
    await page.goto(`/workspaces/${workspaceId}/validation`);
    await page.getByRole("button", { name: "Log interview" }).click();

    const dialog = page.getByRole("dialog", { name: "Interview note" });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Notes").fill("Short notes that should not save without a person.");
    await expect(dialog.getByRole("button", { name: "Save interview" })).toBeDisabled();

    await dialog.getByLabel("Person").fill("Design partner Alex");
    await expect(dialog.getByRole("button", { name: "Save interview" })).toBeEnabled();
  });

  test("saves an interview note and shows it in the list", async ({ page }) => {
    const person = "Design partner Alex";
    const notes =
      "Alex runs weekly customer calls and still tracks validation in scattered Notion pages.";

    await page.goto(`/workspaces/${workspaceId}/validation`);
    await page.getByRole("button", { name: "Log interview" }).click();

    const dialog = page.getByRole("dialog", { name: "Interview note" });
    await dialog.getByLabel("Person").fill(person);
    await dialog.getByLabel("Notes").fill(notes);
    await dialog.getByRole("button", { name: "Save interview" }).click();

    await expect(dialog).not.toBeVisible();
    await expect(page.getByRole("heading", { name: /Interviews \(1\)/ })).toBeVisible();
    await expect(page.getByText(person)).toBeVisible();

    await page.reload();
    await expect(page.getByText(person)).toBeVisible();
    await expect(page.getByText(notes)).toBeVisible();
  });

  test("creates an experiment and reflects status in the UI", async ({ page, request }) => {
    const title = "Landing page conversion smoke test";
    await createExperiment(request, workspaceId, {
      title,
      hypothesis: "At least five founders will request early access from a narrow landing page.",
      pass_fail_threshold: "Pass if five or more qualified signups arrive within seven days.",
      status: "planned",
    });

    await page.goto(`/workspaces/${workspaceId}/validation`);
    await expect(page.getByText(title)).toBeVisible();
    await expect(page.getByText("Planned")).toBeVisible();

    await page.getByRole("button", { name: "Start" }).click();
    await expect(page.getByText("Active")).toBeVisible();
  });

  test("checklist and overview confidence update after validation records", async ({
    page,
    request,
  }) => {
    const overview = await getValidationOverview(request, workspaceId);
    const problemEvidence = overview.checklist.items.find((i) => i.stage === "problem_evidence");
    expect(problemEvidence?.completed).toBe(true);

    await page.goto(`/workspaces/${workspaceId}/validation`);
    await expect(page.getByText(problemEvidence!.label)).toBeVisible();
    await expect(page.getByText(`✓ ${problemEvidence!.label}`)).toBeVisible();

    await openWorkspaceTab(page, "Overview");
    await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", /.+/);
    await expect(page.getByText("demand: Some signal")).toBeVisible();
  });

});
