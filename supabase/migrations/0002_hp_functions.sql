-- Bendito Helferplan 5.0.0 — Hilfsfunktionen, Lesen, Orga-Funktionen
--
-- Regeln für alle Funktionen in dieser Datei:
--   * SECURITY DEFINER mit leerem search_path, alle Namen voll qualifiziert.
--   * Rechte hängen nie an „ist angemeldet“, sondern an hp_admins oder an der
--     Zuordnung hp_helpers.auth_user_id.
--   * Fachliche Ablehnungen kommen als {"ok": false, "code": "..."} zurück und
--     ändern nichts am Plan. Fehlende Berechtigung ist eine Ausnahme (42501).
--   * Jede ändernde Funktion ruft zuerst hp__touch(). Das zählt den Datenstand
--     hoch und hält die Zeile bis zum Ende der Transaktion gesperrt: Änderungen
--     am Plan laufen damit strikt nacheinander.
--   * Funktionen mit doppeltem Unterstrich (hp__) sind intern und für keinen
--     Client ausführbar (siehe 0005).

-- ---------------------------------------------------------------- intern

create or replace function public.hp__is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.hp_admins a
    where a.user_id = (select auth.uid()) and a.active
  );
$$;

create or replace function public.hp__helper_id()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select h.id from public.hp_helpers h
  where h.auth_user_id = (select auth.uid()) and h.active;
$$;

create or replace function public.hp__touch()
returns void
language sql security definer set search_path = ''
as $$
  update public.hp_settings
     set value = to_jsonb((value #>> '{}')::bigint + 1), updated_at = now()
   where key = 'data_version';
$$;

create or replace function public.hp__audit(p_action text, p_shift text, p_helper uuid, p_outcome text)
returns void
language sql security definer set search_path = ''
as $$
  insert into public.hp_audit (actor, action, shift_id, helper_id, outcome)
  values ((select auth.uid()), p_action, p_shift, p_helper, coalesce(p_outcome, 'ok'));
$$;

create or replace function public.hp__fail(p_action text, p_shift text, p_helper uuid, p_code text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.hp__audit(p_action, p_shift, p_helper, p_code);
  return jsonb_build_object('ok', false, 'code', p_code);
end;
$$;

-- Tausch gesperrt: Schalter gesetzt oder Sperrzeitpunkt erreicht.
create or replace function public.hp__locked()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((
           select (s.value #>> '{}')::boolean from public.hp_settings s where s.key = 'swaps_locked'
         ), false)
      or coalesce((
           select now() >= (s.value #>> '{}')::timestamptz
           from public.hp_settings s
           where s.key = 'swaps_lock_at' and jsonb_typeof(s.value) = 'string'
         ), false);
$$;

-- Liefert eine Schicht des Helfers, die sich mit p_shift zeitlich überschneidet,
-- oder null. p_ignore wird nicht mitgeprüft (die Schicht, die er dafür abgibt).
create or replace function public.hp__conflict(p_helper uuid, p_shift text, p_ignore text)
returns text
language sql stable security definer set search_path = ''
as $$
  select s2.id
  from public.hp_assignments a
  join public.hp_shifts s2 on s2.id = a.shift_id
  join public.hp_shifts s1 on s1.id = p_shift
  where a.helper_id = p_helper
    and s2.id <> p_shift
    and (p_ignore is null or s2.id <> p_ignore)
    and s1.start_min < s2.end_min
    and s2.start_min < s1.end_min
  order by s2.start_min
  limit 1;
$$;

create or replace function public.hp__notify(p_helper uuid, p_kind text, p_swap bigint)
returns void
language sql security definer set search_path = ''
as $$
  insert into public.hp_notifications (helper_id, kind, swap_id) values (p_helper, p_kind, p_swap);
$$;

-- Offene Tauschvorgänge, die so nicht mehr ausführbar sind, verfallen:
-- Anfragender nicht mehr in der Ausgangsschicht, schon in der Zielschicht oder
-- nicht mehr aktiv; bei „swap“ niemand mehr da, der annehmen könnte; bei „move“
-- kein freier Platz mehr.
create or replace function public.hp__sweep()
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  r record;
begin
  for r in
    select s.id, s.from_helper
    from public.hp_swaps s
    where s.status = 'pending'
      and (
        not exists (select 1 from public.hp_assignments a
                    where a.shift_id = s.from_shift and a.helper_id = s.from_helper)
        or exists (select 1 from public.hp_assignments a
                   where a.shift_id = s.to_shift and a.helper_id = s.from_helper)
        or not exists (select 1 from public.hp_helpers h where h.id = s.from_helper and h.active)
        or (s.kind = 'swap' and not exists (
              select 1 from public.hp_assignments a
              where a.shift_id = s.to_shift and a.helper_id <> s.from_helper))
        or (s.kind = 'move' and (
              select count(*) from public.hp_assignments a where a.shift_id = s.to_shift
            ) >= (select sh.capacity from public.hp_shifts sh where sh.id = s.to_shift))
      )
  loop
    update public.hp_swaps set status = 'expired', resolved_at = now() where id = r.id;
    perform public.hp__notify(r.from_helper, 'swap_expired', r.id);
  end loop;
end;
$$;

-- Löscht das Auth-Konto eines Helfers. Nur die künstlichen Helfer-Konten,
-- niemals ein Orga-Konto. Scheitert das Löschen, bleibt der Zugang trotzdem zu,
-- weil die Zuordnung in hp_helpers vorher entfernt wurde.
create or replace function public.hp__drop_auth(p_user uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if p_user is null then
    return;
  end if;
  begin
    delete from auth.users u
    where u.id = p_user
      and u.email like 'hp-%@helfer.bendito.invalid'
      and not exists (select 1 from public.hp_admins a where a.user_id = p_user);
  exception when others then
    perform public.hp__audit('auth_cleanup', null, null, 'FAILED');
  end;
end;
$$;

create or replace function public.hp__require_admin()
returns void
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.hp__is_admin() then
    raise exception 'NOT_ALLOWED' using errcode = '42501';
  end if;
end;
$$;

-- ---------------------------------------------------------------- lesen

create or replace function public.hp_my_context()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'role', case
              when public.hp__is_admin() then 'admin'
              when public.hp__helper_id() is not null then 'helper'
              else 'none'
            end,
    'helper_id', case when public.hp__is_admin() then null else public.hp__helper_id() end,
    'server_time', now(),
    'version', (select (s.value #>> '{}')::bigint from public.hp_settings s where s.key = 'data_version')
  );
$$;

-- Der gesamte für den Aufrufer sichtbare Stand in einem Abruf.
create or replace function public.hp_state()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_admin boolean := public.hp__is_admin();
  v_me uuid := public.hp__helper_id();
  v jsonb;
begin
  if v_admin then
    v_me := null;
  elsif v_me is null then
    raise exception 'NOT_ALLOWED' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'ctx', public.hp_my_context(),
    'settings', jsonb_build_object(
      'target_shifts', (select s.value from public.hp_settings s where s.key = 'target_shifts'),
      'target_hours', (select s.value from public.hp_settings s where s.key = 'target_hours'),
      'swaps_locked', (select s.value from public.hp_settings s where s.key = 'swaps_locked'),
      'swaps_lock_at', (select s.value from public.hp_settings s where s.key = 'swaps_lock_at'),
      'event_end', (select s.value from public.hp_settings s where s.key = 'event_end'),
      'purge_after', (select s.value from public.hp_settings s where s.key = 'purge_after'),
      'locked', public.hp__locked()
    ),
    'helpers', coalesce((
      select jsonb_agg(
        case when v_admin then
          jsonb_build_object(
            'id', h.id, 'display_name', h.display_name, 'color', h.color,
            'contact_channel', h.contact_channel, 'is_setup_team', h.is_setup_team,
            'target_shifts', h.target_shifts, 'active', h.active, 'is_test', h.is_test,
            'has_login', h.login_code_hash is not null,
            'login_code_created_at', h.login_code_created_at,
            'signed_in', h.auth_user_id is not null)
        else
          jsonb_build_object(
            'id', h.id, 'display_name', h.display_name, 'color', h.color,
            'contact_channel', h.contact_channel, 'is_setup_team', h.is_setup_team,
            'target_shifts', h.target_shifts, 'active', true)
        end
        order by lower(h.display_name))
      from public.hp_helpers h
      where v_admin or h.active
    ), '[]'::jsonb),
    'shifts', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', s.id, 'day', s.day, 'type_key', s.type_key,
          'start_time', to_char(s.start_time, 'HH24:MI'),
          'duration_min', s.duration_min, 'capacity', s.capacity,
          'start_min', s.start_min, 'end_min', s.end_min)
        order by s.sort, s.id)
      from public.hp_shifts s
    ), '[]'::jsonb),
    'assignments', coalesce((
      select jsonb_agg(jsonb_build_object('shift_id', a.shift_id, 'helper_id', a.helper_id)
                       order by a.shift_id, a.assigned_at)
      from public.hp_assignments a
    ), '[]'::jsonb),
    'swaps', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', w.id, 'kind', w.kind, 'from_helper', w.from_helper,
          'from_shift', w.from_shift, 'to_shift', w.to_shift, 'note', w.note,
          'status', w.status, 'accepted_by', w.accepted_by,
          'created_at', w.created_at, 'resolved_at', w.resolved_at)
        order by w.created_at desc, w.id desc)
      from public.hp_swaps w
      where v_admin
         or w.from_helper = v_me
         or w.accepted_by = v_me
         or exists (select 1 from public.hp_notifications n
                    where n.swap_id = w.id and n.helper_id = v_me)
         or (w.status = 'pending' and w.kind = 'swap' and exists (
               select 1 from public.hp_assignments a
               where a.shift_id = w.to_shift and a.helper_id = v_me))
    ), '[]'::jsonb),
    'notifications', coalesce((
      select jsonb_agg(
        jsonb_build_object('id', n.id, 'kind', n.kind, 'swap_id', n.swap_id,
                           'created_at', n.created_at, 'read_at', n.read_at)
        order by n.created_at desc, n.id desc)
      from public.hp_notifications n
      where n.helper_id = v_me
    ), '[]'::jsonb)
  ) into v;

  return v;
end;
$$;

-- Eigene Benachrichtigungen als gelesen markieren (null = alle eigenen).
create or replace function public.hp_mark_read(p_ids bigint[])
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := public.hp__helper_id();
begin
  if v_me is null then
    raise exception 'NOT_ALLOWED' using errcode = '42501';
  end if;
  update public.hp_notifications n
     set read_at = now()
   where n.helper_id = v_me
     and n.read_at is null
     and (p_ids is null or n.id = any (p_ids));
  return jsonb_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------------- Orga: Zuweisungen

create or replace function public.hp_admin_assign(p_shift text, p_helper uuid, p_force boolean default false)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_shift public.hp_shifts;
  v_helper public.hp_helpers;
  v_n int;
  v_conflict text;
begin
  perform public.hp__require_admin();
  perform public.hp__touch();

  select * into v_shift from public.hp_shifts where id = p_shift;
  if not found then
    return public.hp__fail('assign', p_shift, p_helper, 'NOT_FOUND');
  end if;
  select * into v_helper from public.hp_helpers where id = p_helper;
  if not found then
    return public.hp__fail('assign', p_shift, p_helper, 'NOT_FOUND');
  end if;
  if not v_helper.active then
    return public.hp__fail('assign', p_shift, p_helper, 'HELPER_INACTIVE');
  end if;
  if exists (select 1 from public.hp_assignments a where a.shift_id = p_shift and a.helper_id = p_helper) then
    return public.hp__fail('assign', p_shift, p_helper, 'ASSIGN_DUPLICATE');
  end if;
  select count(*) into v_n from public.hp_assignments a where a.shift_id = p_shift;
  if v_n >= v_shift.capacity then
    return public.hp__fail('assign', p_shift, p_helper, 'SHIFT_FULL');
  end if;

  v_conflict := public.hp__conflict(p_helper, p_shift, null);
  if v_conflict is not null and not coalesce(p_force, false) then
    perform public.hp__audit('assign', p_shift, p_helper, 'ASSIGN_OVERLAP');
    return jsonb_build_object('ok', false, 'code', 'ASSIGN_OVERLAP', 'conflict_shift', v_conflict);
  end if;

  insert into public.hp_assignments (shift_id, helper_id, assigned_by)
  values (p_shift, p_helper, (select auth.uid()));
  perform public.hp__sweep();
  perform public.hp__audit('assign', p_shift, p_helper, case when v_conflict is null then 'ok' else 'ok_forced' end);
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.hp_admin_unassign(p_shift text, p_helper uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.hp__require_admin();
  perform public.hp__touch();

  delete from public.hp_assignments a where a.shift_id = p_shift and a.helper_id = p_helper;
  if not found then
    return public.hp__fail('unassign', p_shift, p_helper, 'NOT_FOUND');
  end if;
  -- Offene Tauschvorgänge zu dieser Zuweisung verfallen.
  perform public.hp__sweep();
  perform public.hp__audit('unassign', p_shift, p_helper, 'ok');
  return jsonb_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------------- Orga: Helfer

create or replace function public.hp__name_ok(p_name text)
returns boolean
language sql immutable set search_path = ''
as $$
  -- 1 bis 40 Zeichen, keine Adresse, keine Nummer: nur der Anzeigename.
  select p_name is not null
     and char_length(btrim(p_name)) between 1 and 40
     and btrim(p_name) !~ '@'
     and btrim(p_name) !~ '[0-9]{4,}'
     and btrim(p_name) !~ '[<>]';
$$;

create or replace function public.hp_admin_upsert_helper(
  p_id uuid,
  p_name text,
  p_color text,
  p_contact text,
  p_setup boolean,
  p_target int,
  p_is_test boolean
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
  v_name text := btrim(coalesce(p_name, ''));
  v_color text := coalesce(nullif(btrim(coalesce(p_color, '')), ''), '#C9962B');
  v_contact text := coalesce(btrim(p_contact), '');
begin
  perform public.hp__require_admin();
  perform public.hp__touch();

  if not public.hp__name_ok(v_name)
     or v_color !~ '^#[0-9A-Fa-f]{6}$'
     or v_contact not in ('', 'WhatsApp', 'Signal', 'Telegram', 'Threema', 'E-Mail', 'Telefon', 'SMS')
     or (p_target is not null and p_target not between 0 and 30) then
    return public.hp__fail('upsert_helper', null, p_id, 'INVALID_INPUT');
  end if;

  if exists (
    select 1 from public.hp_helpers h
    where h.active and lower(btrim(h.display_name)) = lower(v_name)
      and (p_id is null or h.id <> p_id)
  ) then
    return public.hp__fail('upsert_helper', null, p_id, 'NAME_TAKEN');
  end if;

  if p_id is null then
    insert into public.hp_helpers (display_name, color, contact_channel, is_setup_team, target_shifts, is_test)
    values (v_name, v_color, v_contact, coalesce(p_setup, false), p_target, coalesce(p_is_test, false))
    returning id into v_id;
  else
    update public.hp_helpers h
       set display_name = v_name,
           color = v_color,
           contact_channel = v_contact,
           is_setup_team = coalesce(p_setup, false),
           target_shifts = p_target,
           is_test = coalesce(p_is_test, h.is_test)
     where h.id = p_id
     returning h.id into v_id;
    if v_id is null then
      return public.hp__fail('upsert_helper', null, p_id, 'NOT_FOUND');
    end if;
  end if;

  perform public.hp__audit('upsert_helper', null, v_id, 'ok');
  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

-- Mehrere Namen auf einmal anlegen. Doppelte und ungültige werden übersprungen
-- und zurückgemeldet, der Rest wird angelegt.
create or replace function public.hp_admin_add_helpers(p_names text[], p_is_test boolean default false)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_palette text[] := array[
    '#4A90D9', '#459C5B', '#C7FE80', '#18A7D7', '#E364A2', '#FEBBBE', '#FCFE7D', '#949474',
    '#0561A6', '#FFCB43', '#D4D4D4', '#B05B0D', '#FCF281', '#E8D44D', '#FCB6D4', '#D4C84A',
    '#F0A0C0', '#C8BC3E', '#BEB036', '#7C5CBF', '#C9962B', '#3D9970', '#D4840A', '#C0392B'];
  v_base int;
  v_created int := 0;
  v_skipped text[] := array[]::text[];
  v_name text;
  v_id uuid;
begin
  perform public.hp__require_admin();
  perform public.hp__touch();

  if p_names is null or coalesce(array_length(p_names, 1), 0) = 0 or array_length(p_names, 1) > 80 then
    return public.hp__fail('add_helpers', null, null, 'INVALID_INPUT');
  end if;

  select count(*) into v_base from public.hp_helpers;

  foreach v_name in array p_names
  loop
    v_name := btrim(coalesce(v_name, ''));
    continue when v_name = '';
    if not public.hp__name_ok(v_name)
       or exists (select 1 from public.hp_helpers h
                  where h.active and lower(btrim(h.display_name)) = lower(v_name)) then
      v_skipped := v_skipped || v_name;
      continue;
    end if;
    insert into public.hp_helpers (display_name, color, is_test)
    values (v_name, v_palette[1 + ((v_base + v_created) % array_length(v_palette, 1))], coalesce(p_is_test, false))
    returning id into v_id;
    v_created := v_created + 1;
    perform public.hp__audit('upsert_helper', null, v_id, 'ok');
  end loop;

  return jsonb_build_object('ok', true, 'created', v_created, 'skipped', to_jsonb(v_skipped));
end;
$$;

-- Deaktivieren. Hat der Helfer noch Schichten, muss der Aufruf das Entfernen
-- ausdrücklich bestätigen (p_confirm = true).
create or replace function public.hp_admin_deactivate_helper(p_helper uuid, p_confirm boolean default false)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_helper public.hp_helpers;
  v_n int;
begin
  perform public.hp__require_admin();
  perform public.hp__touch();

  select * into v_helper from public.hp_helpers where id = p_helper;
  if not found then
    return public.hp__fail('deactivate_helper', null, p_helper, 'NOT_FOUND');
  end if;

  select count(*) into v_n from public.hp_assignments a where a.helper_id = p_helper;
  if v_n > 0 and not coalesce(p_confirm, false) then
    perform public.hp__audit('deactivate_helper', null, p_helper, 'CONFIRM_REQUIRED');
    return jsonb_build_object('ok', false, 'code', 'CONFIRM_REQUIRED', 'assignments', v_n);
  end if;

  delete from public.hp_assignments a where a.helper_id = p_helper;
  update public.hp_helpers h
     set active = false, login_code_hash = null, login_code_created_at = null, auth_user_id = null
   where h.id = p_helper;
  perform public.hp__drop_auth(v_helper.auth_user_id);
  perform public.hp__sweep();
  perform public.hp__audit('deactivate_helper', null, p_helper, 'ok');
  return jsonb_build_object('ok', true, 'removed_assignments', v_n);
end;
$$;

create or replace function public.hp_admin_reactivate_helper(p_helper uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_helper public.hp_helpers;
begin
  perform public.hp__require_admin();
  perform public.hp__touch();

  select * into v_helper from public.hp_helpers where id = p_helper;
  if not found then
    return public.hp__fail('reactivate_helper', null, p_helper, 'NOT_FOUND');
  end if;
  if exists (
    select 1 from public.hp_helpers h
    where h.active and h.id <> p_helper
      and lower(btrim(h.display_name)) = lower(btrim(v_helper.display_name))
  ) then
    return public.hp__fail('reactivate_helper', null, p_helper, 'NAME_TAKEN');
  end if;
  update public.hp_helpers h set active = true where h.id = p_helper;
  perform public.hp__audit('reactivate_helper', null, p_helper, 'ok');
  return jsonb_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------------- Orga: Einstellungen

create or replace function public.hp_admin_set_setting(p_key text, p_value jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_ok boolean := false;
  v_num numeric;
begin
  perform public.hp__require_admin();
  perform public.hp__touch();

  if p_key = 'target_shifts' and jsonb_typeof(p_value) = 'number' then
    v_num := (p_value #>> '{}')::numeric;
    v_ok := v_num = trunc(v_num) and v_num between 1 and 20;
  elsif p_key = 'target_hours' and jsonb_typeof(p_value) = 'number' then
    v_num := (p_value #>> '{}')::numeric;
    v_ok := v_num between 1 and 100;
  elsif p_key = 'swaps_locked' and jsonb_typeof(p_value) = 'boolean' then
    v_ok := true;
  elsif p_key in ('swaps_lock_at', 'event_end') then
    if jsonb_typeof(p_value) = 'null' then
      v_ok := p_key = 'swaps_lock_at';
    elsif jsonb_typeof(p_value) = 'string' then
      begin
        perform (p_value #>> '{}')::timestamptz;
        v_ok := true;
      exception when others then
        v_ok := false;
      end;
    end if;
  elsif p_key = 'purge_after' and jsonb_typeof(p_value) = 'string' then
    begin
      perform (p_value #>> '{}')::date;
      v_ok := true;
    exception when others then
      v_ok := false;
    end;
  end if;

  if not v_ok then
    return public.hp__fail('set_setting:' || left(coalesce(p_key, ''), 30), null, null, 'INVALID_INPUT');
  end if;

  update public.hp_settings s set value = p_value, updated_at = now() where s.key = p_key;
  perform public.hp__audit('set_setting:' || p_key, null, null, 'ok');
  return jsonb_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------------- Orga: Testdaten, Löschung

create or replace function public.hp_admin_remove_test_data()
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  r record;
  v_n int := 0;
begin
  perform public.hp__require_admin();
  perform public.hp__touch();

  for r in select h.id, h.auth_user_id from public.hp_helpers h where h.is_test
  loop
    -- Zuweisungen, Tausch und Benachrichtigungen hängen per Fremdschlüssel am Helfer.
    delete from public.hp_helpers h where h.id = r.id;
    perform public.hp__drop_auth(r.auth_user_id);
    v_n := v_n + 1;
  end loop;
  perform public.hp__sweep();
  perform public.hp__audit('remove_test_data', null, null, 'ok:' || v_n::text);
  return jsonb_build_object('ok', true, 'removed', v_n);
end;
$$;

-- Löschung nach dem Event: alle Helfer samt Zuweisungen, Tausch, Benachrichtigungen,
-- Login-Codes, Fehlversuchen und Protokoll. Schichtraster, Einstellungen und
-- Orga-Konten bleiben.
create or replace function public.hp_admin_purge(p_confirm text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  r record;
  v_helpers int;
  v_assign int;
  v_swaps int;
begin
  perform public.hp__require_admin();
  perform public.hp__touch();

  if p_confirm is distinct from 'LOESCHEN' then
    return public.hp__fail('purge', null, null, 'CONFIRM_REQUIRED');
  end if;

  select count(*) into v_helpers from public.hp_helpers;
  select count(*) into v_assign from public.hp_assignments;
  select count(*) into v_swaps from public.hp_swaps;

  for r in select h.auth_user_id from public.hp_helpers h where h.auth_user_id is not null
  loop
    update public.hp_helpers h set auth_user_id = null where h.auth_user_id = r.auth_user_id;
    perform public.hp__drop_auth(r.auth_user_id);
  end loop;

  delete from public.hp_notifications where true;
  delete from public.hp_swaps where true;
  delete from public.hp_assignments where true;
  delete from public.hp_helpers where true;
  delete from public.hp_login_attempts where true;
  delete from public.hp_audit where true;

  perform public.hp__audit('purge', null, null, 'ok');
  return jsonb_build_object('ok', true, 'helpers', v_helpers, 'assignments', v_assign, 'swaps', v_swaps);
end;
$$;
