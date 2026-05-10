/** Where platform checkout (Stripe or Polar) should send the user after success or cancel. */
export type CheckoutReturnTarget = "default" | "billing" | "onboarding" | "import";

export function checkoutSuccessPath(target: CheckoutReturnTarget): string {
  if (target === "billing") return "/dashboard/billing?checkout=success";
  if (target === "onboarding") return "/onboarding?checkout=success";
  if (target === "import") return "/dashboard/import?checkout=success";
  return "/dashboard?success=true";
}

export function checkoutCancelPath(target: CheckoutReturnTarget): string {
  if (target === "billing") return "/dashboard/billing?checkout=cancelled";
  if (target === "onboarding") return "/onboarding?checkout=cancelled";
  if (target === "import") return "/dashboard/import?checkout=cancelled";
  return "/dashboard/billing?checkout=cancelled";
}
