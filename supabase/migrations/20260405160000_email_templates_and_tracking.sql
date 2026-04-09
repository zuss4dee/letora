-- Email template versioning and enhanced delivery tracking

-- Template versions table for tracking email template iterations
create table if not exists email_template_versions (
  id uuid default gen_random_uuid() primary key,
  template_type text not null,
  version integer not null,
  subject_template text not null,
  html_content text not null,
  text_content text not null,
  is_active boolean default false,
  created_at timestamptz default now(),
  created_by uuid references auth.users(id),
  notes text,
  unique(template_type, version)
);

alter table email_template_versions enable row level security;

create policy "Users can view their own email templates"
  on email_template_versions for select
  using (true); -- Templates are shared across users for consistency

create policy "Only authenticated users can manage templates"
  on email_template_versions for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Add template tracking columns to email_logs
alter table email_logs add column if not exists template_type text;
alter table email_logs add column if not exists template_version integer;
alter table email_logs add column if not exists html_body text;
alter table email_logs add column if not exists delivery_status text default 'pending';
alter table email_logs add column if not exists delivered_at timestamptz;
alter table email_logs add column if not exists bounced_at timestamptz;
alter table email_logs add column if not exists bounce_reason text;
alter table email_logs add column if not exists opened_at timestamptz;
alter table email_logs add column if not exists retry_count integer default 0;
alter table email_logs add column if not exists max_retries integer default 3;
alter table email_logs add column if not exists next_retry_at timestamptz;
alter table email_logs add column if not exists unsubscribe_token text;
-- Resend API message id (e.g. re_...); must exist before idx_email_logs_delivery
alter table email_logs add column if not exists resend_email_id text;

-- Index for retry logic
create index if not exists idx_email_logs_retry on email_logs (status, next_retry_at)
  where status = 'failed' and retry_count < max_retries;

-- Index for template tracking
create index if not exists idx_email_logs_template on email_logs (template_type, template_version);

-- Index for delivery tracking (resend_email_id correlates with Resend dashboard)
create index if not exists idx_email_logs_delivery on email_logs (delivery_status, resend_email_id)
  where delivery_status is not null;

-- Unsubscribe tokens table
create table if not exists email_unsubscribes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) not null,
  email_address text not null,
  unsubscribe_token text unique not null,
  unsubscribed_at timestamptz default now(),
  reason text
);

alter table email_unsubscribes enable row level security;

create policy "Users can manage their own unsubscribes"
  on email_unsubscribes for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Service role can read all unsubscribes"
  on email_unsubscribes for select
  using (auth.role() = 'service_role');

-- Function to generate unsubscribe token
create or replace function generate_unsubscribe_token()
returns text as $$
begin
  return encode(gen_random_bytes(32), 'hex');
end;
$$ language plpgsql security definer;

-- Function to check if email is unsubscribed
create or replace function is_email_unsubscribed(check_email text)
returns boolean as $$
  select exists (
    select 1 from email_unsubscribes
    where email_address = lower(check_email)
  );
$$ language sql security definer;
