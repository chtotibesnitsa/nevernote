-- Website guests (anonymous sign-ins) are counted apart from real accounts in the owner dashboard.
create or replace function public.admin_overview(p_days int default 30) returns jsonb
language sql security definer set search_path = '' stable as $$
  with params as (select greatest(1, least(coalesce(p_days, 30), 365)) as n),
  days as (
    select g::date as d from params, generate_series(current_date - (params.n - 1), current_date, interval '1 day') g
  ),
  ev as (
    select e.at::date as d, e.kind, e.user_id, e.meta
    from public.usage_events e, params where e.at >= current_date - (params.n - 1)
  ),
  daily as (
    select days.d,
      count(*) filter (where ev.kind = 'signup') as signups,
      count(distinct ev.user_id) filter (where ev.user_id is not null) as active,
      count(*) filter (where ev.kind = 'recording_finished') as recordings,
      coalesce(sum((ev.meta ->> 'minutes')::numeric) filter (where ev.kind = 'recording_finished'), 0) as minutes,
      count(*) filter (where ev.kind = 'summary') as summaries,
      count(*) filter (where ev.kind = 'ask') as asks,
      coalesce(sum((ev.meta ->> 'tokens_in')::numeric) filter (where ev.kind in ('summary', 'ask')), 0) as tokens_in,
      coalesce(sum((ev.meta ->> 'tokens_out')::numeric) filter (where ev.kind in ('summary', 'ask')), 0) as tokens_out,
      coalesce(sum((ev.meta ->> 'cost_usd')::numeric) filter (where ev.kind in ('summary', 'ask')), 0) as llm_cost,
      count(*) filter (where ev.kind = 'upgrade') as upgrades,
      count(*) filter (where ev.kind = 'downgrade') as downgrades,
      count(*) filter (where ev.kind = 'upsell_shown') as upsells_shown,
      -- Gross revenue estimated from RevenueCat webhooks (purchases and renewals) before Apple's cut.
      coalesce(sum(case when ev.kind = 'upgrade' then case when ev.meta ->> 'product' ilike '%year%' then 29.99 else 3.99 end end), 0) as gross
    from days left join ev on ev.d = days.d
    group by days.d
  ),
  fixed as (
    select days.d, coalesce(sum(c.monthly_usd / 30.4), 0) as fixed_cost
    from days left join public.app_costs c on c.starts_on <= days.d and (c.ends_on is null or c.ends_on >= days.d)
    group by days.d
  )
  select jsonb_build_object(
    'days', (select coalesce(jsonb_agg(jsonb_build_object(
        'day', daily.d, 'signups', signups, 'active', active, 'recordings', recordings, 'minutes', minutes,
        'summaries', summaries, 'asks', asks, 'tokens_in', tokens_in, 'tokens_out', tokens_out, 'llm_cost', llm_cost,
        'upgrades', upgrades, 'downgrades', downgrades, 'upsells_shown', upsells_shown, 'gross', gross, 'fixed_cost', fixed.fixed_cost
      ) order by daily.d), '[]'::jsonb) from daily join fixed on fixed.d = daily.d),
    'totals', jsonb_build_object(
      'users', (select count(*) from auth.users where not coalesce(is_anonymous, false)),
      'guests', (select count(*) from auth.users where coalesce(is_anonymous, false)),
      'pro_users', (select count(*) from public.profiles where plan = 'pro'),
      'notes', (select count(*) from public.notes where not deleted),
      'db_bytes', (select pg_database_size(current_database()))
    ),
    'styles', (select coalesce(jsonb_object_agg(style, n), '{}'::jsonb) from (
        select coalesce(meta ->> 'style', 'standard') as style, count(*) as n from ev where kind = 'summary' group by 1) s),
    'custom_rules_summaries', (select count(*) from ev where kind = 'summary' and meta ->> 'custom_rules' = 'true'),
    'top_spenders', (select coalesce(jsonb_agg(t order by (t ->> 'cost')::numeric desc), '[]'::jsonb) from (
        select jsonb_build_object('email', coalesce(nullif(u.email, ''), 'guest ' || left(u.id::text, 8)), 'plan', p.plan, 'summaries', count(*) filter (where ev.kind = 'summary'),
          'asks', count(*) filter (where ev.kind = 'ask'), 'cost', coalesce(sum((ev.meta ->> 'cost_usd')::numeric), 0)) as t
        from ev join auth.users u on u.id = ev.user_id left join public.profiles p on p.id = ev.user_id
        where ev.kind in ('summary', 'ask') group by u.id, u.email, p.plan order by coalesce(sum((ev.meta ->> 'cost_usd')::numeric), 0) desc limit 10) x),
    'costs', (select coalesce(jsonb_agg(to_jsonb(c) order by c.starts_on, c.id), '[]'::jsonb) from public.app_costs c)
  );
$$;
revoke execute on function public.admin_overview(int) from public, anon, authenticated;
grant execute on function public.admin_overview(int) to service_role;
