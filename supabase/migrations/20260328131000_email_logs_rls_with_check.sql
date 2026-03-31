-- Ensure INSERT/UPDATE satisfy RLS (explicit WITH CHECK)
drop policy if exists "Users manage own email logs" on public.email_logs;

create policy "Users manage own email logs"
  on public.email_logs
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
