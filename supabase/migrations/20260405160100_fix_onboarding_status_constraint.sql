-- Fix onboarding_status CHECK constraint to match actual code usage
-- The code sets: active, signed, pending_signature but constraint only allows: not_started, in_progress, references, contract_sent, complete

alter table tenancies drop constraint if exists tenancies_onboarding_status_check;

alter table tenancies add constraint tenancies_onboarding_status_check
  check (onboarding_status in (
    'not_started',
    'in_progress',
    'references',
    'contract_sent',
    'complete',
    'pending_signature',
    'signed',
    'active'
  ));
