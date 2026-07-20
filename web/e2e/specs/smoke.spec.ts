import { test, expect } from "../fixtures/test";

test.describe("smoke", { tag: "@core" }, () => {
  test("home shows the landing page and links to the worksheet", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Put your startup idea on trial." }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Start free" }).first()).toHaveAttribute(
      "href",
      "/workspaces/new",
    );
    await expect(page.getByRole("link", { name: "Open app" }).first()).toHaveAttribute(
      "href",
      "/workspaces",
    );
    await expect(page.getByText("Your Gavel trail")).toBeVisible();
    // Phase 5: real-app verdict mock in the hero; contribution graph below How it works.
    await expect(
      page.getByRole("figure", { name: /Example verdict from a completed Gavel review/i }),
    ).toBeVisible();
    const howHeading = page.getByRole("heading", { name: "How Gavel works" });
    const trail = page.getByText("Your Gavel trail");
    await expect(howHeading).toBeVisible();
    const howBox = await howHeading.boundingBox();
    const trailBox = await trail.boundingBox();
    expect(howBox && trailBox && trailBox.y > howBox.y).toBeTruthy();
  });

  test("Advanced menu reports API health", async ({ page }) => {
    await page.goto("/workspaces/new");
    const appNav = page.getByLabel("App navigation");
    await appNav.locator("summary").filter({ hasText: "Advanced" }).click();
    await expect(appNav.getByText("API offline")).not.toBeVisible();
    await expect(appNav.getByText("API online")).toBeVisible({ timeout: 30_000 });
  });

  test("primary navigation reaches Ideas and Settings via Advanced", async ({ page }) => {
    await page.goto("/workspaces/new");
    const mainNav = page.getByRole("navigation", { name: "Main" });

    await mainNav.getByRole("link", { name: "Ideas" }).click();
    await expect(page).toHaveURL(/\/workspaces$/);
    await expect(page.getByRole("heading", { name: "Your ideas on trial" })).toBeVisible();

    await page.locator("summary").filter({ hasText: "Advanced" }).first().click();
    await page.getByRole("link", { name: "Settings" }).click();
    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.getByRole("heading", { name: "Advanced settings" })).toBeVisible();

    await page.goto("/history");
    await expect(page).toHaveURL(/\/workspaces$/);
  });
});
