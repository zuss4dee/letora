-- Resend message id for correlating email_logs rows with the Resend dashboard.
alter table public.email_logs
  add column if not exists resend_email_id text;

comment on column public.email_logs.resend_email_id is
  'Resend API email id (e.g. re_...) when status is sent; use to match activity in Resend.';
