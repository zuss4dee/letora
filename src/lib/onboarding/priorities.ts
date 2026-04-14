import { z } from "zod";

export const MAX_ONBOARDING_PRIORITIES = 4;

export const FOCUS_OPTION_IDS = [
  "automate_rent",
  "legal_compliance",
  "lead_management",
  "maintenance_repairs",
  "tenancy_lifecycle",
  "landlord_reporting",
  "referencing_screening",
] as const;

export type FocusOptionId = (typeof FOCUS_OPTION_IDS)[number];

export const focusOptionIdSchema = z.enum(FOCUS_OPTION_IDS);

/** 1–4 unique priorities, stored as JSON array string in `onboarding_primary_goal`. */
export const focusSelectionSchema = z
  .array(focusOptionIdSchema)
  .min(1, "Choose at least one priority.")
  .max(MAX_ONBOARDING_PRIORITIES, `Choose at most ${MAX_ONBOARDING_PRIORITIES} priorities.`)
  .refine((arr) => new Set(arr).size === arr.length, "Each priority can only be selected once.");

export const FOCUS_OPTIONS: readonly {
  id: FocusOptionId;
  title: string;
  line: string;
}[] = [
  {
    id: "automate_rent",
    title: "Automate rent",
    line: "Chasers, reminders, and rent roll in one place.",
  },
  {
    id: "legal_compliance",
    title: "Legal compliance",
    line: "Certificates and deadlines before they cost you.",
  },
  {
    id: "lead_management",
    title: "Lead management",
    line: "Qualify enquiries and move the right tenants faster.",
  },
  {
    id: "maintenance_repairs",
    title: "Maintenance & repairs",
    line: "Track issues, contractors, and property condition.",
  },
  {
    id: "tenancy_lifecycle",
    title: "Tenancies & contracts",
    line: "Onboarding, paperwork, and renewals without the scramble.",
  },
  {
    id: "landlord_reporting",
    title: "Portfolio reporting",
    line: "Occupancy, yield, and performance across your stock.",
  },
  {
    id: "referencing_screening",
    title: "Referencing & screening",
    line: "Vetting, guarantors, and move-in readiness.",
  },
] as const;

/** Legacy single-value column before multi-select JSON. */
const LEGACY_DB_SLUG_TO_ID: Record<string, FocusOptionId> = {
  automate_rent: "automate_rent",
  stay_compliant: "legal_compliance",
  find_leads: "lead_management",
};

const ALLOWED = new Set<string>(FOCUS_OPTION_IDS);

/** Parse `onboarding_primary_goal`: JSON array of ids, or legacy single slug. */
export function parseStoredPrimaryGoals(raw: string | null | undefined): FocusOptionId[] {
  if (!raw?.trim()) return [];
  const t = raw.trim();
  try {
    const parsed = JSON.parse(t) as unknown;
    if (Array.isArray(parsed)) {
      const out: FocusOptionId[] = [];
      for (const x of parsed) {
        if (typeof x === "string" && ALLOWED.has(x)) out.push(x as FocusOptionId);
      }
      return out.slice(0, MAX_ONBOARDING_PRIORITIES);
    }
  } catch {
    /* single legacy string */
  }
  const legacy = LEGACY_DB_SLUG_TO_ID[t];
  return legacy ? [legacy] : [];
}

export function serializePrimaryGoals(ids: FocusOptionId[]): string {
  const unique = [...new Set(ids)];
  return JSON.stringify(unique.slice(0, MAX_ONBOARDING_PRIORITIES));
}
