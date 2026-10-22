-- Pro calendar sync: a secret per-student feed URL that Google and Apple
-- Calendar subscribe to, so new due dates show up on their own.
alter table public.profiles add column if not exists calendar_token text unique;
