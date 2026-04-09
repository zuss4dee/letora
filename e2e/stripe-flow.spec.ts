import { expect, test } from "@playwright/test";

test.describe("Stripe test flow", () => {
  test.beforeEach(async ({ page }) => {
    // Mock Supabase /auth/v1/signup
    await page.route("**/auth/v1/signup", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: { id: "mock-user-id", email: "test-stripe-user@example.com" },
          session: { access_token: "mock-access-token" },
        }),
      });
    });

    // Mock Supabase /auth/v1/token (password grant for sign-in)
    await page.route("**/auth/v1/token", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: { id: "mock-user-id", email: "test-stripe-user@example.com" },
          session: { access_token: "mock-access-token" },
        }),
      });
    });

    // Mock Supabase /rest/v1/users for fetching stripe_customer_id
    await page.route("**/rest/v1/users**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([{ id: "mock-user-id", stripe_customer_id: "mock-stripe-customer-id", text: "" }]),
      });
    });

    // App returns JSON { url } from POST /api/stripe/create-portal
    await page.route("**/api/stripe/create-portal", async (route) => {
      if (route.request().method() !== "POST") {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ url: "https://billing.stripe.com/mock-portal-session" }),
      });
    });

    // Mock Supabase /auth/v1/user for session checks (e.g., in middleware or layout)
    await page.route("**/auth/v1/user", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: { id: "mock-user-id", email: "test-stripe-user@example.com" },
          session: { access_token: "mock-access-token" },
        }),
      });
    });
  });

  test("should complete a safe Stripe test flow", async ({ page }) => {
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        console.error(`Browser Error: ${msg.text()}`);
      }
      console.log(`Browser Console: ${msg.text()}`);
    });

    // 1. Sign up a new user (form requires full name + matching passwords)
    await page.goto("/signup");
    await page.getByTestId("signup-fullname").fill("Test Stripe User");
    await page.getByTestId("signup-email").fill("test-stripe-user@example.com");
    await page.getByTestId("signup-password").fill("password123");
    await page.getByTestId("signup-confirm-password").fill("password123");
    await page.getByTestId("signup-submit").click();

    // 2. Log in with the same user
    await page.goto("/login");
    await page.getByTestId("login-email").fill("test-stripe-user@example.com");
    await page.getByTestId("login-password").fill("password123");
    await page.getByTestId("login-submit").click();

    // Verify redirection to dashboard after login
    await expect(page).toHaveURL(/\/dashboard/);

    // 3. Open billing portal from Billing page (matches app route + JSON contract)
    await page.goto("/dashboard/billing");
    await page.getByTestId("manage-billing").click();

    // 4. Verify navigation to Stripe customer portal URL
    await page.waitForURL(/https:\/\/billing\.stripe\.com\/.*/);
    expect(page.url()).toMatch(/https:\/\/billing\.stripe\.com\/.*/);
  });
});
