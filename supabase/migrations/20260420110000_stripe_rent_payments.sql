-- Stripe rent Payments: columns for rent_payments, user_settings, and tenancies

-- Add Stripe tracking to rent_payments
alter table public.rent_payments add column if not exists stripe_payment_intent_id text;
alter table public.rent_payments add column if not exists stripe_charge_id text;
alter table public.rent_payments add column if not exists stripe_receipt_url text;
alter table public.rent_payments add column if not exists payment_link text;

-- Add Stripe customer tracking to user_settings (for landlords/agents)
alter table public.user_settings add column if not exists stripe_customer_id text;
alter table public.user_settings add column if not exists stripe_subscription_id text;
alter table public.user_settings add column if not exists subscription_status text;
alter table public.user_settings add column if not exists subscription_plan text;
alter table public.user_settings add column if not exists subscription_period_end timestamptz;
alter table public.user_settings add column if not exists stripe_connect_account_id text;

-- Add Stripe tracking to tenancies for recurring rent
alter table public.tenancies add column if not exists stripe_subscription_id text;
alter table public.tenancies add column if not exists next_payment_due_date date;
alter table public.tenancies add column if not exists auto_pay_enabled boolean default false;

-- Index for looking up rent payments by Stripe intent
create index if not exists rent_payments_stripe_intent_idx
  on public.rent_payments (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

-- Index for finding pending payments by tenancy
create index if not exists rent_payments_tenancy_pending_idx
  on public.rent_payments (tenancy_id, status)
  where status = 'pending';
