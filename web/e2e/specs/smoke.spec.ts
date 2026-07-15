import { test, expect } from "../fixtures/test";

test.describe("smoke", { tag: "@core" }, () => {
  test("home shows the landing page and links to the worksheet", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Put your startup idea on trial." }),
    ).toBeVisible();
    await expect(page.getByText("Your Gavel trail")).toBeVisible();
    await expect(page.getByRole("link", { name: "Roast my idea" })).toHaveAttribute(
      "href",
      "/workspaces/new",
    );
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
    await expect(page.getByRole("heading", { name: "Your ideas on trial" })).toBeVisible();

    await mainNav.getByRole("link", { name: "History" }).click();
    await expect(page).toHaveURL(/\/history$/);
    await expect(
      page.getByRole("heading", { name: "Ideas you've put on trial" }),
    ).toBeVisible();

    await mainNav.getByRole("link", { name: "Settings" }).click();
    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.getByRole("heading", { name: "Advanced settings" })).toBeVisible();
  });
});
