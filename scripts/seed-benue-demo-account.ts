/**
 * Idempotent demo seed for a single landlord account (by auth email).
 *
 * Usage (requires service role — never expose in client):
 *   npx --yes tsx scripts/seed-benue-demo-account.ts
 *
 * Loads `.env.local` from the repo root when present (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).
 *
 * Safety:
 * - Only touches rows tagged with DEMO_PROPERTY_PREFIX / DEMO_EMAIL_SUFFIX / DEMO_TITLE_PREFIX.
 * - Resolves user by exact email match; aborts if not found.
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

type UUID = string;

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
    const found = data.users.find((u) => (u.email ?? "").toLowerCase() === target);
    if (found?.id) return found.id;
    if (data.users.length < perPage) break;
    page += 1;
  }
  console.error(`No auth user found with email ${email}. Create the account in Supabase Auth first.`);
  process.exit(1);
}

async function wipeDemoPortfolio(supabase: SeedSupabase, userId: UUID): Promise<void> {
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
    console.log("No previous demo properties to remove.");
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

  const { error: apErr } = await supabase
    .from("agent_approvals")
    .delete()
    .eq("user_id", userId)
    .like("title", `${DEMO_TITLE_PREFIX}%`);
  if (apErr) {
    console.error("Failed to delete demo agent_approvals:", apErr.message);
    process.exit(1);
  }

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

  const tenanciesInsert = [
    {
      id: randomUUID(),
      property_id: propMcr.id,
      tenant_id: tenantByKey.oliver.id,
      start_date: "2026-05-01",
      end_date: "2027-04-30",
      move_in_date: "2026-05-08",
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
      start_date: "2026-04-15",
      end_date: "2027-04-14",
      move_in_date: "2026-04-20",
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
      start_date: "2026-03-01",
      end_date: "2027-02-28",
      move_in_date: "2026-03-07",
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
      start_date: "2026-02-01",
      end_date: "2027-01-31",
      move_in_date: "2026-02-10",
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
      start_date: "2025-11-01",
      end_date: "2026-10-31",
      move_in_date: "2026-05-12",
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
      start_date: "2025-09-01",
      end_date: "2026-08-31",
      move_in_date: "2025-09-05",
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
      start_date: "2025-08-01",
      end_date: "2026-07-31",
      move_in_date: "2025-08-08",
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
      due_date: "2026-04-10",
      completed_at: null as string | null,
    },
    {
      tenancy_id: tn.priya.id,
      user_id: userId,
      task_name: "Employment reference request",
      task_type: "check",
      status: "pending",
      email_log_id: null,
      due_date: "2026-04-12",
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
      due_date: "2026-04-05",
      completed_at: null,
    },
    {
      tenancy_id: tn.james.id,
      user_id: userId,
      task_name: "Previous landlord reference",
      task_type: "check",
      status: "pending",
      email_log_id: null,
      due_date: "2026-04-06",
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

  const rentElenaFeb = randomUUID();
  const rentElenaMar = randomUUID();
  const rentElenaApr = randomUUID();
  const rentSofiaMar = randomUUID();
  const rentSofiaApr = randomUUID();

  const rentRows = [
    {
      id: rentElenaFeb,
      user_id: userId,
      tenancy_id: tn.elena.id,
      property_id: propLeeds.id,
      tenant_id: tenantByKey.elena.id,
      amount: 895,
      due_date: "2026-02-01",
      paid_date: "2026-02-03",
      status: "paid",
      notes: DEMO_RENT_NOTE,
    },
    {
      id: rentElenaMar,
      user_id: userId,
      tenancy_id: tn.elena.id,
      property_id: propLeeds.id,
      tenant_id: tenantByKey.elena.id,
      amount: 895,
      due_date: "2026-03-01",
      paid_date: "2026-03-02",
      status: "paid",
      notes: DEMO_RENT_NOTE,
    },
    {
      id: rentElenaApr,
      user_id: userId,
      tenancy_id: tn.elena.id,
      property_id: propLeeds.id,
      tenant_id: tenantByKey.elena.id,
      amount: 895,
      due_date: "2026-04-01",
      paid_date: null,
      status: "pending",
      notes: DEMO_RENT_NOTE,
    },
    {
      id: rentSofiaMar,
      user_id: userId,
      tenancy_id: tn.sofia.id,
      property_id: propLeeds.id,
      tenant_id: tenantByKey.sofia.id,
      amount: 920,
      due_date: "2026-03-01",
      paid_date: null,
      status: "overdue",
      notes: DEMO_RENT_NOTE,
    },
    {
      id: rentSofiaApr,
      user_id: userId,
      tenancy_id: tn.sofia.id,
      property_id: propLeeds.id,
      tenant_id: tenantByKey.sofia.id,
      amount: 920,
      due_date: "2026-04-01",
      paid_date: null,
      status: "overdue",
      notes: DEMO_RENT_NOTE,
    },
  ];

  const { error: rpErr } = await supabase.from("rent_payments").insert(rentRows);
  if (rpErr) {
    console.error("rent_payments insert:", rpErr.message);
    process.exit(1);
  }

  const maintLeak = randomUUID();
  const maintHeat = randomUUID();

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
      status: "open",
      ai_triage_category: "routine",
      ai_triage_summary: "Likely balancing or valve issue; schedule heating engineer.",
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
      agent_type: "rent_chaser",
      title: `${DEMO_TITLE_PREFIX}Rent chase — Sofia Martins (March & April)`,
      summary:
        "Draft polite rent reminder for overdue March and April instalments. Approve to send the chase email only (no payment collection).",
      action_type: "send_rent_chase_email" as const,
      target_type: "rent_payment",
      target_id: rentSofiaMar,
      payload: {
        userId,
        rentPaymentId: rentSofiaMar,
        tenantId: tenantByKey.sofia.id,
        propertyId: propLeeds.id,
        tenantEmail: tenantByKey.sofia.email,
        tenantName: "Sofia Martins",
        emailSubject: "Rent reminder — Market Lane Lofts",
        emailBody:
          "Hi Sofia,\n\nWe note March rent remains outstanding and April is now due. Please let us know when payment can be made or if you need to discuss a plan.\n\nKind regards",
        amountOwed: 1840,
        daysOverdue: 45,
        dueDate: "2026-03-01",
      },
      evidence: {
        tenantName: "Sofia Martins",
        tenantId: tenantByKey.sofia.id,
        propertyId: propLeeds.id,
        propertyAddress: propLeeds.address.replace(DEMO_PROPERTY_PREFIX, "").trim(),
        amountOwed: 1840,
        daysOverdue: 45,
        dueDate: "2026-03-01",
        emailSubject: "Rent reminder — Market Lane Lofts",
        bodyPreview: "We note March rent remains outstanding…",
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
      },
      status: "pending" as const,
    },
  ];

  const { error: apInsErr } = await supabase.from("agent_approvals").insert(approvals);
  if (apInsErr) {
    console.error("agent_approvals insert:", apInsErr.message);
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
  const demoPendingApprovals = await (async () => {
    const { count, error } = await supabase
      .from("agent_approvals")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "pending")
      .like("title", `${DEMO_TITLE_PREFIX}%`);
    if (error) return `? (${error.message})`;
    return String(count ?? 0);
  })();

  console.log(`Demo pending agent_approvals (tagged title): ${demoPendingApprovals}`);
}

void main();
