-- Idempotent Stripe webhook processing (same event.id retried by Stripe)
create table if not exists public.stripe_webhook_events (
  id uuid primary key default gen_random_uuid(),
  stripe_event_id text not null unique,
  event_type text not null,
  created_at timestamptz not null default now()
);

create index if not exists stripe_webhook_events_created_at_idx
  on public.stripe_webhook_events (created_at desc);

alter table public.stripe_webhook_events enable row level security;
-- No policies: authenticated/anon cannot read or write. Service role bypasses RLS for server webhooks.
