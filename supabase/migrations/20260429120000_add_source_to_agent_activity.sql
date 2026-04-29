-- Add source column to agent_activity to distinguish between Assistant and Landlord actions
alter table public.agent_activity 
add column if not exists source text default 'assistant';
