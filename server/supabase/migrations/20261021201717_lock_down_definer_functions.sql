-- The signup trigger runs as its owner; nobody should be able to call it over the API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
-- Created by Supabase's "automatic RLS" option when it is on.
do $$ begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;
-- For the overnight summary batch (see server/README.md).
create extension if not exists pg_cron;
create extension if not exists pg_net;
