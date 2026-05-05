/**
 * Idempotent demo seed for a single landlord account (by auth email).
 *
 * Usage (requires service role — never expose in client):
 *   npx --yes tsx scripts/seed-benue-demo-account.ts
 *
 * Loads `.env.local` from the repo root when present (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).
 *
 * Safety:
 * - Deletes **all pending** agent_approvals for the target user before reseed (clears rent-chaser
 *   rows that are not demo-title-prefixed, so reruns do not accumulate).
 * - Only touches portfolio rows tagged with DEMO_PROPERTY_PREFIX / DEMO_EMAIL_SUFFIX / DEMO_RENT_NOTE,
 *   demo leads (`DEMO_LEAD_NOTE`), and demo agent runs (`DEMO_AGENT_RUN_TYPE`).
 * - Resolves user by exact email match; aborts if not found.
 *
 * Demo timeline:
 * - Tenancy dates, rent instalments, onboarding task due dates, leads move-in, and maintenance
 *   resolved_at are anchored to the seed run’s UTC calendar date so Command Center / Rent Tracker
 *   “current month”, arrears, and due-soon behaviour stay coherent without hand-editing SQL.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

function loadDotEnvLocal(): void {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
  } catch {
    /* optional file */
  }
}

loadDotEnvLocal();

/** Seed touches many tables; project `Database` type is intentionally partial — use untyped client here. */
type SeedSupabase = SupabaseClient;

const TARGET_EMAIL = "benueholdings@gmail.com";

/** Use a LIKE-safe prefix (avoid leading `[` which is special in SQL LIKE). */
const DEMO_PROPERTY_PREFIX = "Letora demo — ";

const DEMO_EMAIL_SUFFIX = "@tenant.letora.demo";

const DEMO_TITLE_PREFIX = "Letora demo — ";

const DEMO_RENT_NOTE = "Letora demo seed";

/** Tag demo leads for idempotent wipe (see wipeDemoPortfolio). */
const DEMO_LEAD_NOTE = "Letora demo seed — lead";

/**
 * Synthetic queued agent run for Command Center "active agents" KPI.
 * Removed on each seed run before insert.
 */
const DEMO_AGENT_RUN_TYPE = "demo_queued_run";

type UUID = string;

/** UTC calendar date YYYY-MM-DD (matches app KPIs using `toISOString().slice(0, 10)`). */
function utcYmd(year: number, monthIndex0: number, day: number): string {
  return new Date(Date.UTC(year, monthIndex0, day)).toISOString().slice(0, 10);
}

function shiftMonth(year: number, monthIndex0: number, deltaMonths: number): [number, number] {
  const t = new Date(Date.UTC(year, monthIndex0 + deltaMonths, 1));
  return [t.getUTCFullYear(), t.getUTCMonth()];
}

function leaseEndDayBeforeAnniversary(startIso: string): string {
  const parts = startIso.split("-").map(Number);
  const ys = parts[0]!;
  const ms = parts[1]!;
  const ds = parts[2]!;
  const end = new Date(Date.UTC(ys + 1, ms - 1, ds));
  end.setUTCDate(end.getUTCDate() - 1);
  return end.toISOString().slice(0, 10);
}

function daysBetweenInclusiveUtc(startIso: string, endIso: string): number {
  const a = Date.UTC(+startIso.slice(0, 4), +startIso.slice(5, 7) - 1, +startIso.slice(8, 10));
  const b = Date.UTC(+endIso.slice(0, 4), +endIso.slice(5, 7) - 1, +endIso.slice(8, 10));
  return Math.floor((b - a) / 86400000);
}

function addUtcDays(iso: string, deltaDays: number): string {
  const parts = iso.split("-").map(Number);
  const yy = parts[0]!;
  const mm = parts[1]!;
  const dd = parts[2]!;
  const t = new Date(Date.UTC(yy, mm - 1, dd + deltaDays));
  return t.toISOString().slice(0, 10);
}

type DemoAnchor = {
  todayIso: string;
  /** First of anchor month (UTC). */
  monthStart: (offsetFromAnchorMonth: number) => string;
  /** Day N within month offset from anchor (clamped to month length). */
  monthDay: (offsetFromAnchorMonth: number, day: number) => string;
};

function buildDemoAnchor(now: Date): DemoAnchor {
  const y = now.getUTCFullYear();
  const mon = now.getUTCMonth();
  const todayIso = now.toISOString().slice(0, 10);

  const monthStart = (offset: number): string => {
    const [yy, mm] = shiftMonth(y, mon, offset);
    return utcYmd(yy, mm, 1);
  };

  const monthDay = (offset: number, day: number): string => {
    const [yy, mm] = shiftMonth(y, mon, offset);
    const lastDay = new Date(Date.UTC(yy, mm + 1, 0)).getUTCDate();
    return utcYmd(yy, mm, Math.min(day, lastDay));
  };

  return { todayIso, monthStart, monthDay };
}

function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) {
    console.error(`Missing ${name} in environment (.env.local).`);
    process.exit(1);
  }
  return v;
}

async function resolveAuthUserId(supabase: SeedSupabase, email: string): Promise<UUID> {
  const target = email.trim().toLowerCase();
  let page = 1;
  const perPage = 200;
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) {
      console.error("auth.admin.listUsers failed:", error.message);
      process.exit(1);
    }
    const found = (data.users ?? []).find((u: { id?: string; email?: string | null }) => {
      return (u.email ?? "").toLowerCase() === target;
    });
    if (found?.id) return found.id;
    if (data.users.length < perPage) break;
    page += 1;
  }
  console.error(`No auth user found with email ${email}. Create the account in Supabase Auth first.`);
  process.exit(1);
}

async function wipeDemoPortfolio(supabase: SeedSupabase, userId: UUID): Promise<void> {
  /**
   * Must run **before** any early return. Clears every pending approval for this account so
   * agent-created rows (e.g. rent chase titles without DEMO_TITLE_PREFIX) do not accumulate.
   */
  const { error: apErr } = await supabase
    .from("agent_approvals")
    .delete()
    .eq("user_id", userId)
    .eq("status", "pending");
  if (apErr) {
    console.error("Failed to delete pending agent_approvals:", apErr.message);
    process.exit(1);
  }

  const { error: runWipeErr } = await supabase
    .from("agent_runs")
    .delete()
    .eq("user_id", userId)
    .eq("agent_type", DEMO_AGENT_RUN_TYPE);
  if (runWipeErr) {
    console.error("Failed to delete demo agent_runs:", runWipeErr.message);
    process.exit(1);
  }

  const { error: leadWipeErr } = await supabase.from("leads").delete().eq("user_id", userId).eq("notes", DEMO_LEAD_NOTE);
  if (leadWipeErr) {
    console.error("Failed to delete demo leads:", leadWipeErr.message);
    process.exit(1);
  }

  const { data: demoProperties, error: pErr } = await supabase
    .from("properties")
    .select("id")
    .eq("user_id", userId)
    .like("address", `${DEMO_PROPERTY_PREFIX}%`);

  if (pErr) {
    console.error("Failed to list demo properties:", pErr.message);
    process.exit(1);
  }

  const propertyIds = (demoProperties ?? []).map((r: { id: string }) => r.id);
  if (propertyIds.length === 0) {
    const { error: rpStrayErr } = await supabase
      .from("rent_payments")
      .delete()
      .eq("user_id", userId)
      .eq("notes", DEMO_RENT_NOTE);
    if (rpStrayErr) {
      console.error("Failed to delete stray demo rent_payments:", rpStrayErr.message);
      process.exit(1);
    }
    const { data: strayTenants, error: stErr } = await supabase
      .from("tenants")
      .select("id")
      .eq("user_id", userId)
      .like("email", `%${DEMO_EMAIL_SUFFIX}`);
    if (stErr) {
      console.error("Failed to list stray demo tenants:", stErr.message);
      process.exit(1);
    }
    const strayTenantIds = (strayTenants ?? []).map((r: { id: string }) => r.id);
    if (strayTenantIds.length > 0) {
      const { data: strayTenancies, error: stnErr } = await supabase
        .from("tenancies")
        .select("id")
        .in("tenant_id", strayTenantIds);
      if (stnErr) {
        console.error("Failed to list stray demo tenancies:", stnErr.message);
        process.exit(1);
      }
      const strayTenancyIds = (strayTenancies ?? []).map((r: { id: string }) => r.id);
      if (strayTenancyIds.length > 0) {
        for (const table of ["rent_payments", "maintenance_requests", "onboarding_tasks", "referencing_events"] as const) {
          const { error } = await supabase.from(table).delete().in("tenancy_id", strayTenancyIds);
          if (error) {
            console.error(`Failed stray delete from ${table}:`, error.message);
            process.exit(1);
          }
        }
        const { error: stnDelErr } = await supabase.from("tenancies").delete().in("id", strayTenancyIds);
        if (stnDelErr) {
          console.error("Failed to delete stray demo tenancies:", stnDelErr.message);
          process.exit(1);
        }
      }
      const { error: tenStrayDelErr } = await supabase
        .from("tenants")
        .delete()
        .eq("user_id", userId)
        .like("email", `%${DEMO_EMAIL_SUFFIX}`);
      if (tenStrayDelErr) {
        console.error("Failed to delete stray demo tenants:", tenStrayDelErr.message);
        process.exit(1);
      }
    }
    console.log("No previous demo properties to remove (cleared pending approvals + stray tagged rows).");
    return;
  }

  const { data: demoTenancies, error: tErr } = await supabase
    .from("tenancies")
    .select("id")
    .in("property_id", propertyIds);

  if (tErr) {
    console.error("Failed to list demo tenancies:", tErr.message);
    process.exit(1);
  }

  const tenancyIds = (demoTenancies ?? []).map((r: { id: string }) => r.id);

  if (tenancyIds.length > 0) {
    for (const table of ["rent_payments", "maintenance_requests", "onboarding_tasks", "referencing_events"] as const) {
      const { error } = await supabase.from(table).delete().in("tenancy_id", tenancyIds);
      if (error) {
        console.error(`Failed to delete from ${table}:`, error.message);
        process.exit(1);
      }
    }
  }

  const { error: tnDelErr } = await supabase.from("tenancies").delete().in("property_id", propertyIds);
  if (tnDelErr) {
    console.error("Failed to delete demo tenancies:", tnDelErr.message);
    process.exit(1);
  }

  const { error: prDelErr } = await supabase.from("properties").delete().in("id", propertyIds);
  if (prDelErr) {
    console.error("Failed to delete demo properties:", prDelErr.message);
    process.exit(1);
  }

  const { error: tenDelErr } = await supabase
    .from("tenants")
    .delete()
    .eq("user_id", userId)
    .like("email", `%${DEMO_EMAIL_SUFFIX}`);

  if (tenDelErr) {
    console.error("Failed to delete demo tenants:", tenDelErr.message);
    process.exit(1);
  }

  console.log(
    `Removed previous demo: ${propertyIds.length} properties, ${tenancyIds.length} tenancies (plus linked rows).`,
  );
}

function demoEmail(local: string): string {
  return `${local}${DEMO_EMAIL_SUFFIX}`;
}

async function main(): Promise<void> {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  const supabase: SeedSupabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const userId = await resolveAuthUserId(supabase, TARGET_EMAIL);
  console.log(`Resolved ${TARGET_EMAIL} → user_id ${userId}`);

  await wipeDemoPortfolio(supabase, userId);

  const anchor = buildDemoAnchor(new Date());
  const { todayIso, monthStart, monthDay } = anchor;

  const tenantsInsert = [
    {
      id: randomUUID(),
      user_id: userId,
      full_name: "Maya Chen",
      email: demoEmail("maya.chen"),
      phone: "+44 7700 900001",
      right_to_rent_status: "pending",
    },
    {
      id: randomUUID(),
      user_id: userId,
      full_name: "Oliver Reed",
      email: demoEmail("oliver.reed"),
      phone: "+44 7700 900002",
      right_to_rent_status: "pending",
    },
    {
      id: randomUUID(),
      user_id: userId,
      full_name: "Priya Sharma",
      email: demoEmail("priya.sharma"),
      phone: "+44 7700 900003",
      right_to_rent_status: "verified",
    },
    {
      id: randomUUID(),
      user_id: userId,
      full_name: "James Walsh",
      email: demoEmail("james.walsh"),
      phone: "+44 7700 900004",
      right_to_rent_status: "verified",
    },
    {
      id: randomUUID(),
      user_id: userId,
      full_name: "Amara Okoro",
      email: demoEmail("amara.okoro"),
      phone: "+44 7700 900005",
      right_to_rent_status: "verified",
    },
    {
      id: randomUUID(),
      user_id: userId,
      full_name: "Noah Fischer",
      email: demoEmail("noah.fischer"),
      phone: "+44 7700 900006",
      right_to_rent_status: "verified",
    },
    {
      id: randomUUID(),
      user_id: userId,
      full_name: "Elena Rossi",
      email: demoEmail("elena.rossi"),
      phone: "+44 7700 900007",
      right_to_rent_status: "verified",
    },
    {
      id: randomUUID(),
      user_id: userId,
      full_name: "Sofia Martins",
      email: demoEmail("sofia.martins"),
      phone: "+44 7700 900008",
      right_to_rent_status: "verified",
    },
  ] as const;

  const tenantByKey = {
    maya: tenantsInsert[0],
    oliver: tenantsInsert[1],
    priya: tenantsInsert[2],
    james: tenantsInsert[3],
    amara: tenantsInsert[4],
    noah: tenantsInsert[5],
    elena: tenantsInsert[6],
    sofia: tenantsInsert[7],
  };

  const propertiesInsert = [
    {
      id: randomUUID(),
      user_id: userId,
      address: `${DEMO_PROPERTY_PREFIX}Flat 12, Bridge House, 88 Whitworth Street`,
      postcode: "M1 5BD",
      city: "Manchester",
      property_type: "flat",
      bedrooms: 2,
      bathrooms: 1,
      monthly_rent: 1250,
      status: "active",
    },
    {
      id: randomUUID(),
      user_id: userId,
      address: `${DEMO_PROPERTY_PREFIX}4 Crescent Road, Clifton`,
      postcode: "BS8 2ND",
      city: "Bristol",
      property_type: "house",
      bedrooms: 3,
      bathrooms: 2,
      monthly_rent: 1895,
      status: "active",
    },
    {
      id: randomUUID(),
      user_id: userId,
      address: `${DEMO_PROPERTY_PREFIX}Studio 3, Market Lane Lofts`,
      postcode: "LS1 4DY",
      city: "Leeds",
      property_type: "studio",
      bedrooms: 1,
      bathrooms: 1,
      monthly_rent: 895,
      status: "active",
    },
  ] as const;

  const propMcr = propertiesInsert[0];
  const propBristol = propertiesInsert[1];
  const propLeeds = propertiesInsert[2];

  const { error: pInsErr } = await supabase.from("properties").insert([...propertiesInsert]);
  if (pInsErr) {
    console.error("properties insert:", pInsErr.message);
    process.exit(1);
  }

  const { error: tnInsErr } = await supabase.from("tenants").insert([...tenantsInsert]);
  if (tnInsErr) {
    console.error("tenants insert:", tnInsErr.message);
    process.exit(1);
  }

  const oliverStart = monthStart(0);
  const priyaStart = monthDay(-1, 15);
  const jamesStart = monthStart(-2);
  const amaraStart = monthStart(-3);
  const noahStart = monthStart(-6);
  const elenaStart = monthStart(-8);
  const sofiaStart = monthStart(-9);

  const tenanciesInsert = [
    {
      id: randomUUID(),
      property_id: propMcr.id,
      tenant_id: tenantByKey.oliver.id,
      start_date: oliverStart,
      end_date: leaseEndDayBeforeAnniversary(oliverStart),
      move_in_date: monthDay(0, 8),
      monthly_rent: 1200,
      deposit_amount: 1200,
      deposit_protected: false,
      status: "pending",
      onboarding_status: "not_started",
    },
    {
      id: randomUUID(),
      property_id: propMcr.id,
      tenant_id: tenantByKey.priya.id,
      start_date: priyaStart,
      end_date: leaseEndDayBeforeAnniversary(priyaStart),
      move_in_date: monthDay(-1, 20),
      monthly_rent: 1180,
      deposit_amount: 1180,
      deposit_protected: true,
      status: "pending",
      onboarding_status: "in_progress",
    },
    {
      id: randomUUID(),
      property_id: propBristol.id,
      tenant_id: tenantByKey.james.id,
      start_date: jamesStart,
      end_date: leaseEndDayBeforeAnniversary(jamesStart),
      move_in_date: monthDay(-2, 7),
      monthly_rent: 1850,
      deposit_amount: 1850,
      deposit_protected: true,
      status: "pending",
      onboarding_status: "references",
    },
    {
      id: randomUUID(),
      property_id: propBristol.id,
      tenant_id: tenantByKey.amara.id,
      start_date: amaraStart,
      end_date: leaseEndDayBeforeAnniversary(amaraStart),
      move_in_date: monthDay(-3, 10),
      monthly_rent: 1825,
      deposit_amount: 1825,
      deposit_protected: true,
      status: "pending",
      onboarding_status: "pending_signature",
    },
    {
      id: randomUUID(),
      property_id: propBristol.id,
      tenant_id: tenantByKey.noah.id,
      start_date: noahStart,
      end_date: leaseEndDayBeforeAnniversary(noahStart),
      move_in_date: monthDay(0, 12),
      monthly_rent: 1795,
      deposit_amount: 1795,
      deposit_protected: true,
      status: "pending",
      onboarding_status: "signed",
    },
    {
      id: randomUUID(),
      property_id: propLeeds.id,
      tenant_id: tenantByKey.elena.id,
      start_date: elenaStart,
      end_date: leaseEndDayBeforeAnniversary(elenaStart),
      move_in_date: monthDay(-8, 5),
      monthly_rent: 895,
      deposit_amount: 895,
      deposit_protected: true,
      status: "active",
      onboarding_status: "complete",
    },
    {
      id: randomUUID(),
      property_id: propLeeds.id,
      tenant_id: tenantByKey.sofia.id,
      start_date: sofiaStart,
      end_date: leaseEndDayBeforeAnniversary(sofiaStart),
      move_in_date: monthDay(-9, 8),
      monthly_rent: 920,
      deposit_amount: 920,
      deposit_protected: true,
      status: "active",
      onboarding_status: "complete",
    },
  ] as const;

  const tn = {
    oliver: tenanciesInsert[0],
    priya: tenanciesInsert[1],
    james: tenanciesInsert[2],
    amara: tenanciesInsert[3],
    noah: tenanciesInsert[4],
    elena: tenanciesInsert[5],
    sofia: tenanciesInsert[6],
  };

  const { error: tyInsErr } = await supabase.from("tenancies").insert([...tenanciesInsert]);
  if (tyInsErr) {
    console.error("tenancies insert:", tyInsErr.message);
    process.exit(1);
  }

  const onboardingTasksPriya = [
    {
      tenancy_id: tn.priya.id,
      user_id: userId,
      task_name: "Welcome email",
      task_type: "email",
      status: "complete",
      email_log_id: null as string | null,
      due_date: null as string | null,
      completed_at: new Date().toISOString(),
    },
    {
      tenancy_id: tn.priya.id,
      user_id: userId,
      task_name: "Photo ID verification",
      task_type: "check",
      status: "pending",
      email_log_id: null,
      due_date: addUtcDays(todayIso, 7),
      completed_at: null as string | null,
    },
    {
      tenancy_id: tn.priya.id,
      user_id: userId,
      task_name: "Employment reference request",
      task_type: "check",
      status: "pending",
      email_log_id: null,
      due_date: addUtcDays(todayIso, 11),
      completed_at: null,
    },
    {
      tenancy_id: tn.priya.id,
      user_id: userId,
      task_name: "Prepare tenancy agreement (contract not sent by agent)",
      task_type: "manual",
      status: "pending",
      email_log_id: null,
      due_date: null,
      completed_at: null,
    },
  ];

  const onboardingTasksJames = [
    {
      tenancy_id: tn.james.id,
      user_id: userId,
      task_name: "Welcome email",
      task_type: "email",
      status: "complete",
      email_log_id: null,
      due_date: null,
      completed_at: new Date().toISOString(),
    },
    {
      tenancy_id: tn.james.id,
      user_id: userId,
      task_name: "Photo ID verification",
      task_type: "check",
      status: "complete",
      email_log_id: null,
      due_date: null,
      completed_at: new Date().toISOString(),
    },
    {
      tenancy_id: tn.james.id,
      user_id: userId,
      task_name: "Employment reference request",
      task_type: "check",
      status: "pending",
      email_log_id: null,
      due_date: addUtcDays(todayIso, 5),
      completed_at: null,
    },
    {
      tenancy_id: tn.james.id,
      user_id: userId,
      task_name: "Previous landlord reference",
      task_type: "check",
      status: "pending",
      email_log_id: null,
      due_date: addUtcDays(todayIso, 6),
      completed_at: null,
    },
  ];

  const { error: otErr } = await supabase
    .from("onboarding_tasks")
    .insert([...onboardingTasksPriya, ...onboardingTasksJames]);
  if (otErr) {
    console.error("onboarding_tasks insert:", otErr.message);
    process.exit(1);
  }

  const refEventJames = {
    id: randomUUID(),
    user_id: userId,
    tenancy_id: tn.james.id,
    direction: "outbound" as const,
    subject: "Referencing pack — James Walsh",
    body_preview: "Please find referencing details for the applicant at 4 Crescent Road…",
    outcome: "awaiting_agency",
  };

  const { error: reErr } = await supabase.from("referencing_events").insert([refEventJames]);
  if (reErr) {
    console.error("referencing_events insert:", reErr.message);
    process.exit(1);
  }

  /** Paid-on-time simulation: a few days after due, but never dated in the future vs seed run day. */
  const paidSoonAfterDue = (dueIso: string, daysAfterDue: number): string => {
    const target = addUtcDays(dueIso, daysAfterDue);
    return target <= todayIso ? target : todayIso;
  };

  const dueArrearsOldest = monthStart(-2);
  const duePrev = monthStart(-1);
  const dueCurr = monthStart(0);
  const dueNext = monthStart(1);

  const rp = (
    id: string,
    tenancyId: string,
    propertyId: string,
    tenantId: string,
    amount: number,
    due: string,
    paid: string | null,
    status: string,
  ) => ({
    id,
    user_id: userId,
    tenancy_id: tenancyId,
    property_id: propertyId,
    tenant_id: tenantId,
    amount,
    due_date: due,
    paid_date: paid,
    status,
    notes: DEMO_RENT_NOTE,
  });

  const firstRentDueApplies = (tenancyStartIso: string, dueIso: string): boolean =>
    tenancyStartIso.slice(0, 10) <= dueIso;

  const rentElenaPrev = randomUUID();
  const rentElenaCurr = randomUUID();
  const rentElenaNext = randomUUID();
  const rentSofiaOldest = randomUUID();
  const rentSofiaPrev = randomUUID();
  const rentSofiaCurr = randomUUID();
  const rentSofiaNext = randomUUID();
  const rentJamesPrev = randomUUID();
  const rentJamesCurr = randomUUID();
  const rentJamesNext = randomUUID();
  const rentAmaraPrev = randomUUID();
  const rentAmaraCurr = randomUUID();
  const rentAmaraNext = randomUUID();
  const rentNoahPrev = randomUUID();
  const rentNoahCurr = randomUUID();
  const rentNoahNext = randomUUID();
  const rentPriyaCurr = randomUUID();
  const rentPriyaNext = randomUUID();
  const rentOliverNext = randomUUID();

  const rentRows: ReturnType<typeof rp>[] = [];

  /* Elena — reliable payer: previous + current month paid on time; next month upcoming */
  if (firstRentDueApplies(elenaStart, duePrev)) {
    rentRows.push(
      rp(rentElenaPrev, tn.elena.id, propLeeds.id, tenantByKey.elena.id, 895, duePrev, paidSoonAfterDue(duePrev, 2), "paid"),
    );
  }
  rentRows.push(
    rp(rentElenaCurr, tn.elena.id, propLeeds.id, tenantByKey.elena.id, 895, dueCurr, paidSoonAfterDue(dueCurr, 2), "paid"),
    rp(rentElenaNext, tn.elena.id, propLeeds.id, tenantByKey.elena.id, 895, dueNext, null, "pending"),
  );

  /* Sofia — rolling arrears: three overdue instalments + upcoming (Market Lane Lofts narrative) */
  rentRows.push(
    rp(rentSofiaOldest, tn.sofia.id, propLeeds.id, tenantByKey.sofia.id, 920, dueArrearsOldest, null, "overdue"),
    rp(rentSofiaPrev, tn.sofia.id, propLeeds.id, tenantByKey.sofia.id, 920, duePrev, null, "overdue"),
    rp(rentSofiaCurr, tn.sofia.id, propLeeds.id, tenantByKey.sofia.id, 920, dueCurr, null, "overdue"),
    rp(rentSofiaNext, tn.sofia.id, propLeeds.id, tenantByKey.sofia.id, 920, dueNext, null, "pending"),
  );

  /* James — on-time payer */
  if (firstRentDueApplies(jamesStart, duePrev)) {
    rentRows.push(
      rp(rentJamesPrev, tn.james.id, propBristol.id, tenantByKey.james.id, 1850, duePrev, paidSoonAfterDue(duePrev, 3), "paid"),
    );
  }
  rentRows.push(
    rp(rentJamesCurr, tn.james.id, propBristol.id, tenantByKey.james.id, 1850, dueCurr, paidSoonAfterDue(dueCurr, 1), "paid"),
    rp(rentJamesNext, tn.james.id, propBristol.id, tenantByKey.james.id, 1850, dueNext, null, "pending"),
  );

  /* Amara — paid late last month; current month unpaid (shows overdue in UI when due < today) */
  if (firstRentDueApplies(amaraStart, duePrev)) {
    rentRows.push(
      rp(rentAmaraPrev, tn.amara.id, propBristol.id, tenantByKey.amara.id, 1825, duePrev, paidSoonAfterDue(duePrev, 6), "paid"),
    );
  }
  rentRows.push(
    rp(rentAmaraCurr, tn.amara.id, propBristol.id, tenantByKey.amara.id, 1825, dueCurr, null, "pending"),
    rp(rentAmaraNext, tn.amara.id, propBristol.id, tenantByKey.amara.id, 1825, dueNext, null, "pending"),
  );

  /* Noah — paid on time previously; current month paid a few days late; next unpaid */
  if (firstRentDueApplies(noahStart, duePrev)) {
    rentRows.push(
      rp(rentNoahPrev, tn.noah.id, propBristol.id, tenantByKey.noah.id, 1795, duePrev, paidSoonAfterDue(duePrev, 2), "paid"),
    );
  }
  rentRows.push(
    rp(rentNoahCurr, tn.noah.id, propBristol.id, tenantByKey.noah.id, 1795, dueCurr, paidSoonAfterDue(dueCurr, 4), "paid"),
    rp(rentNoahNext, tn.noah.id, propBristol.id, tenantByKey.noah.id, 1795, dueNext, null, "pending"),
  );

  /* Priya — first anchor-month cycle after mid-month start (skip prior month’s 1st if before tenancy start) */
  if (firstRentDueApplies(priyaStart, dueCurr)) {
    rentRows.push(
      rp(rentPriyaCurr, tn.priya.id, propMcr.id, tenantByKey.priya.id, 1180, dueCurr, paidSoonAfterDue(dueCurr, 2), "paid"),
    );
  }
  rentRows.push(rp(rentPriyaNext, tn.priya.id, propMcr.id, tenantByKey.priya.id, 1180, dueNext, null, "pending"));

  /* Oliver — first instalment next month (setup / move-in month on current anchor month) */
  if (firstRentDueApplies(oliverStart, dueNext)) {
    rentRows.push(
      rp(rentOliverNext, tn.oliver.id, propMcr.id, tenantByKey.oliver.id, 1200, dueNext, null, "pending"),
    );
  }

  const sofiaArrearsAmount = 920 * 3;
  const sofiaChaseDaysOverdue = Math.max(1, daysBetweenInclusiveUtc(dueArrearsOldest, todayIso));

  const { error: rpErr } = await supabase.from("rent_payments").insert(rentRows);
  if (rpErr) {
    console.error("rent_payments insert:", rpErr.message);
    process.exit(1);
  }

  const maintLeak = randomUUID();
  const maintHeat = randomUUID();
  const maintIntercom = randomUUID();
  const maintFan = randomUUID();

  const { error: mErr } = await supabase.from("maintenance_requests").insert([
    {
      id: maintLeak,
      tenancy_id: tn.sofia.id,
      reported_by_tenant: true,
      description:
        "Water pooling under the kitchen sink; small leak from the trap when the tap runs.",
      category: "plumbing",
      priority: "urgent",
      status: "open",
      ai_triage_category: "urgent",
      ai_triage_summary: "Active leak — advise contractor attendance within 24–48h.",
    },
    {
      id: maintHeat,
      tenancy_id: tn.elena.id,
      reported_by_tenant: true,
      description: "Radiators stay cold on the top floor; boiler shows normal pressure.",
      category: "heating",
      priority: "standard",
      status: "in_progress",
      ai_triage_category: "routine",
      ai_triage_summary: "Likely balancing or valve issue; schedule heating engineer.",
    },
    {
      id: maintIntercom,
      tenancy_id: tn.priya.id,
      reported_by_tenant: true,
      description:
        "Buzzer at the main entrance not releasing the door strike for Flat 12 — visitors cannot get in.",
      category: "electrical",
      priority: "standard",
      status: "open",
      ai_triage_category: "routine",
      ai_triage_summary: "Intermittent entry system fault — check strike power & handset routing.",
    },
    {
      id: maintFan,
      tenancy_id: tn.james.id,
      reported_by_tenant: true,
      description:
        "Extractor fan in the ensuite stopped working; condensation after showers.",
      category: "electrical",
      priority: "standard",
      status: "completed",
      ai_triage_category: "routine",
      ai_triage_summary: "Motor replaced; humidity clears within ~10 minutes.",
      resolved_at: `${addUtcDays(todayIso, -18)}T14:30:00.000Z`,
    },
  ]);
  if (mErr) {
    console.error("maintenance_requests insert:", mErr.message);
    process.exit(1);
  }

  const approvals = [
    {
      id: randomUUID(),
      user_id: userId,
      agent_run_id: null as string | null,
      agent_type: "tenant_onboarding",
      title: `${DEMO_TITLE_PREFIX}Send welcome email — Oliver Reed`,
      summary: "Draft welcome email for a new tenancy at the Manchester flat. Approve to send from Letora.",
      action_type: "send_onboarding_email" as const,
      target_type: "tenancy",
      target_id: tn.oliver.id,
      payload: {
        tenancyId: tn.oliver.id,
        userId,
        emailLogId: null,
      },
      evidence: {
        tenantName: "Oliver Reed",
        tenantEmail: tenantByKey.oliver.email,
        propertyAddress: propMcr.address.replace(DEMO_PROPERTY_PREFIX, "").trim(),
        subject: "Welcome to your new tenancy",
        run_correlation_id: "demo-seed",
      },
      status: "pending" as const,
    },
    {
      id: randomUUID(),
      user_id: userId,
      agent_run_id: null,
      agent_type: "tenant_onboarding",
      title: `${DEMO_TITLE_PREFIX}Send move-in instructions — Noah Fischer`,
      summary:
        "Draft move-in instructions for the Clifton house tenancy ahead of keys day. Approve to send from Letora.",
      action_type: "send_move_in_email" as const,
      target_type: "tenancy",
      target_id: tn.noah.id,
      payload: {
        userId,
        tenancyId: tn.noah.id,
        emailSubject: "Move-in instructions — 4 Crescent Road, Clifton",
        emailBody: `Hi Noah,\n\nAhead of your scheduled move-in on ${monthDay(0, 12)}, here are meter locations, bin days, and access notes for the property.\n\nKind regards`,
      },
      evidence: {
        tenantId: tenantByKey.noah.id,
        tenantName: "Noah Fischer",
        tenantEmail: tenantByKey.noah.email,
        propertyAddress: propBristol.address.replace(DEMO_PROPERTY_PREFIX, "").trim(),
        moveInDate: monthDay(0, 12),
        subject: "Move-in instructions — 4 Crescent Road, Clifton",
        bodyPreview: `Ahead of your scheduled move-in on ${monthDay(0, 12)}, here are meter locations…`,
        run_correlation_id: "demo-seed",
      },
      status: "pending" as const,
    },
    {
      id: randomUUID(),
      user_id: userId,
      agent_run_id: null,
      agent_type: "rent_chaser",
      title: `${DEMO_TITLE_PREFIX}Rent chase — Sofia Martins`,
      summary:
        "Draft polite rent reminder covering three overdue instalments plus context on next month’s due date. Approve to send the chase email only (no payment collection).",
      action_type: "send_rent_chase_email" as const,
      target_type: "rent_payment",
      target_id: rentSofiaOldest,
      payload: {
        userId,
        rentPaymentId: rentSofiaOldest,
        tenantId: tenantByKey.sofia.id,
        propertyId: propLeeds.id,
        tenantEmail: tenantByKey.sofia.email,
        tenantName: "Sofia Martins",
        emailSubject: "Rent reminder — Market Lane Lofts",
        emailBody:
          "Hi Sofia,\n\nWe note multiple monthly instalments remain outstanding on your tenancy. Please confirm when payment will reach us, or reply if you’d like to discuss a repayment plan.\n\nKind regards",
        amountOwed: sofiaArrearsAmount,
        daysOverdue: sofiaChaseDaysOverdue,
        dueDate: dueArrearsOldest,
      },
      evidence: {
        tenantName: "Sofia Martins",
        tenantId: tenantByKey.sofia.id,
        propertyId: propLeeds.id,
        propertyAddress: propLeeds.address.replace(DEMO_PROPERTY_PREFIX, "").trim(),
        amountOwed: sofiaArrearsAmount,
        daysOverdue: sofiaChaseDaysOverdue,
        dueDate: dueArrearsOldest,
        emailSubject: "Rent reminder — Market Lane Lofts",
        bodyPreview: "We note multiple monthly instalments remain outstanding…",
        run_correlation_id: "demo-seed",
      },
      status: "pending" as const,
    },
    {
      id: randomUUID(),
      user_id: userId,
      agent_run_id: null,
      agent_type: "maintenance",
      title: `${DEMO_TITLE_PREFIX}Contractor dispatch — kitchen leak (Sofia Martins)`,
      summary:
        "Email the preferred plumber about the kitchen leak. Approve to send the dispatch email only.",
      action_type: "approve_maintenance_dispatch" as const,
      target_type: "maintenance_request",
      target_id: maintLeak,
      payload: {
        userId,
        maintenanceRequestId: maintLeak,
        tenancyId: tn.sofia.id,
        propertyId: propLeeds.id,
        contractorEmail: "repairs.demo@trades.example",
        contractorName: "North Leeds Plumbing",
        emailSubject: "Attendance request — leak under kitchen sink",
        emailBody:
          "Hi team,\n\nPlease could you attend Studio 3, Market Lane Lofts for an under-sink leak reported by the tenant.\n\nThanks",
        category: "plumbing",
        priority: "urgent",
      },
      evidence: {
        maintenanceRequestId: maintLeak,
        summary: "Water pooling under the kitchen sink when the tap runs.",
        run_correlation_id: "demo-seed",
      },
      status: "pending" as const,
    },
  ];

  const { error: apInsErr } = await supabase.from("agent_approvals").insert(approvals);
  if (apInsErr) {
    console.error("agent_approvals insert:", apInsErr.message);
    process.exit(1);
  }

  const { error: arErr } = await supabase.from("agent_runs").insert({
    user_id: userId,
    agent_type: DEMO_AGENT_RUN_TYPE,
    status: "queued",
    payload: {
      letora_demo_seed: true,
      label: "Demo: digest / portfolio scan queued",
    },
  });
  if (arErr) {
    console.error("agent_runs insert:", arErr.message);
    process.exit(1);
  }

  const { error: ldErr } = await supabase.from("leads").insert([
    {
      user_id: userId,
      property_id: propMcr.id,
      name: "Alex Thompson",
      full_name: "Alex Thompson",
      email: "alex.thompson@lead.letora.demo",
      phone: "+44 7700 900101",
      source: "Rightmove",
      budget: 1300,
      move_in_date: monthDay(1, 15),
      qualified_status: "pending",
      status: "new",
      notes: DEMO_LEAD_NOTE,
    },
    {
      user_id: userId,
      property_id: propBristol.id,
      name: "Jordan Lee",
      full_name: "Jordan Lee",
      email: "jordan.lee@lead.letora.demo",
      phone: "+44 7700 900102",
      source: "Zoopla",
      budget: 1950,
      move_in_date: monthDay(2, 1),
      qualified_status: "pending",
      status: "contacted",
      notes: DEMO_LEAD_NOTE,
    },
  ]);
  if (ldErr) {
    console.error("leads insert:", ldErr.message);
    process.exit(1);
  }

  const demoPropCount = await (async () => {
    const { count, error } = await supabase
      .from("properties")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .like("address", `${DEMO_PROPERTY_PREFIX}%`);
    if (error) return `? (${error.message})`;
    return String(count ?? 0);
  })();

  const demoTenantCount = await (async () => {
    const { count, error } = await supabase
      .from("tenants")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .like("email", `%${DEMO_EMAIL_SUFFIX}`);
    if (error) return `? (${error.message})`;
    return String(count ?? 0);
  })();

  const demoTenancyCount = await (async () => {
    const { data: ids } = await supabase
      .from("properties")
      .select("id")
      .eq("user_id", userId)
      .like("address", `${DEMO_PROPERTY_PREFIX}%`);
    const pids = (ids ?? []).map((r) => r.id);
    if (pids.length === 0) return "0";
    const { count, error } = await supabase
      .from("tenancies")
      .select("*", { count: "exact", head: true })
      .in("property_id", pids);
    if (error) return `? (${error.message})`;
    return String(count ?? 0);
  })();

  console.log("\n=== Demo seed complete ===");
  console.log(`Target user: ${userId}`);
  console.log(`Demo properties (tagged): ${demoPropCount}`);
  console.log(`Demo tenants (tagged email): ${demoTenantCount}`);
  console.log(`Demo tenancies (under demo properties): ${demoTenancyCount}`);
  const demoRentCount = await (async () => {
    const { count, error } = await supabase
      .from("rent_payments")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("notes", DEMO_RENT_NOTE);
    if (error) return `? (${error.message})`;
    return String(count ?? 0);
  })();

  const demoMaintCount = await (async () => {
    const { data: pRows } = await supabase
      .from("properties")
      .select("id")
      .eq("user_id", userId)
      .like("address", `${DEMO_PROPERTY_PREFIX}%`);
    const pids = (pRows ?? []).map((r: { id: string }) => r.id);
    if (pids.length === 0) return "0";
    const { data: tRows } = await supabase.from("tenancies").select("id").in("property_id", pids);
    const tids = (tRows ?? []).map((r: { id: string }) => r.id);
    if (tids.length === 0) return "0";
    const { count, error } = await supabase
      .from("maintenance_requests")
      .select("*", { count: "exact", head: true })
      .in("tenancy_id", tids);
    if (error) return `? (${error.message})`;
    return String(count ?? 0);
  })();

  console.log(`Demo rent_payments (tagged notes): ${demoRentCount}`);
  console.log(`Demo maintenance_requests (under demo tenancies): ${demoMaintCount}`);
  const demoLeadCount = await (async () => {
    const { count, error } = await supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("notes", DEMO_LEAD_NOTE);
    if (error) return `? (${error.message})`;
    return String(count ?? 0);
  })();

  console.log(`Demo leads (tagged notes): ${demoLeadCount}`);
  const pendingAll = await (async () => {
    const { count, error } = await supabase
      .from("agent_approvals")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "pending");
    if (error) return `? (${error.message})`;
    return String(count ?? 0);
  })();

  console.log(`Pending agent_approvals (expected 4 demo): ${pendingAll}`);
  console.log(`Demo agent_runs (${DEMO_AGENT_RUN_TYPE} queued): 1`);
}

void main();
