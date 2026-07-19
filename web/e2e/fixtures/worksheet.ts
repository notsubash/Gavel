import { expect, type Page } from "@playwright/test";

/** Valid worksheet payload — meets zod min lengths for guided creation. */
export type E2eWorksheetValues = {
  working_name: string;
  audience: string;
  problem_statement: string;
  current_workaround: string;
  solution_statement: string;
  secret_sauce: string;
  pricing_hypothesis: string;
  existing_evidence: string;
  competitors: string;
  top_risky_assumption: string;
  disconfirming_evidence: string;
};

export const E2E_WORKSHEET: E2eWorksheetValues = {
  working_name: "E2E Browser Workspace",
  audience: "Solo founders who need repeatable browser checks before shipping features.",
  problem_statement: "cannot trust refactors without slow manual click-through testing every week.",
  current_workaround: "They run ad hoc manual QA and hope Playwright specs stay green.",
  solution_statement:
    "I am building a founder workbench with deterministic E2E coverage for core product loops.",
  secret_sauce: "Isolated SQLite fixtures plus accessible locators instead of brittle CSS.",
  pricing_hypothesis: "$29 per month for teams shipping validation workflows weekly.",
  existing_evidence: "Two founders asked for worksheet versioning tests in CI.",
  competitors: "Manual QA\nSpreadsheets",
  top_risky_assumption: "Founders will maintain E2E specs after the first green CI run.",
  disconfirming_evidence: "Teams say API tests alone are enough and skip browser suites.",
};

/** Fill the guided worksheet form on `/workspaces/new` or the worksheet editor. */
export async function fillWorksheetForm(
  page: Page,
  values: Partial<E2eWorksheetValues> = {},
): Promise<void> {
  const data = { ...E2E_WORKSHEET, ...values };

  await page.getByLabel("Working name").fill(data.working_name);
  await page.getByLabel("Audience").fill(data.audience);
  await page.getByLabel("Problem statement").fill(data.problem_statement);
  await page.getByLabel("Solution statement").fill(data.solution_statement);
  await page.getByLabel("Top risky assumption").fill(data.top_risky_assumption);

  // Phase 3: deferred fields live behind progressive disclosure.
  const detailSummary = page
    .locator("summary")
    .filter({ hasText: /Add more detail|More detail/ })
    .first();
  if (await detailSummary.count()) {
    const details = detailSummary.locator("xpath=ancestor::details[1]");
    if ((await details.getAttribute("open")) === null) {
      await detailSummary.click();
    }
  }

  await page.getByLabel("Current workaround").fill(data.current_workaround);
  await page.getByLabel("Secret sauce").fill(data.secret_sauce);
  await page.getByLabel("Pricing hypothesis").fill(data.pricing_hypothesis);
  await page.getByLabel("Existing evidence").fill(data.existing_evidence);
  await page.getByLabel("Competitors and alternatives").fill(data.competitors);
  await page.getByLabel("What would prove this wrong?").fill(data.disconfirming_evidence);
}

/** Phase 4 tabs. Evidence is Case's /validation route (no separate tab). */
export type WorkspaceTabLabel = "Case" | "Pitch" | "Reviews";
export type WorkspaceSectionLabel = WorkspaceTabLabel | "Evidence";

/** Navigate to a workspace section by URL. Prefer openWorkspaceTab when the tab nav is visible. */
export async function gotoWorkspaceTab(
  page: Page,
  workspaceId: string,
  label: WorkspaceSectionLabel,
): Promise<void> {
  const slug =
    label === "Case"
      ? ""
      : label === "Evidence"
        ? "/validation"
        : label === "Pitch"
          ? "/worksheet"
          : "/judges";
  await page.goto(`/workspaces/${workspaceId}${slug}`);
}

/** Click a workspace section tab when the full nav chrome is present. */
export async function openWorkspaceTab(
  page: Page,
  label: WorkspaceTabLabel,
): Promise<void> {
  const nav = page.getByRole("navigation", { name: "Workspace sections" });
  await nav.getByRole("link", { name: label, exact: true }).click();
}

/** Assert the active workspace tab matches `label`. */
export async function expectWorkspaceTab(
  page: Page,
  label: WorkspaceTabLabel,
): Promise<void> {
  const nav = page.getByRole("navigation", { name: "Workspace sections" });
  await expect(nav.getByRole("link", { name: label, exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
}
