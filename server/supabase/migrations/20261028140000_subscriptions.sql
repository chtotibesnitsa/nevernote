-- What Settings shows about a student's Pro: which plan, when it renews or ends.
-- Written only by the revenuecat webhook (service role); a student can read their own row.
create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  product text,
  store text,
  period_type text,
  started_at timestamptz,
  expires_at timestamptz,
  will_renew boolean not null default true,
  billing_issue boolean not null default false,
  last_event_ms bigint not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
create policy "own subscription" on public.subscriptions for select using (auth.uid() = user_id);
