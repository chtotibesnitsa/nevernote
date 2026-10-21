-- Nevernote sync backend. One row per note; every user only ever sees their own rows.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  pro_until timestamptz,
  upsell jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.notes (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'Untitled',
  created_at timestamptz not null,
  updated_at timestamptz not null,
  duration_sec real not null default 0,
  device text not null,
  folder text,
  stage text not null,
  segments jsonb not null default '[]'::jsonb,
  speakers jsonb not null default '[]'::jsonb,
  extractions jsonb not null default '[]'::jsonb,
  summary jsonb,
  thoughts text not null default '',
  vocabulary text[] not null default '{}',
  deleted boolean not null default false,
  -- Set by the server on every write; clients page through changes with it.
  server_updated_at timestamptz not null default clock_timestamp()
);
create index notes_user_changes on public.notes (user_id, server_updated_at);
create index notes_user_created on public.notes (user_id, created_at desc);

-- Usage events: what powers the "track all users" dashboard. No transcript text is stored here.
create table public.usage_events (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete cascade,
  kind text not null,
  device text,
  at timestamptz not null default now(),
  meta jsonb not null default '{}'::jsonb
);
create index usage_events_kind_at on public.usage_events (kind, at);

create table public.summary_jobs (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  note_id text not null references public.notes (id) on delete cascade,
  route text not null check (route in ('instant', 'sponsored', 'overnight')),
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed')),
  error text,
  tokens_in int,
  tokens_out int,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index summary_jobs_queue on public.summary_jobs (status, route, created_at);

create or replace function public.touch_note() returns trigger language plpgsql as $$
begin
  new.server_updated_at := clock_timestamp();
  return new;
end $$;
create trigger notes_touch before insert or update on public.notes
  for each row execute function public.touch_note();

-- Every new account gets a profile.
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name) values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)));
  insert into public.usage_events (user_id, kind) values (new.id, 'signup');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.notes enable row level security;
alter table public.usage_events enable row level security;
alter table public.summary_jobs enable row level security;

create policy "own profile" on public.profiles for select using (auth.uid() = id);
-- Users may change their name, settings and upsell state, never their plan.
create policy "own profile edits" on public.profiles for update using (auth.uid() = id)
  with check (auth.uid() = id and plan = (select p.plan from public.profiles p where p.id = auth.uid())
              and pro_until is not distinct from (select p.pro_until from public.profiles p where p.id = auth.uid()));

create policy "own notes" on public.notes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "log own events" on public.usage_events for insert with check (auth.uid() = user_id);
create policy "see own jobs" on public.summary_jobs for select using (auth.uid() = user_id);

-- Owner dashboard (query from the Supabase SQL editor or a service-role client).
create or replace view public.admin_daily as
select date_trunc('day', at)::date as day,
       count(*) filter (where kind = 'signup') as signups,
       count(distinct user_id) as active_users,
       count(*) filter (where kind = 'recording_finished') as recordings,
       coalesce(sum((meta ->> 'minutes')::numeric) filter (where kind = 'recording_finished'), 0) as minutes_recorded,
       count(*) filter (where kind = 'summary') as summaries,
       count(*) filter (where kind = 'upsell_shown') as upsells_shown,
       count(*) filter (where kind = 'upgrade') as upgrades
from public.usage_events group by 1 order by 1 desc;
revoke all on public.admin_daily from anon, authenticated;
