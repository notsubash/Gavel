import { test, expect } from "../fixtures/test";

import { createWorkspace } from "../fixtures/workspace";
import {
  expectWorkspaceTab,
  fillWorksheetForm,
  gotoWorkspaceTab,
  openWorkspaceTab,
} from "../fixtures/worksheet";

test.describe("workspace creation and navigation", () => {
  test("creates a workspace through the guided worksheet and lands on overview", async ({
    page,
  }) => {
    const name = `E2E Create ${Date.now()}`;

    await page.goto("/workspaces/new");
    await fillWorksheetForm(page, { working_name: name });
    await page.getByRole("button", { name: "Save workspace" }).click();

    await expect(page).toHaveURL(/\/workspaces\/[0-9a-f-]+\?plan_interview=1$/);
    await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
    await expect(page.getByText("Version 1")).toBeVisible();
    await expectWorkspaceTab(page, "Overview");
  });

  test("shows validation errors when required worksheet fields are empty", async ({ page }) => {
    await page.goto("/workspaces/new");
    await page.getByRole("button", { name: "Save workspace" }).click();

    await expect(page.getByLabel("Working name")).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByText("Required")).toBeVisible();
    await expect(page).toHaveURL(/\/workspaces\/new$/);
  });

  test("paste-notes mode stays available without requiring LLM in default E2E", async ({ page }) => {
    await page.goto("/workspaces/new");
    await page.getByRole("button", { name: "Paste notes" }).click();

    await expect(page.getByLabel("Messy notes")).toBeVisible();
    await expect(page.getByRole("button", { name: "Draft from notes" })).toBeDisabled();

    const notes = "A".repeat(25);
    await page.getByLabel("Messy notes").fill(notes);
    await expect(page.getByRole("button", { name: "Draft from notes" })).toBeEnabled();
  });

  test("new workspace appears in the list and deep links survive refresh", async ({
    page,
    request,
  }) => {
    const name = `E2E Nav ${Date.now()}`;
    const detail = await createWorkspace(request, {
      worksheet: { working_name: name },
    });
    const workspaceId = detail.workspace.id;

    await page.goto("/workspaces");
    await expect(page.getByRole("heading", { name: "Your startup ideas" })).toBeVisible();
    await expect(page.getByRole("link", { name })).toBeVisible();

    await page.getByRole("link", { name }).click();
    await expect(page).toHaveURL(new RegExp(`/workspaces/${workspaceId}$`));
    await expectWorkspaceTab(page, "Overview");

    await openWorkspaceTab(page, "Validation");
    await expect(page).toHaveURL(new RegExp(`/workspaces/${workspaceId}/validation$`));
    await expect(page.getByRole("heading", { name: "Validation", level: 1 })).toBeVisible();

    await openWorkspaceTab(page, "Worksheet");
    await expect(page).toHaveURL(new RegExp(`/workspaces/${workspaceId}/worksheet$`));
    await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();

    await gotoWorkspaceTab(page, workspaceId, "Judges");
    await expect(page).toHaveURL(new RegExp(`/workspaces/${workspaceId}/judges$`));
    await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();

    await gotoWorkspaceTab(page, workspaceId, "Overview");
    await expect(page).toHaveURL(new RegExp(`/workspaces/${workspaceId}$`));
    await page.reload();
    await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();

    await page.goto(`/workspaces/${workspaceId}/validation`);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Assumption board" })).toBeVisible();
  });

  test("unknown workspace shows a user-visible API error", async ({ page }) => {
    await page.goto("/workspaces/00000000-0000-4000-8000-000000000001");
    await expect(page.getByText("Workspace not found or API unavailable.")).toBeVisible();
  });
});
