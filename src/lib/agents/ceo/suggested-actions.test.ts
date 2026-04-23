import { describe, expect, it } from "vitest";

import {
  mergeSuggestedActionsFromTools,
  suggestedActionsFromStartTenantOnboarding,
} from "./suggested-actions";

describe("suggestedActionsFromStartTenantOnboarding", () => {
  it("emits Open onboarding when tenancy_id is present", () => {
    const id = "aaaaaaaa-bbbb-4ccc-8eee-eeeeeeeeeeee";
    const actions = suggestedActionsFromStartTenantOnboarding(
      JSON.stringify({ success: true, tenancy_id: id, tasksCreated: 3 }),
    );
    expect(actions).toEqual([
      {
        id: `open-onboarding-${id}`,
        label: "Open onboarding",
        kind: "link",
        href: `/dashboard/tenancies/${id}`,
      },
    ]);
  });

  it("omits chip when multiple candidates and no single tenancy", () => {
    const raw = JSON.stringify({
      error: "pick one",
      candidates: [{ tenancy_id: "a" }, { tenancy_id: "b" }],
    });
    expect(suggestedActionsFromStartTenantOnboarding(raw)).toEqual([]);
  });
});

describe("mergeSuggestedActionsFromTools", () => {
  it("includes start_tenant_onboarding deep link", () => {
    const id = "11111111-2222-4333-a444-555555555555";
    const merged = mergeSuggestedActionsFromTools([
      { name: "start_tenant_onboarding", raw: JSON.stringify({ tenancy_id: id, success: true }) },
    ]);
    expect(merged.some((a) => a.kind === "link" && a.href === `/dashboard/tenancies/${id}`)).toBe(
      true,
    );
  });
});
