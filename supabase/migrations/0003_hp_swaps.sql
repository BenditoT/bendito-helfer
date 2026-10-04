-- Bendito Helferplan 5.0.0 — Schichttausch
--
-- Zwei Arten:
--   swap  1:1-Tausch mit einer Person, die in der Zielschicht eingeteilt ist.
--         Annehmen kann jede dort eingeteilte Person.
--   move  Wechsel auf einen freien Platz. Gibt nur die Orga frei.
--
-- Je Person sind höchstens fünf offene Anfragen gleichzeitig möglich.
--
-- hp_swap_accept ändert den Plan entweder vollständig oder gar nicht. Alle
-- Vorbedingungen werden unmittelbar vor der Änderung neu geprüft, während
-- hp_private.touch() die Planänderungen aller Sitzungen in eine Reihe zwingt.

create or replace function public.hp_swap_request(p_from_shift text, p_to_shift text, p_note text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := hp_private.helper_id();
  v_to public.hp_shifts;
  v_n int;
  v_kind text;
  v_id bigint;
  v_note text := left(btrim(coalesce(p_note, '')), 200);
  r record;
begin
  if v_me is null then
    raise exception 'NOT_ALLOWED' using errcode = '42501';
  end if;
  perform hp_private.touch();

  if hp_private.locked() then
    return hp_private.fail('swap_request', p_from_shift, v_me, 'SWAP_LOCKED');
  end if;
  if p_from_shift is null or p_to_shift is null or p_from_shift = p_to_shift then
    return hp_private.fail('swap_request', p_from_shift, v_me, 'SWAP_NOT_ALLOWED');
  end if;
  select * into v_to from public.hp_shifts where id = p_to_shift;
  if not found then
    return hp_private.fail('swap_request', p_from_shift, v_me, 'NOT_FOUND');
  end if;
  if not exists (select 1 from public.hp_assignments a where a.shift_id = p_from_shift and a.helper_id = v_me) then
    return hp_private.fail('swap_request', p_from_shift, v_me, 'SWAP_NOT_ALLOWED');
  end if;
  if exists (select 1 from public.hp_assignments a where a.shift_id = p_to_shift and a.helper_id = v_me) then
    return hp_private.fail('swap_request', p_from_shift, v_me, 'SWAP_NOT_ALLOWED');
  end if;
  if hp_private.conflict(v_me, p_to_shift, p_from_shift) is not null then
    return hp_private.fail('swap_request', p_from_shift, v_me, 'SWAP_OVERLAP');
  end if;
  if exists (
    select 1 from public.hp_swaps w
    where w.status = 'pending' and w.from_helper = v_me
      and w.from_shift = p_from_shift and w.to_shift = p_to_shift
  ) then
    return hp_private.fail('swap_request', p_from_shift, v_me, 'SWAP_EXISTS');
  end if;
  if (select count(*) from public.hp_swaps w
      where w.status = 'pending' and w.from_helper = v_me) >= 5 then
    return hp_private.fail('swap_request', p_from_shift, v_me, 'SWAP_TOO_MANY');
  end if;

  select count(*) into v_n from public.hp_assignments a where a.shift_id = p_to_shift;
  v_kind := case when v_n < v_to.capacity then 'move' else 'swap' end;

  insert into public.hp_swaps (kind, from_helper, from_shift, to_shift, note)
  values (v_kind, v_me, p_from_shift, p_to_shift, v_note)
  returning id into v_id;

  if v_kind = 'swap' then
    for r in select a.helper_id from public.hp_assignments a where a.shift_id = p_to_shift and a.helper_id <> v_me
    loop
      perform hp_private.notify(r.helper_id, 'swap_request', v_id);
    end loop;
  end if;

  perform hp_private.audit('swap_request:' || v_kind, p_from_shift, v_me, 'ok');
  return jsonb_build_object('ok', true, 'id', v_id, 'kind', v_kind);
end;
$$;

create or replace function public.hp_swap_accept(p_swap bigint)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_admin boolean := hp_private.is_admin();
  v_me uuid := hp_private.helper_id();
  v_sw public.hp_swaps;
  v_to public.hp_shifts;
  v_a uuid;
  v_n int;
  r record;
begin
  if not v_admin and v_me is null then
    raise exception 'NOT_ALLOWED' using errcode = '42501';
  end if;
  -- Reiht diesen Aufruf hinter alle laufenden Planänderungen ein.
  perform hp_private.touch();

  select * into v_sw from public.hp_swaps where id = p_swap for update;
  if not found then
    return hp_private.fail('swap_accept', null, v_me, 'NOT_FOUND');
  end if;
  v_a := v_sw.from_helper;

  -- 1. Vorgang offen, Tausch nicht gesperrt.
  if v_sw.status <> 'pending' then
    return hp_private.fail('swap_accept', v_sw.from_shift, v_a, 'SWAP_STALE');
  end if;
  if hp_private.locked() then
    return hp_private.fail('swap_accept', v_sw.from_shift, v_a, 'SWAP_LOCKED');
  end if;

  -- Wer darf diesen Vorgang annehmen?
  if v_sw.kind = 'swap' then
    if v_admin or v_me is null or v_me = v_a
       or not exists (select 1 from public.hp_assignments a
                      where a.shift_id = v_sw.to_shift and a.helper_id = v_me) then
      return hp_private.fail('swap_accept', v_sw.from_shift, v_a, 'SWAP_NOT_ALLOWED');
    end if;
  else
    if not v_admin then
      return hp_private.fail('swap_accept', v_sw.from_shift, v_a, 'SWAP_NOT_ALLOWED');
    end if;
  end if;

  -- 2. Anfragender ist noch in der Ausgangsschicht und nicht in der Zielschicht.
  if not exists (select 1 from public.hp_helpers h where h.id = v_a and h.active)
     or not exists (select 1 from public.hp_assignments a
                    where a.shift_id = v_sw.from_shift and a.helper_id = v_a)
     or exists (select 1 from public.hp_assignments a
                where a.shift_id = v_sw.to_shift and a.helper_id = v_a) then
    return hp_private.fail('swap_accept', v_sw.from_shift, v_a, 'SWAP_STALE');
  end if;

  if v_sw.kind = 'swap' then
    -- 3. Annehmender ist nicht schon in der Ausgangsschicht; keine Überschneidungen.
    if exists (select 1 from public.hp_assignments a
               where a.shift_id = v_sw.from_shift and a.helper_id = v_me) then
      return hp_private.fail('swap_accept', v_sw.from_shift, v_a, 'SWAP_NOT_ALLOWED');
    end if;
    if hp_private.conflict(v_me, v_sw.from_shift, v_sw.to_shift) is not null
       or hp_private.conflict(v_a, v_sw.to_shift, v_sw.from_shift) is not null then
      return hp_private.fail('swap_accept', v_sw.from_shift, v_a, 'SWAP_OVERLAP');
    end if;
  else
    -- 4. Freier Platz in der Zielschicht, keine Überschneidung beim Anfragenden.
    select * into v_to from public.hp_shifts where id = v_sw.to_shift;
    select count(*) into v_n from public.hp_assignments a where a.shift_id = v_sw.to_shift;
    if v_n >= v_to.capacity then
      return hp_private.fail('swap_accept', v_sw.from_shift, v_a, 'SWAP_STALE');
    end if;
    if hp_private.conflict(v_a, v_sw.to_shift, v_sw.from_shift) is not null then
      return hp_private.fail('swap_accept', v_sw.from_shift, v_a, 'SWAP_OVERLAP');
    end if;
  end if;

  -- 5. Ab hier wird geändert. Alle Prüfungen liegen davor.
  delete from public.hp_assignments a where a.shift_id = v_sw.from_shift and a.helper_id = v_a;
  if v_sw.kind = 'swap' then
    delete from public.hp_assignments a where a.shift_id = v_sw.to_shift and a.helper_id = v_me;
    insert into public.hp_assignments (shift_id, helper_id, assigned_by)
    values (v_sw.from_shift, v_me, (select auth.uid()));
  end if;
  insert into public.hp_assignments (shift_id, helper_id, assigned_by)
  values (v_sw.to_shift, v_a, (select auth.uid()));

  update public.hp_swaps w
     set status = 'accepted',
         accepted_by = case when v_sw.kind = 'swap' then v_me else null end,
         resolved_by = (select auth.uid()),
         resolved_at = now()
   where w.id = v_sw.id;

  -- 6. Alle anderen offenen Vorgänge, die eine der beiden alten Zuweisungen
  --    betreffen, verfallen.
  for r in
    select w.id, w.from_helper
    from public.hp_swaps w
    where w.status = 'pending' and w.id <> v_sw.id
      and (
        (w.from_helper = v_a and w.from_shift = v_sw.from_shift)
        or (v_sw.kind = 'swap' and w.from_helper = v_me and w.from_shift = v_sw.to_shift)
        or (w.kind = 'swap' and w.to_shift = v_sw.from_shift)
        or (v_sw.kind = 'swap' and w.kind = 'swap' and w.to_shift = v_sw.to_shift)
      )
  loop
    update public.hp_swaps w set status = 'expired', resolved_at = now() where w.id = r.id;
    perform hp_private.notify(r.from_helper, 'swap_expired', r.id);
  end loop;
  perform hp_private.sweep();

  -- 7. Benachrichtigungen und Protokoll.
  perform hp_private.notify(v_a, 'swap_accepted', v_sw.id);
  if v_sw.kind = 'swap' then
    perform hp_private.notify(v_me, 'swap_accepted', v_sw.id);
  end if;
  perform hp_private.audit('swap_accept:' || v_sw.kind, v_sw.from_shift, v_a, 'ok');
  return jsonb_build_object('ok', true, 'kind', v_sw.kind);
end;
$$;

-- Ablehnen: bei „swap“ eine in der Zielschicht eingeteilte Person, sonst die Orga.
-- Die Orga darf jeden offenen Vorgang ablehnen.
create or replace function public.hp_swap_reject(p_swap bigint)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_admin boolean := hp_private.is_admin();
  v_me uuid := hp_private.helper_id();
  v_sw public.hp_swaps;
begin
  if not v_admin and v_me is null then
    raise exception 'NOT_ALLOWED' using errcode = '42501';
  end if;
  perform hp_private.touch();

  select * into v_sw from public.hp_swaps where id = p_swap for update;
  if not found then
    return hp_private.fail('swap_reject', null, v_me, 'NOT_FOUND');
  end if;
  if v_sw.status <> 'pending' then
    return hp_private.fail('swap_reject', v_sw.from_shift, v_sw.from_helper, 'SWAP_STALE');
  end if;
  if not v_admin and (
       v_sw.kind <> 'swap'
       or v_me = v_sw.from_helper
       or not exists (select 1 from public.hp_assignments a
                      where a.shift_id = v_sw.to_shift and a.helper_id = v_me)
     ) then
    return hp_private.fail('swap_reject', v_sw.from_shift, v_sw.from_helper, 'SWAP_NOT_ALLOWED');
  end if;

  update public.hp_swaps w
     set status = 'rejected', resolved_by = (select auth.uid()), resolved_at = now()
   where w.id = v_sw.id;
  perform hp_private.notify(v_sw.from_helper, 'swap_rejected', v_sw.id);
  perform hp_private.audit('swap_reject:' || v_sw.kind, v_sw.from_shift, v_sw.from_helper, 'ok');
  return jsonb_build_object('ok', true);
end;
$$;

-- Zurückziehen: nur die anfragende Person (oder die Orga).
create or replace function public.hp_swap_cancel(p_swap bigint)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_admin boolean := hp_private.is_admin();
  v_me uuid := hp_private.helper_id();
  v_sw public.hp_swaps;
begin
  if not v_admin and v_me is null then
    raise exception 'NOT_ALLOWED' using errcode = '42501';
  end if;
  perform hp_private.touch();

  select * into v_sw from public.hp_swaps where id = p_swap for update;
  if not found then
    return hp_private.fail('swap_cancel', null, v_me, 'NOT_FOUND');
  end if;
  if v_sw.status <> 'pending' then
    return hp_private.fail('swap_cancel', v_sw.from_shift, v_sw.from_helper, 'SWAP_STALE');
  end if;
  if not v_admin and v_me is distinct from v_sw.from_helper then
    return hp_private.fail('swap_cancel', v_sw.from_shift, v_sw.from_helper, 'SWAP_NOT_ALLOWED');
  end if;

  update public.hp_swaps w
     set status = 'cancelled', resolved_by = (select auth.uid()), resolved_at = now()
   where w.id = v_sw.id;
  perform hp_private.audit('swap_cancel:' || v_sw.kind, v_sw.from_shift, v_sw.from_helper, 'ok');
  return jsonb_build_object('ok', true);
end;
$$;
