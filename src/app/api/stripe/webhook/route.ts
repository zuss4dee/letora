import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createServiceRoleClient } from "@/lib/supabase/admin";

import { PLANS } from "@/lib/stripe-plans";
import { resolvePlanKeyFromStripeSubscription } from "@/lib/plan-limits";
import { PENDING_CHECKOUT_PLAN_META_KEY } from "@/lib/stripe/pending-checkout";
import { stripe } from "@/lib/stripe";
import { syncSubscriptionToUserSettings } from "@/lib/billing/sync";

const PG_UNIQUE_VIOLATION = "23505";

function logWebhookIssue(message: string, context: Record<string, string | undefined>) {
  console.warn(`[stripe webhook] ${message}`, context);
}

async function getCustomerUserId(
  supabase: ReturnType<typeof createServiceRoleClient>,
  customerId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("user_settings")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  return data?.user_id ?? null;
}

function computeNextDueDate(timestamp: number): string {
  const d = new Date(timestamp * 1000);
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 10);
}

async function syncPlatformSubscriptionToUserSettings(
  supabase: ReturnType<typeof createServiceRoleClient>,
  userId: string,
  sub: Stripe.Subscription,
  opts?: { stripeCustomerId?: string },
) {
  const planKey = resolvePlanKeyFromStripeSubscription(sub);
  const trialEnd = sub.trial_end != null && sub.trial_end > 0 ? new Date(sub.trial_end * 1000) : null;

  await syncSubscriptionToUserSettings(supabase, {
    userId,
    provider: "stripe",
    subscriptionId: sub.id,
    customerId: opts?.stripeCustomerId || (typeof sub.customer === "string" ? sub.customer : sub.customer.id),
    status: sub.status,
    planKey,
    periodEnd: new Date(sub.current_period_end * 1000),
    trialEnd,
  });
}

async function handleCheckoutSessionCompleted(
  supabase: ReturnType<typeof createServiceRoleClient>,
  session: Stripe.Checkout.Session,
) {
  if (session.mode !== "subscription") return;
  const userId = session.metadata?.user_id?.trim();
  if (!userId) {
    logWebhookIssue("checkout.session.completed missing user_id metadata", { sessionId: session.id });
    return;
  }
  const c = session.customer;
  const stripeCustomerId =
    c == null ? null : typeof c === "string" ? c : "deleted" in c && c.deleted ? null : c.id;

  if (stripeCustomerId) {
    const { error: custErr } = await supabase
      .from("user_settings")
      .upsert(
        {
          user_id: userId,
          stripe_customer_id: stripeCustomerId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
    if (custErr) {
      logWebhookIssue("user_settings upsert stripe_customer_id failed", { sessionId: session.id });
    }
  }

  const subRef = session.subscription;
  const subId = typeof subRef === "string" ? subRef : subRef?.id;
  if (!subId) {
    logWebhookIssue("checkout.session.completed missing subscription id", { sessionId: session.id });
    return;
  }
  const sub = await stripe.subscriptions.retrieve(subId);
  await syncPlatformSubscriptionToUserSettings(supabase, userId, sub, {
    stripeCustomerId: stripeCustomerId ?? undefined,
  });

  try {
    const { data: authUser, error: authErr } = await supabase.auth.admin.getUserById(userId);
    if (authErr || !authUser?.user) {
      return;
    }
    const meta = { ...((authUser.user.user_metadata ?? {}) as Record<string, unknown>) };
    if (!(PENDING_CHECKOUT_PLAN_META_KEY in meta)) {
      return;
    }
    delete meta[PENDING_CHECKOUT_PLAN_META_KEY];
    const { error: updErr } = await supabase.auth.admin.updateUserById(userId, { user_metadata: meta });
    if (updErr) {
      logWebhookIssue("clear pending_checkout_plan failed", { sessionId: session.id, message: updErr.message });
    }
  } catch (e) {
    logWebhookIssue("clear pending_checkout_plan exception", {
      sessionId: session.id,
      message: e instanceof Error ? e.message : String(e),
    });
  }
}

async function handleInvoicePaid(
  supabase: ReturnType<typeof createServiceRoleClient>,
  invoice: Stripe.Invoice,
) {
  if (!invoice.subscription) return;
  const userId = await getCustomerUserId(supabase, invoice.customer as string);
  if (!userId) return;
  const subRef = invoice.subscription;
  const subId = typeof subRef === "string" ? subRef : subRef.id;
  const sub = await stripe.subscriptions.retrieve(subId);
  await syncPlatformSubscriptionToUserSettings(supabase, userId, sub);
}

async function notifySubscriptionPaymentFailed(
  supabase: ReturnType<typeof createServiceRoleClient>,
  userId: string,
  invoice: Stripe.Invoice,
) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const portalHint = `${baseUrl}/dashboard/billing`;
  const { data: settings } = await supabase
    .from("user_settings")
    .select("contact_email, landlord_name")
    .eq("user_id", userId)
    .maybeSingle();

  const { data: authData, error: authErr } = await supabase.auth.admin.getUserById(userId);
  if (authErr) {
    logWebhookIssue("could not load user for payment_failed email", { userId });
  }
  const to = settings?.contact_email?.trim() || authData.user?.email;
  if (!to) return;

  const { sendEmail } = await import("@/lib/tools/send-email");
  const amount = invoice.amount_due != null ? (invoice.amount_due / 100).toFixed(2) : "—";
  await sendEmail(supabase, userId, null, {
    to,
    toName: settings?.landlord_name?.trim() || "there",
    subject: "Action needed: your Letora subscription payment failed",
    body: `We could not process your latest subscription payment (${invoice.currency?.toUpperCase() ?? "GBP"} ${amount}). Stripe will retry automatically according to your subscription settings.

Update your payment method in Letora: open Billing (Stripe Customer Portal) from ${portalHint}

If you need help, reply to this email.`,
    agentType: "onboarding",
    templateType: "subscription_payment_failed",
    forceSend: true,
  });
}

type RentPaymentRow = {
  id: string;
  status: string | null;
  tenancy_id: string | null;
  stripe_payment_intent_id: string | null;
  tenancies: {
    id: string;
    properties: { user_id: string } | { user_id: string }[];
  };
};

function landlordUserIdFromTenancy(t: RentPaymentRow["tenancies"]): string | null {
  const p = t.properties;
  const u = Array.isArray(p) ? p[0] : p;
  return u?.user_id ?? null;
}

async function loadRentPaymentForWebhook(
  supabase: ReturnType<typeof createServiceRoleClient>,
  rentPaymentId: string,
): Promise<RentPaymentRow | null> {
  const { data, error } = await supabase
    .from("rent_payments")
    .select(
      `
      id,
      status,
      tenancy_id,
      stripe_payment_intent_id,
      tenancies!inner (
        id,
        properties!inner ( user_id )
      )
    `,
    )
    .eq("id", rentPaymentId)
    .maybeSingle();

  if (error) {
    logWebhookIssue("rent_payment load failed", { rentPaymentId });
    return null;
  }
  return data as RentPaymentRow | null;
}

function rentMetadataValid(
  row: RentPaymentRow,
  meta: Stripe.Metadata,
  paymentIntentId: string,
): boolean {
  const landlordId = landlordUserIdFromTenancy(row.tenancies);
  if (!landlordId || !meta.user_id || !meta.tenancy_id) {
    logWebhookIssue("rent metadata missing or invalid tenancy join", {
      paymentIntentId,
      rentPaymentId: meta.rent_payment_id,
    });
    return false;
  }
  if (landlordId !== meta.user_id) {
    logWebhookIssue("rent metadata user_id does not own tenancy", {
      paymentIntentId,
      rentPaymentId: meta.rent_payment_id,
    });
    return false;
  }
  if (row.tenancy_id !== meta.tenancy_id || row.tenancies.id !== meta.tenancy_id) {
    logWebhookIssue("rent metadata tenancy_id mismatch", {
      paymentIntentId,
      rentPaymentId: meta.rent_payment_id,
    });
    return false;
  }
  return true;
}

async function handleRentPaymentSuccess(
  supabase: ReturnType<typeof createServiceRoleClient>,
  paymentIntent: Stripe.PaymentIntent,
  stripeEventId: string,
) {
  const meta = paymentIntent.metadata;
  if (meta.payment_type !== "rent") return;

  if (!meta.rent_payment_id || !meta.tenancy_id || !meta.user_id) {
    logWebhookIssue("rent success missing required metadata", {
      stripeEventId,
      paymentIntentId: paymentIntent.id,
    });
    return;
  }

  const row = await loadRentPaymentForWebhook(supabase, meta.rent_payment_id);
  if (!row) {
    logWebhookIssue("rent_payment not found for webhook", {
      stripeEventId,
      paymentIntentId: paymentIntent.id,
      rentPaymentId: meta.rent_payment_id,
    });
    return;
  }

  if (!rentMetadataValid(row, meta, paymentIntent.id)) {
    return;
  }

  if (row.status === "paid" && row.stripe_payment_intent_id === paymentIntent.id) {
    return;
  }

  if (row.status === "paid" && row.stripe_payment_intent_id && row.stripe_payment_intent_id !== paymentIntent.id) {
    logWebhookIssue("rent_payment already paid with different intent", {
      paymentIntentId: paymentIntent.id,
      rentPaymentId: row.id,
    });
    return;
  }

  const receiptUrl = (paymentIntent as unknown as Record<string, unknown>).receipt_url as string | undefined;

  const { data: updatedRows, error: updErr } = await supabase
    .from("rent_payments")
    .update({
      status: "paid",
      paid_date: new Date().toISOString().slice(0, 10),
      amount: paymentIntent.amount_received / 100,
      stripe_payment_intent_id: paymentIntent.id,
      stripe_charge_id: (paymentIntent.latest_charge as string) ?? null,
      stripe_receipt_url: receiptUrl ?? null,
    })
    .eq("id", meta.rent_payment_id)
    .in("status", ["pending", "failed"])
    .select("id");

  if (updErr) {
    logWebhookIssue("rent_payment update failed", { paymentIntentId: paymentIntent.id });
    throw updErr;
  }

  if (!updatedRows?.length) {
    return;
  }

  const { error: tenErr } = await supabase
    .from("tenancies")
    .update({ next_payment_due_date: computeNextDueDate(paymentIntent.created) })
    .eq("id", meta.tenancy_id);

  if (tenErr) {
    logWebhookIssue("tenancy next_payment_due_date update failed", { paymentIntentId: paymentIntent.id });
    throw tenErr;
  }

  const { data: tenancy } = await supabase
    .from("tenancies")
    .select("tenants(full_name, email)")
    .eq("id", meta.tenancy_id)
    .maybeSingle();

  const tenantRaw = tenancy?.tenants as unknown as
    | { full_name: string | null; email: string | null }
    | { full_name: string | null; email: string | null }[]
    | null;
  const tenant = Array.isArray(tenantRaw) ? tenantRaw[0] : tenantRaw;

  if (tenant?.email) {
    const { sendTemplateEmail } = await import("@/lib/email/send-template-email");
    const gbp = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });
    await sendTemplateEmail(
      supabase,
      meta.user_id,
      null,
      "payment_receipt",
      {
        to: tenant.email,
        toName: tenant.full_name ?? "Tenant",
        tenantName: tenant.full_name ?? "Tenant",
        propertyAddress: meta.property_address ?? "Property",
        amount: gbp.format(paymentIntent.amount_received / 100),
        paymentDate: new Date().toLocaleDateString("en-GB"),
        paymentMethod: "Stripe",
        receiptUrl: receiptUrl ?? "#",
        transactionId: paymentIntent.id,
      },
      "onboarding",
      true,
    );
  }
}

async function handleRentPaymentFailed(
  supabase: ReturnType<typeof createServiceRoleClient>,
  pi: Stripe.PaymentIntent,
  stripeEventId: string,
) {
  void stripeEventId;
  const meta = pi.metadata;
  if (meta.payment_type !== "rent" || !meta.rent_payment_id || !meta.tenancy_id || !meta.user_id) {
    return;
  }

  const row = await loadRentPaymentForWebhook(supabase, meta.rent_payment_id);
  if (!row || !rentMetadataValid(row, meta, pi.id)) {
    return;
  }

  const lastError = pi.last_payment_error;
  const failureCode = lastError?.code ?? lastError?.type ?? "failed";
  const notes = `Payment failed (${failureCode})`;

  await supabase
    .from("rent_payments")
    .update({
      status: "failed",
      stripe_payment_intent_id: pi.id,
      notes,
    })
    .eq("id", meta.rent_payment_id)
    .neq("status", "paid");
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) return NextResponse.json({ error: "No signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let supabase: ReturnType<typeof createServiceRoleClient>;
  try {
    supabase = createServiceRoleClient();
  } catch {
    console.error("[stripe webhook] missing SUPABASE_SERVICE_ROLE_KEY");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const { error: insErr } = await supabase.from("stripe_webhook_events").insert({
    stripe_event_id: event.id,
    event_type: event.type,
  });

  if (insErr?.code === PG_UNIQUE_VIOLATION) {
    return NextResponse.json({ received: true });
  }
  if (insErr) {
    console.error("[stripe webhook] could not record event id");
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  const removeEventRecord = () =>
    supabase.from("stripe_webhook_events").delete().eq("stripe_event_id", event.id);

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        await handleRentPaymentSuccess(supabase, pi, event.id);
        break;
      }

      case "payment_intent.payment_failed": {
        const pi = event.data.object as Stripe.PaymentIntent;
        await handleRentPaymentFailed(supabase, pi, event.id);
        break;
      }

      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutSessionCompleted(supabase, session);
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaid(supabase, invoice);
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = await getCustomerUserId(supabase, sub.customer as string);
        if (userId) {
          await syncPlatformSubscriptionToUserSettings(supabase, userId, sub);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = await getCustomerUserId(supabase, sub.customer as string);
        if (userId) {
          await supabase
            .from("user_settings")
            .update({
              subscription_status: "inactive",
              subscription_plan: null,
              stripe_subscription_id: null,
              subscription_period_end: null,
              subscription_trial_end: null,
            })
            .eq("user_id", userId);
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const userId = await getCustomerUserId(supabase, invoice.customer as string);
        if (userId) {
          await supabase.from("user_settings").update({ subscription_status: "past_due" }).eq("user_id", userId);
          if (invoice.subscription) {
            await notifySubscriptionPaymentFailed(supabase, userId, invoice);
          }
        }
        break;
      }

      default:
        break;
    }
  } catch (e) {
    await removeEventRecord();
    console.error("[stripe webhook] handler error", e instanceof Error ? e.message : "unknown");
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
