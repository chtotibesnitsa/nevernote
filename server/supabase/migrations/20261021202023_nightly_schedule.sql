-- The overnight batch is authenticated with a random secret kept in Vault, so it never needs to be copied by hand.
-- Forks: change project_url to your own project.
do $$ begin
  if not exists (select 1 from vault.secrets where name = 'nightly_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(24), 'hex'), 'nightly_secret');
  end if;
  if not exists (select 1 from vault.secrets where name = 'project_url') then
    perform vault.create_secret('https://bbvaqcsyinbeopyhrqzi.supabase.co', 'project_url');
  end if;
end $$;

create or replace function public.nightly_secret_ok(token text) returns boolean
language sql security definer set search_path = '' as $$
  select exists (select 1 from vault.decrypted_secrets where name = 'nightly_secret' and decrypted_secret = token);
$$;
revoke execute on function public.nightly_secret_ok(text) from public, anon, authenticated;
grant execute on function public.nightly_secret_ok(text) to service_role;

-- Every 10 minutes from 07:00 to 10:50 UTC (about 3 to 7 a.m. US Eastern), 12 notes per run.
select cron.schedule('nevernote-nightly', '*/10 7-10 * * *', $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/nightly',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'nightly_secret')),
    timeout_milliseconds := 140000
  );
$$);
