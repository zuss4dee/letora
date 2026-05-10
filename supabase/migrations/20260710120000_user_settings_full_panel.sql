-- Extend user_settings with the columns required by the full settings panel
-- (Organisation, Profile, AI & Chasing, Email Templates, Notifications, Appearance)
-- and provision the user-assets storage bucket for org logos and avatars.

-- 1. Organisation fields ---------------------------------------------------
alter table public.user_settings
  add column if not exists org_name text,
  add column if not exists org_logo_url text,
  add column if not exists org_contact_email text,
  add column if not exists org_phone text,
  add column if not exists org_address text;

-- 2. Profile fields --------------------------------------------------------
-- first_name and last_name supplement the legacy `landlord_name` (kept for
-- backwards compatibility with rent-chaser email signatures).
alter table public.user_settings
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists avatar_url text;

-- 3. AI & Chasing rules ----------------------------------------------------
-- chase_trigger_days replaces first_chase_days for the new UI (kept in sync).
alter table public.user_settings
  add column if not exists chase_trigger_days integer default 3
    check (chase_trigger_days between 1 and 30),
  add column if not exists chase_max_per_month integer default 3
    check (chase_max_per_month between 1 and 10),
  add column if not exists chase_min_gap_days integer default 5
    check (chase_min_gap_days between 1 and 30),
  add column if not exists chase_allow_weekends boolean default false,
  add column if not exists chase_escalation_threshold integer default 3
    check (chase_escalation_threshold between 1 and 6),
  add column if not exists chase_tone_1 text default 'friendly'
    check (chase_tone_1 in ('friendly','firm','formal','legal')),
  add column if not exists chase_tone_2 text default 'firm'
    check (chase_tone_2 in ('friendly','firm','formal','legal')),
  add column if not exists chase_tone_3 text default 'formal'
    check (chase_tone_3 in ('friendly','firm','formal','legal')),
  add column if not exists chase_require_approval boolean default true,
  add column if not exists chase_ai_proactive boolean default true;

-- 4. Email template fields ------------------------------------------------
-- Per-tenant chase templates and brand metadata. NULL = use built-in default.
alter table public.user_settings
  add column if not exists email_sender_name text,
  add column if not exists email_reply_to text,
  add column if not exists email_chase1_subject text,
  add column if not exists email_chase1_body text,
  add column if not exists email_chase2_subject text,
  add column if not exists email_chase2_body text,
  add column if not exists email_chase3_subject text,
  add column if not exists email_chase3_body text;

-- 5. Notification preferences ---------------------------------------------
alter table public.user_settings
  add column if not exists notif_rent_overdue boolean default true,
  add column if not exists notif_rent_overdue_days integer default 3
    check (notif_rent_overdue_days between 1 and 14),
  add column if not exists notif_escalation boolean default true,
  add column if not exists notif_approval_ready boolean default true,
  add column if not exists notif_approval_queue_threshold integer default 5
    check (notif_approval_queue_threshold between 1 and 50),
  add column if not exists notif_maintenance boolean default true,
  add column if not exists notif_weekly_digest boolean default true,
  add column if not exists notif_digest_day text default 'mon'
    check (notif_digest_day in ('mon','tue','wed','thu','fri','sat','sun')),
  add column if not exists notif_digest_time text default '08:00';

-- 6. Appearance -----------------------------------------------------------
alter table public.user_settings
  add column if not exists theme_preference text default 'system'
    check (theme_preference in ('light','dark','system'));

-- 7. Storage bucket for org logos + avatars -------------------------------
-- Public bucket so we can render <img src> directly. RLS still scopes
-- writes/deletes/updates to the owning user via path prefix.
insert into storage.buckets (id, name, public)
values ('user-assets', 'user-assets', true)
on conflict (id) do nothing;

-- Path shape: {auth.uid()}/{kind}/{filename} (e.g. abc/logo/main.png)
drop policy if exists "user_assets_select_public" on storage.objects;
create policy "user_assets_select_public"
on storage.objects for select
using (bucket_id = 'user-assets');

drop policy if exists "user_assets_insert_own" on storage.objects;
create policy "user_assets_insert_own"
on storage.objects for insert
with check (
  bucket_id = 'user-assets'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "user_assets_update_own" on storage.objects;
create policy "user_assets_update_own"
on storage.objects for update
using (
  bucket_id = 'user-assets'
  and auth.uid()::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'user-assets'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "user_assets_delete_own" on storage.objects;
create policy "user_assets_delete_own"
on storage.objects for delete
using (
  bucket_id = 'user-assets'
  and auth.uid()::text = (storage.foldername(name))[1]
);
