import { expect, test } from "@playwright/test";

test.describe("Auth callback and login prefill", () => {
  test("auth callback page renders without crashing", async ({ page }) => {
    const res = await page.goto("/auth/callback");
    expect(res?.ok()).toBeTruthy();
    await expect(page.getByText("Signing you in")).toBeVisible({ timeout: 15_000 });
  });

  test("login page prefills email from query string", async ({ page }) => {
    await page.goto("/login?email=prefill%2Btest%40example.com");
    const email = page.getByTestId("login-email");
    await expect(email).toHaveValue("prefill+test@example.com");
  });

  test("login shows callback error banner when auth_error=callback", async ({ page }) => {
    await page.goto("/login?auth_error=callback&reason=no_session");
    await expect(
      page.getByRole("alert").filter({ hasText: /no_session|email link|signing you in/i }),
    ).toBeVisible();
  });
});
