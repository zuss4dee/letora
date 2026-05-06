-- Command Center KPI hot path: aggregate arrears GBP in one round trip.
-- Semantics aligned with the deployed schema:
--   - Ownership: tenancy -> property -> properties.user_id
--   - Amount rule: coalesce(rp.amount, 0)
--   - Status rule: overdue* OR pending* with due_date < p_today

create or replace function public.dashboard_arrears_outstanding_for_user(
  p_user_id uuid,
  p_today date
)
returns numeric
language sql
stable
security invoker
set search_path to public
as $$
  select coalesce(sum(coalesce(rp.amount, 0)), 0)::numeric
  from public.rent_payments rp
  inner join public.tenancies tn on tn.id = rp.tenancy_id
  inner join public.properties pr on pr.id = tn.property_id
  where pr.user_id = p_user_id
    and p_user_id = auth.uid()
    and (
      rp.status ilike 'overdue%'
      or (
        rp.status ilike 'pending%'
        and rp.due_date is not null
        and rp.due_date < p_today
      )
    );
$$;

revoke all on function public.dashboard_arrears_outstanding_for_user(uuid, date) from public;
grant execute on function public.dashboard_arrears_outstanding_for_user(uuid, date) to authenticated;