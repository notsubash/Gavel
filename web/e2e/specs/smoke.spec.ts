import { test, expect } from "../fixtures/test";

test.describe("smoke", () => {
  test("home redirects to new workspace worksheet", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/workspaces\/new$/);
    await expect(
      page.getByRole("heading", { name: "Idea validation worksheet" }),
    ).toBeVisible();
    await expect(page.getByRole("group", { name: "Input mode" })).toBeVisible();
  });

  test("sidebar reports API health", async ({ page }) => {
    await page.goto("/workspaces/new");
    await expect(page.getByText("API offline")).not.toBeVisible();
    await expect(page.getByText("API online")).toBeVisible({ timeout: 30_000 });
  });

  test("primary navigation reaches Workspaces, History, and Settings", async ({ page }) => {
    await page.goto("/workspaces/new");
    const mainNav = page.getByRole("navigation", { name: "Main" });

    await mainNav.getByRole("link", { name: "Workspaces" }).click();
    await expect(page).toHaveURL(/\/workspaces$/);
    await expect(page.getByRole("heading", { name: "Your startup ideas" })).toBeVisible();

    await mainNav.getByRole("link", { name: "History" }).click();
    await expect(page).toHaveURL(/\/history$/);
    await expect(
      page.getByRole("heading", { name: "Startups you're iterating" }),
    ).toBeVisible();

    await mainNav.getByRole("link", { name: "Settings" }).click();
    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.getByRole("heading", { name: "Advanced settings" })).toBeVisible();
  });
});
