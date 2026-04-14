import { z } from "zod";

import { requiredEmailSchema } from "@/lib/validations/email";

const SOURCE_OPTIONS = [
  "Rightmove",
  "Zoopla",
  "OnTheMarket",
  "Referral",
  "Walk-in",
  "Social Media",
  "Other",
] as const;

export const LEAD_SOURCE_OPTIONS = SOURCE_OPTIONS;

/** Sentinel for optional Select (Radix disallows value=""). */
export const LEAD_OPTION_NONE = "__none__" as const;

export const addLeadSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: requiredEmailSchema,
  phone: z.string().optional(),
  propertyId: z
    .string()
    .optional()
    .transform((v) =>
      v === undefined || v === "" || v === LEAD_OPTION_NONE ? undefined : v,
    )
    .pipe(z.union([z.string().uuid(), z.undefined()])),
  source: z
    .string()
    .optional()
    .transform((v) =>
      v === undefined || v === "" || v === LEAD_OPTION_NONE ? undefined : v,
    )
    .pipe(z.union([z.enum(SOURCE_OPTIONS), z.undefined()])),
  budget: z.number().positive().optional(),
  moveInDate: z.string().optional(),
  notes: z.string().optional(),
});

/** Parsed / API shape after Zod transforms */
export type AddLeadInput = z.infer<typeof addLeadSchema>;

/** react-hook-form values before transforms (e.g. Select sentinels) */
export type AddLeadFormValues = z.input<typeof addLeadSchema>;
