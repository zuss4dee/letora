-- Allow auth.users deletion to cascade (or null out) email-related FKs added after
-- 20260404120000_account_deletion_fk_cascade.sql. Without this, deleteUser() fails when
-- rows exist in email_unsubscribes or email_template_versions reference the user.

BEGIN;

ALTER TABLE public.email_unsubscribes
  DROP CONSTRAINT IF EXISTS email_unsubscribes_user_id_fkey;

ALTER TABLE public.email_unsubscribes
  ADD CONSTRAINT email_unsubscribes_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE;

ALTER TABLE public.email_template_versions
  DROP CONSTRAINT IF EXISTS email_template_versions_created_by_fkey;

ALTER TABLE public.email_template_versions
  ADD CONSTRAINT email_template_versions_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users (id) ON DELETE SET NULL;

COMMIT;
