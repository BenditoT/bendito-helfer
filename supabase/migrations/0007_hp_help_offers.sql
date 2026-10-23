-- Bendito Helferplan 5.0.2 — Mithilfe-Abfrage
--
-- Wer mithelfen will, kann sagen, ob er schon am Donnerstag kommt, bis Montag
-- im Kloster bleibt, bei einer Helfer-Pre-Milonga dabei wäre und zum
-- Abschlussessen am Sonntagabend bleibt. Gespeichert werden Name, E-Mail,
-- optional Telefon und eine Anmerkung. Kein Client liest die Tabelle.
-- Schreiben darf nur die Edge Function hp-offer (service_role). Lesen darf
-- nur die Orga.

create table public.hp_help_offers (
  id uuid primary key default gen_random_uuid(),
  display_name text not null check (char_length(display_name) between 1 and 80),
  email text not null check (char_length(email) between 6 and 120),
  phone text not null default '' check (char_length(phone) <= 40),
  arrive_thu text not null check (arrive_thu in ('ja', 'nein', 'vielleicht')),
  stay_mon text not null check (stay_mon in ('ja', 'nein', 'vielleicht')),
  pre_milonga text not null check (pre_milonga in ('ja', 'nein', 'vielleicht')),
  dinner_sun text not null check (dinner_sun in ('ja', 'nein', 'vielleicht')),
  note text not null default '' check (char_length(note) <= 400),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hp_help_offers_email unique (email)
);

-- Zähler je Stunde, nur Prüfsummen, keine Adressen. Die Zeile aus 32 Nullen
-- ist die Obergrenze für alle zusammen.
create table public.hp_offer_rate (
  bucket timestamptz not null,
  ip_hash text not null check (ip_hash ~ '^[0-9a-f]{32}$'),
  n int not null check (n between 0 and 81),
  primary key (bucket, ip_hash)
);

alter table public.hp_help_offers enable row level security;
alter table public.hp_offer_rate enable row level security;
create policy hp_no_client on public.hp_help_offers for all to anon, authenticated using (false) with check (false);
create policy hp_no_client on public.hp_offer_rate for all to anon, authenticated using (false) with check (false);
revoke all on table public.hp_help_offers from anon, authenticated;
revoke all on table public.hp_offer_rate from anon, authenticated;

create or replace function public.hp_submit_help_offer(
  p_name text,
  p_email text,
  p_phone text,
  p_arrive text,
  p_stay text,
  p_milonga text,
  p_dinner text,
  p_note text,
  p_company text,
  p_ip_hash text
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_name text;
  v_email text;
  v_phone text;
  v_note text;
  v_bucket timestamptz;
  v_ip_n int;
  v_all_n int;
begin
  perform hp_private.require_service();
  delete from public.hp_offer_rate where bucket < now() - interval '2 days';

  if p_ip_hash is null or p_ip_hash !~ '^[0-9a-f]{32}$' then
    return hp_private.fail('help_offer', null, null, 'INVALID_INPUT');
  end if;

  v_bucket := date_trunc('hour', now());
  insert into public.hp_offer_rate as r (bucket, ip_hash, n)
  values (v_bucket, p_ip_hash, 1)
  on conflict (bucket, ip_hash) do update set n = least(r.n + 1, 9)
  returning n into v_ip_n;
  insert into public.hp_offer_rate as r (bucket, ip_hash, n)
  values (v_bucket, repeat('0', 32), 1)
  on conflict (bucket, ip_hash) do update set n = least(r.n + 1, 81)
  returning n into v_all_n;
  if v_ip_n > 8 or v_all_n > 80 then
    return hp_private.fail('help_offer', null, null, 'RATE');
  end if;

  -- Köder für Automaten: wirkt wie ein Erfolg, speichert nichts.
  if btrim(coalesce(p_company, '')) <> '' then
    perform hp_private.audit('help_offer', null, null, 'honey');
    return jsonb_build_object('ok', true);
  end if;

  v_name := btrim(coalesce(p_name, ''));
  v_email := lower(btrim(coalesce(p_email, '')));
  v_phone := btrim(coalesce(p_phone, ''));
  v_note := btrim(coalesce(p_note, ''));

  if v_name !~ '^[^[:cntrl:]<>]{1,80}$'
     or v_email !~ '^[^[:space:]@]{1,64}@[^[:space:]@]{1,80}\.[^[:space:]@]{2,24}$'
     or char_length(v_email) > 120
     or p_arrive not in ('ja', 'nein', 'vielleicht')
     or p_stay not in ('ja', 'nein', 'vielleicht')
     or p_milonga not in ('ja', 'nein', 'vielleicht')
     or p_dinner not in ('ja', 'nein', 'vielleicht')
     or char_length(v_note) > 400
     or regexp_replace(v_note, '[[:print:][:space:]]', '', 'g') <> ''
     or (
       v_phone <> '' and (
         v_phone !~ '^[0-9+()./ -]{6,40}$'
         or char_length(regexp_replace(v_phone, '[^0-9]', '', 'g')) < 6
       )
     )
  then
    return hp_private.fail('help_offer', null, null, 'INVALID_INPUT');
  end if;

  insert into public.hp_help_offers (
    display_name, email, phone, arrive_thu, stay_mon, pre_milonga, dinner_sun, note, updated_at
  ) values (
    v_name, v_email, v_phone, p_arrive, p_stay, p_milonga, p_dinner, v_note, now()
  )
  on conflict (email) do update set
    display_name = excluded.display_name,
    phone = excluded.phone,
    arrive_thu = excluded.arrive_thu,
    stay_mon = excluded.stay_mon,
    pre_milonga = excluded.pre_milonga,
    dinner_sun = excluded.dinner_sun,
    note = excluded.note,
    updated_at = now();

  perform hp_private.audit('help_offer', null, null, 'ok');
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.hp_admin_list_help_offers()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform hp_private.require_admin();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'name', o.display_name,
      'email', o.email,
      'phone', o.phone,
      'arrive_thu', o.arrive_thu,
      'stay_mon', o.stay_mon,
      'pre_milonga', o.pre_milonga,
      'dinner_sun', o.dinner_sun,
      'note', o.note,
      'updated_at', o.updated_at
    ) order by o.updated_at desc)
    from public.hp_help_offers o
  ), '[]'::jsonb);
end;
$$;

-- Dieselbe Löschung wie in 0002, zusätzlich die Mithilfe-Antworten.
create or replace function public.hp_admin_remove_test_data()
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  r record;
  v_n int := 0;
begin
  perform hp_private.require_admin();
  perform hp_private.touch();

  for r in select h.id, h.auth_user_id from public.hp_helpers h where h.is_test
  loop
    delete from public.hp_helpers h where h.id = r.id;
    perform hp_private.drop_auth(r.auth_user_id);
    v_n := v_n + 1;
  end loop;
  delete from public.hp_help_offers o where o.email like '%@example.test';
  perform hp_private.sweep();
  perform hp_private.audit('remove_test_data', null, null, 'ok:' || v_n::text);
  return jsonb_build_object('ok', true, 'removed', v_n);
end;
$$;

create or replace function public.hp_admin_purge(p_confirm text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  r record;
  v_helpers int;
  v_assign int;
  v_swaps int;
  v_offers int;
  v_left int;
begin
  perform hp_private.require_admin();
  perform hp_private.touch();

  if p_confirm is distinct from 'LOESCHEN' then
    return hp_private.fail('purge', null, null, 'CONFIRM_REQUIRED');
  end if;

  select count(*) into v_helpers from public.hp_helpers;
  select count(*) into v_assign from public.hp_assignments;
  select count(*) into v_swaps from public.hp_swaps;
  select count(*) into v_offers from public.hp_help_offers;

  for r in select h.auth_user_id from public.hp_helpers h where h.auth_user_id is not null
  loop
    update public.hp_helpers h set auth_user_id = null where h.auth_user_id = r.auth_user_id;
    perform hp_private.drop_auth(r.auth_user_id);
  end loop;

  delete from public.hp_notifications where true;
  delete from public.hp_swaps where true;
  delete from public.hp_assignments where true;
  delete from public.hp_helpers where true;
  delete from public.hp_help_offers where true;
  delete from public.hp_offer_rate where true;
  delete from public.hp_login_attempts where true;
  delete from public.hp_audit where true;
  perform hp_private.drop_orphans(interval '0');
  v_left := hp_private.helper_accounts_left();

  perform hp_private.audit('purge', null, null, case when v_left = 0 then 'ok' else 'ok:auth_left' end);
  return jsonb_build_object(
    'ok', true, 'helpers', v_helpers, 'assignments', v_assign,
    'swaps', v_swaps, 'offers', v_offers, 'auth_left', v_left
  );
end;
$$;

revoke all on function public.hp_submit_help_offer(text, text, text, text, text, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.hp_admin_list_help_offers() from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'revoke all on function public.hp_submit_help_offer(text, text, text, text, text, text, text, text, text, text) from service_role';
    execute 'grant execute on function public.hp_submit_help_offer(text, text, text, text, text, text, text, text, text, text) to service_role';
    execute 'revoke all on function public.hp_admin_list_help_offers() from service_role';
  end if;
end $$;
grant execute on function public.hp_admin_list_help_offers() to authenticated;
