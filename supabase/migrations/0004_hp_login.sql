-- Bendito Helferplan 5.0.0 — Login-Codes
--
-- Helfer melden sich mit einem persönlichen Link an. Der Code darin hat
-- 244 Bit Zufall; gespeichert wird nur sein SHA-256-Hash. Die Edge Function
-- hp-login tauscht einen gültigen Code gegen eine echte Sitzung.
--
-- Ein neuer oder widerrufener Code sperrt sofort: Die Zuordnung
-- hp_helpers.auth_user_id wird entfernt, und jede Funktion prüft diese
-- Zuordnung bei jedem Aufruf. Ein noch laufendes Zugriffstoken nützt dann
-- nichts mehr.

create or replace function public.hp__code_hash(p_code text)
returns text
language sql immutable set search_path = ''
as $$
  select encode(sha256(convert_to(p_code, 'UTF8')), 'hex');
$$;

-- Erzeugt einen neuen Code und gibt ihn genau einmal zurück.
create or replace function public.hp_admin_new_login_code(p_helper uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_helper public.hp_helpers;
  v_code text;
begin
  perform public.hp__require_admin();
  perform public.hp__touch();

  select * into v_helper from public.hp_helpers where id = p_helper;
  if not found then
    return public.hp__fail('new_login_code', null, p_helper, 'NOT_FOUND');
  end if;
  if not v_helper.active then
    return public.hp__fail('new_login_code', null, p_helper, 'HELPER_INACTIVE');
  end if;

  v_code := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');

  update public.hp_helpers h
     set login_code_hash = public.hp__code_hash(v_code),
         login_code_created_at = now(),
         auth_user_id = null
   where h.id = p_helper;
  perform public.hp__drop_auth(v_helper.auth_user_id);

  perform public.hp__audit('new_login_code', null, p_helper, 'ok');
  return jsonb_build_object('ok', true, 'code', v_code);
end;
$$;

-- Widerruft den Zugang eines Helfers (p_helper) oder aller Helfer (null).
create or replace function public.hp_admin_revoke_login(p_helper uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  r record;
  v_n int := 0;
begin
  perform public.hp__require_admin();
  perform public.hp__touch();

  for r in
    select h.id, h.auth_user_id from public.hp_helpers h
    where (p_helper is null or h.id = p_helper)
      and (h.login_code_hash is not null or h.auth_user_id is not null)
  loop
    update public.hp_helpers h
       set login_code_hash = null, login_code_created_at = null, auth_user_id = null
     where h.id = r.id;
    perform public.hp__drop_auth(r.auth_user_id);
    v_n := v_n + 1;
  end loop;

  perform public.hp__audit(case when p_helper is null then 'revoke_all_logins' else 'revoke_login' end,
                           null, p_helper, 'ok:' || v_n::text);
  return jsonb_build_object('ok', true, 'revoked', v_n);
end;
$$;

-- Nur für die Edge Function (service_role). Prüft den Code-Hash und zählt
-- Fehlversuche je Absender: höchstens 10 in 10 Minuten.
create or replace function public.hp_login_lookup(p_code_hash text, p_ip_hash text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_fail int;
  v_helper public.hp_helpers;
  v_ip text := left(coalesce(p_ip_hash, ''), 64);
begin
  delete from public.hp_login_attempts where at < now() - interval '1 day';

  select count(*) into v_fail
  from public.hp_login_attempts t
  where t.ip_hash = v_ip and not t.ok and t.at > now() - interval '10 minutes';
  if v_fail >= 10 then
    return jsonb_build_object('ok', false, 'code', 'RATE_LIMITED');
  end if;

  select * into v_helper
  from public.hp_helpers h
  where h.login_code_hash = p_code_hash and h.active;
  if not found or p_code_hash is null then
    insert into public.hp_login_attempts (ip_hash, ok) values (v_ip, false);
    return jsonb_build_object('ok', false, 'code', 'INVALID');
  end if;

  insert into public.hp_login_attempts (ip_hash, ok) values (v_ip, true);
  return jsonb_build_object('ok', true, 'helper_id', v_helper.id, 'auth_user_id', v_helper.auth_user_id);
end;
$$;

-- Nur für die Edge Function. Bindet ein frisch angelegtes Auth-Konto an den
-- Helfer, sofern der Code noch gilt und noch kein Konto gebunden ist. Gibt das
-- danach gültige Konto zurück (bei gleichzeitiger Anmeldung das des Schnelleren).
create or replace function public.hp_login_bind(p_helper uuid, p_code_hash text, p_user uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid;
begin
  update public.hp_helpers h
     set auth_user_id = p_user
   where h.id = p_helper and h.active
     and h.login_code_hash = p_code_hash
     and h.auth_user_id is null;

  select h.auth_user_id into v_user
  from public.hp_helpers h
  where h.id = p_helper and h.active and h.login_code_hash = p_code_hash;
  return v_user;
end;
$$;
