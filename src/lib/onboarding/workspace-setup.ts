/**
 * Core gate for the guided onboarding wizard: landlord name + first property.
 * Tenants are added later from the Tenants page or batch-import — not inside the wizard —
 * so they're surfaced in the dashboard checklist instead of trapping users on /onboarding.
 */
export function isWorkspaceSetupIncomplete(input: {
  landlordName: string | null | undefined;
  propertyCount: number;
  /** Kept for API compatibility with the dashboard checklist input shape; intentionally unused here. */
  tenantCount?: number;
}): boolean {
  if (!input.landlordName?.trim()) return true;
  if (input.propertyCount < 1) return true;
  return false;
}

export type WorkspaceSetupChecklistItem = {
  id: string;
  label: string;
  href: string;
  done: boolean;
};

function hasValidContactEmail(email: string | null | undefined): boolean {
  const t = email?.trim() ?? "";
  return t.includes("@") && t.length > 3;
}

export type WorkspaceSetupChecklistInput = {
  businessName: string | null | undefined;
  landlordName: string | null | undefined;
  contactEmail: string | null | undefined;
  emailFromName: string | null | undefined;
  hasSeenTour: boolean;
  propertyCount: number;
  tenantCount: number;
  tenancyCount: number;
  complianceCount: number;
};

/** Ordered checklist for the dashboard; each row ticks off when `done` becomes true. */
export function buildWorkspaceSetupChecklist(input: WorkspaceSetupChecklistInput): WorkspaceSetupChecklistItem[] {
  const items: WorkspaceSetupChecklistItem[] = [];

  const portfolioDone = (input.businessName?.trim() ?? "").length >= 2;
  items.push({
    id: "portfolio",
    label: "Add your business or portfolio name",
    href: "/dashboard/settings",
    done: portfolioDone,
  });

  const landlordContactDone =
    (input.landlordName?.trim() ?? "").length >= 2 && hasValidContactEmail(input.contactEmail);
  items.push({
    id: "landlord_contact",
    label: "Add your landlord name and contact email",
    href: "/dashboard/settings",
    done: landlordContactDone,
  });

  items.push({
    id: "property",
    label: "Add your first property",
    href: "/dashboard/properties",
    done: input.propertyCount >= 1,
  });

  items.push({
    id: "tenant",
    label: "Add your first tenant",
    href: "/dashboard/tenants",
    done: input.tenantCount >= 1,
  });

  items.push({
    id: "tenancy",
    label: "Create a tenancy (link a tenant to a property)",
    href: "/dashboard/tenancies",
    done: input.tenancyCount >= 1,
  });

  if (input.propertyCount >= 1) {
    items.push({
      id: "compliance",
      label: "Add a compliance certificate (gas, EPC, or electrical)",
      href: "/dashboard/compliance",
      done: input.complianceCount >= 1,
    });
  }

  const emailAutomationDone = (input.emailFromName?.trim() ?? "").length >= 1;
  items.push({
    id: "email_automation",
    label: "Confirm email sender name and automation in Settings",
    href: "/dashboard/settings?tab=email",
    done: emailAutomationDone,
  });

  items.push({
    id: "tour",
    label: "Complete the dashboard product tour",
    href: "/dashboard",
    done: input.hasSeenTour === true,
  });

  return items;
}

export function workspaceSetupChecklistHasIncomplete(items: WorkspaceSetupChecklistItem[]): boolean {
  return items.some((i) => !i.done);
}

/** Incomplete tasks only — for the dashboard card (skip users see many; post-onboarding users see what’s left). */
export type WorkspaceSetupPendingItem = { id: string; label: string; href: string };

export function pendingWorkspaceSetupItems(checklist: WorkspaceSetupChecklistItem[]): WorkspaceSetupPendingItem[] {
  return checklist.filter((i) => !i.done).map(({ id, label, href }) => ({ id, label, href }));
}
