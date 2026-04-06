import { expect, test } from "@playwright/test";

test.describe("login page", () => {
  test("renders for anonymous users", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Letora", exact: true })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
  });
});
