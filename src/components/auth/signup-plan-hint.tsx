"use client";

import { useSearchParams } from "next/navigation";

import { PLANS, type PlanKey } from "@/lib/stripe-plans";

function isPlanKey(v: string | null): v is PlanKey {
  return v === "starter" || v === "pro" || v === "landlord_pro";
}

export function SignupPlanHint() {
  const params = useSearchParams();
  const plan = params.get("plan");
  const intent = params.get("intent");

  if (intent === "enterprise") {
    return (
      <p className="rounded-lg border border-[#4F4632]/20 bg-[#131313]/40 px-3 py-2 font-[family-name:var(--font-inter)] text-xs leading-relaxed text-muted-foreground">
        Enterprise enquiry: create your account first. We will reach out about volume pricing and rollout.
      </p>
    );
  }

  if (!isPlanKey(plan)) return null;

  const label = PLANS[plan].name;
  return (
    <p className="rounded-lg border border-[#4F4632]/20 bg-[#131313]/40 px-3 py-2 font-[family-name:var(--font-inter)] text-xs leading-relaxed text-muted-foreground">
      You chose <span className="font-medium text-[#BD9952]">{label}</span>. After you create your account, you will start a{" "}
      <span className="font-medium text-foreground">24-hour free trial</span> (card required). You will not be charged until
      the trial ends if you cancel before then.
    </p>
  );
}
