-- Tauschtests T1–T10 (Sprint 3.4), dazu drei Zusatzfälle (T5b, T6b, T10b).
--
-- Läuft mit synthetischen Daten. Jeder Fall wird einzeln zurückgerollt, am Ende
-- bricht der Block mit dem Ergebnis ab und rollt damit auch die Testdaten
-- zurück. Das Ergebnis steht in der Fehlermeldung nach „HP_TEST_RESULTS“.
-- Nutzerwechsel über die JWT-Angaben der Sitzung (request.jwt.claims).

do $$
declare
  u_admin uuid := gen_random_uuid();
  u_a uuid := gen_random_uuid();
  u_b uuid := gen_random_uuid();
  u_c uuid := gen_random_uuid();
  u_d uuid := gen_random_uuid();
  h_a uuid;
  h_b uuid;
  h_c uuid;
  h_d uuid;
  res jsonb := '[]'::jsonb;
  r jsonb;
  r2 jsonb;
  s1 bigint;
  s2 bigint;
  v_before text;
  v_after text;
begin
  -- ------------------------------------------------------------ Testdaten
  insert into auth.users (id, email) values
    (u_admin, 'hp-test-admin-' || u_admin || '@helfer.bendito.invalid'),
    (u_a, 'hp-' || u_a || '@helfer.bendito.invalid'),
    (u_b, 'hp-' || u_b || '@helfer.bendito.invalid'),
    (u_c, 'hp-' || u_c || '@helfer.bendito.invalid'),
    (u_d, 'hp-' || u_d || '@helfer.bendito.invalid');
  insert into public.hp_admins (user_id) values (u_admin);
  insert into public.hp_helpers (display_name, is_test, auth_user_id) values ('Test Anna T', true, u_a) returning id into h_a;
  insert into public.hp_helpers (display_name, is_test, auth_user_id) values ('Test Ben T', true, u_b) returning id into h_b;
  insert into public.hp_helpers (display_name, is_test, auth_user_id) values ('Test Cleo T', true, u_c) returning id into h_c;
  insert into public.hp_helpers (display_name, is_test, auth_user_id) values ('Test Dora T', true, u_d) returning id into h_d;

  insert into public.hp_shifts (id, day, type_key, start_time, duration_min, capacity, sort) values
    ('zt1', 'fri', 'bar', '17:30', 90, 1, 9001),   -- Fr 17:30–19:00
    ('zt2', 'fri', 'bar', '19:00', 90, 1, 9002),   -- Fr 19:00–20:30
    ('zt3', 'fri', 'bar', '23:30', 90, 1, 9003),   -- Fr 23:30–01:00
    ('zt4', 'fri', 'bar', '00:30', 90, 1, 9004),   -- Nacht auf Sa 00:30–02:00, zählt zum Freitag
    ('zt5', 'fri', 'springer', '18:00', 90, 1, 9005), -- Fr 18:00–19:30, überschneidet zt1 und zt2
    ('zt6', 'sat', 'bar', '10:00', 90, 2, 9006),   -- zwei Plätze
    ('zt7', 'sat', 'bar', '14:00', 90, 2, 9007);   -- zwei Plätze, einer bleibt frei
  insert into public.hp_assignments (shift_id, helper_id) values
    ('zt1', h_a), ('zt2', h_b), ('zt6', h_b), ('zt6', h_d), ('zt7', h_d);

  -- Tauschsperre für die Tests ausschalten (wird mit zurückgerollt).
  update public.hp_settings set value = 'false'::jsonb where key = 'swaps_locked';
  update public.hp_settings set value = 'null'::jsonb where key = 'swaps_lock_at';

  -- ------------------------------------------------------------ T1
  begin
    perform set_config('request.jwt.claims', jsonb_build_object('sub', u_a, 'role', 'authenticated')::text, true);
    r := public.hp_swap_request('zt1', 'zt2', 'bitte');
    assert (r ->> 'ok')::boolean and r ->> 'kind' = 'swap', 'Anfrage: ' || r::text;
    perform set_config('request.jwt.claims', jsonb_build_object('sub', u_b, 'role', 'authenticated')::text, true);
    r := public.hp_swap_accept((r ->> 'id')::bigint);
    assert (r ->> 'ok')::boolean, 'Annahme: ' || r::text;
    assert exists (select 1 from public.hp_assignments where shift_id = 'zt2' and helper_id = h_a), 'A nicht in zt2';
    assert exists (select 1 from public.hp_assignments where shift_id = 'zt1' and helper_id = h_b), 'B nicht in zt1';
    assert not exists (select 1 from public.hp_assignments where shift_id = 'zt1' and helper_id = h_a), 'A noch in zt1';
    assert not exists (select 1 from public.hp_assignments where shift_id = 'zt2' and helper_id = h_b), 'B noch in zt2';
    assert (select count(*) from public.hp_assignments where shift_id = 'zt1') = 1, 'zt1 nicht gleich voll';
    assert (select count(*) from public.hp_assignments where shift_id = 'zt2') = 1, 'zt2 nicht gleich voll';
    assert (select count(*) from public.hp_swaps where status = 'accepted' and accepted_by = h_b) = 1, 'Status';
    assert exists (select 1 from public.hp_notifications where helper_id = h_a and kind = 'swap_accepted'), 'A ohne Nachricht';
    assert exists (select 1 from public.hp_notifications where helper_id = h_b and kind = 'swap_request'), 'B ohne Anfrage';
    raise exception using errcode = 'HPT00';
  exception
    when sqlstate 'HPT00' then res := res || jsonb_build_object('t', 'T1', 'ok', true);
    when assert_failure then res := res || jsonb_build_object('t', 'T1', 'ok', false, 'err', sqlerrm);
    when others then res := res || jsonb_build_object('t', 'T1', 'ok', false, 'err', sqlerrm);
  end;

  -- ------------------------------------------------------------ T2: Zielschicht voll (alter Fehler S3)
  begin
    perform set_config('request.jwt.claims', jsonb_build_object('sub', u_a, 'role', 'authenticated')::text, true);
    r := public.hp_swap_request('zt1', 'zt6', '');
    assert (r ->> 'ok')::boolean and r ->> 'kind' = 'swap', 'Anfrage: ' || r::text;
    perform set_config('request.jwt.claims', jsonb_build_object('sub', u_d, 'role', 'authenticated')::text, true);
    r := public.hp_swap_accept((r ->> 'id')::bigint);
    assert (r ->> 'ok')::boolean, 'Annahme: ' || r::text;
    assert exists (select 1 from public.hp_assignments where shift_id = 'zt6' and helper_id = h_a), 'A nicht in zt6';
    assert exists (select 1 from public.hp_assignments where shift_id = 'zt1' and helper_id = h_d), 'D nicht in zt1 (Ausgangsschicht wäre leer)';
    assert exists (select 1 from public.hp_assignments where shift_id = 'zt6' and helper_id = h_b), 'B aus zt6 verschwunden';
    assert (select count(*) from public.hp_assignments where shift_id = 'zt6') = 2, 'zt6 nicht mehr voll';
    assert (select count(*) from public.hp_assignments where shift_id = 'zt1') = 1, 'zt1 unbesetzt';
    raise exception using errcode = 'HPT00';
  exception
    when sqlstate 'HPT00' then res := res || jsonb_build_object('t', 'T2', 'ok', true);
    when assert_failure then res := res || jsonb_build_object('t', 'T2', 'ok', false, 'err', sqlerrm);
    when others then res := res || jsonb_build_object('t', 'T2', 'ok', false, 'err', sqlerrm);
  end;

  -- ------------------------------------------------------------ T3: doppelte Annahme
  begin
    perform set_config('request.jwt.claims', jsonb_build_object('sub', u_a, 'role', 'authenticated')::text, true);
    r := public.hp_swap_request('zt1', 'zt2', '');
    s1 := (r ->> 'id')::bigint;
    perform set_config('request.jwt.claims', jsonb_build_object('sub', u_b, 'role', 'authenticated')::text, true);
    r := public.hp_swap_accept(s1);
    assert (r ->> 'ok')::boolean, 'erste Annahme: ' || r::text;
    select string_agg(shift_id || ':' || helper_id, ',' order by shift_id, helper_id) into v_before from public.hp_assignments;
    r2 := public.hp_swap_accept(s1);
    assert r2 ->> 'code' = 'SWAP_STALE', 'zweite Annahme: ' || r2::text;
    select string_agg(shift_id || ':' || helper_id, ',' order by shift_id, helper_id) into v_after from public.hp_assignments;
    assert v_before = v_after, 'zweiter Aufruf hat etwas geändert';
    assert (select count(*) from public.hp_notifications where kind = 'swap_accepted') = 2, 'doppelte Benachrichtigung';
    raise exception using errcode = 'HPT00';
  exception
    when sqlstate 'HPT00' then res := res || jsonb_build_object('t', 'T3', 'ok', true);
    when assert_failure then res := res || jsonb_build_object('t', 'T3', 'ok', false, 'err', sqlerrm);
    when others then res := res || jsonb_build_object('t', 'T3', 'ok', false, 'err', sqlerrm);
  end;

  -- ------------------------------------------------------------ T4: A wurde nach der Anfrage entfernt
  begin
    perform set_config('request.jwt.claims', jsonb_build_object('sub', u_a, 'role', 'authenticated')::text, true);
    r := public.hp_swap_request('zt1', 'zt2', '');
    s1 := (r ->> 'id')::bigint;
    perform set_config('request.jwt.claims', jsonb_build_object('sub', u_admin, 'role', 'authenticated')::text, true);
    r := public.hp_admin_unassign('zt1', h_a);
    assert (r ->> 'ok')::boolean, 'Entfernen: ' || r::text;
    select string_agg(shift_id || ':' || helper_id, ',' order by shift_id, helper_id) into v_before from public.hp_assignments;
    perform set_config('request.jwt.claims', jsonb_build_object('sub', u_b, 'role', 'authenticated')::text, true);
    r := public.hp_swap_accept(s1);
    assert r ->> 'code' = 'SWAP_STALE', 'Annahme: ' || r::text;
    select string_agg(shift_id || ':' || helper_id, ',' order by shift_id, helper_id) into v_after from public.hp_assignments;
    assert v_before = v_after, 'Plan hat sich geändert';
    assert exists (select 1 from public.hp_assignments where shift_id = 'zt2' and helper_id = h_b), 'B nicht mehr in zt2';
    raise exception using errcode = 'HPT00';
  exception
    when sqlstate 'HPT00' then res := res || jsonb_build_object('t', 'T4', 'ok', true);
    when assert_failure then res := res || jsonb_build_object('t', 'T4', 'ok', false, 'err', sqlerrm);
    when others then res := res || jsonb_build_object('t', 'T4', 'ok', false, 'err', sqlerrm);
  end;

  -- ------------------------------------------------------------ T5: B ist nicht mehr in der Zielschicht
  begin
    perform set_config('request.jwt.claims', jsonb_build_object('sub', u_a, 'role', 'authenticated')::text, true);
    r := public.hp_swap_request('zt1', 'zt6', '');
    s1 := (r ->> 'id')::bigint;
    assert r ->> 'kind' = 'swap', 'Art: ' || r::text;
    perform set_config('request.jwt.claims', jsonb_build_object('sub', u_admin, 'role', 'authenticated')::text, true);
    r := public.hp_admin_unassign('zt6', h_b);
    assert (r ->> 'ok')::boolean, 'Entfernen: ' || r::text;
    assert (select status from public.hp_swaps where id = s1) = 'pending', 'Vorgang sollte offen bleiben (D kann noch annehmen)';
    select string_agg(shift_id || ':' || helper_id, ',' order by shift_id, helper_id) into v_before from public.hp_assignments;
    perform set_config('request.jwt.claims', jsonb_build_object('sub', u_b, 'role', 'authenticated')::text, true);
    r := public.hp_swap_accept(s1);
    assert r ->> 'code' = 'SWAP_NOT_ALLOWED', 'Annahme: ' || r::text;
    select string_agg(shift_id || ':' || helper_id, ',' order by shift_id, helper_id) into v_after from public.hp_assignments;
    assert v_before = v_after, 'Plan hat sich geändert';
    raise exception using errcode = 'HPT00';
  exception
    when sqlstate 'HPT00' then res := res || jsonb_build_object('t', 'T5', 'ok', true);
    when assert_failure then res := res || jsonb_build_object('t', 'T5', 'ok', false, 'err', sqlerrm);
    when others then res := res || jsonb_build_object('t', 'T5', 'ok', false, 'err', sqlerrm);
  end;

  -- ------------------------------------------------------------ T5b: Zielschicht leer → Vorgang verfällt
  begin
    perform set_config('request.jwt.claims', jsonb_build_object('sub', u_a, 'role', 'authenticated')::text, true);
    r := public.hp_swap_request('zt1', 'zt2', '');
    s1 := (r ->> 'id')::bigint;
    perform set_config('request.jwt.claims', jsonb_build_object('sub', u_admin, 'role', 'authenticated')::text, true);
    perform public.hp_admin_unassign('zt2', h_b);
    assert (select status from public.hp_swaps where id = s1) = 'expired', 'Vorgang nicht verfallen';
    assert exists (select 1 from public.hp_notifications where helper_id = h_a and kind = 'swap_expired' and swap_id = s1), 'A nicht informiert';
    perform set_config('request.jwt.claims', jsonb_build_object('sub', u_b, 'role', 'authenticated')::text, true);
    r := public.hp_swap_accept(s1);
    assert r ->> 'code' = 'SWAP_STALE', 'Annahme: ' || r::text;
    assert exists (select 1 from public.hp_assignments where shift_id = 'zt1' and helper_id = h_a), 'A nicht mehr in zt1';
    raise exception using errcode = 'HPT00';
  exception
    when sqlstate 'HPT00' then res := res || jsonb_build_object('t', 'T5b', 'ok', true);
    when assert_failure then res := res || jsonb_build_object('t', 'T5b', 'ok', false, 'err', sqlerrm);
    when others then res := res || jsonb_build_object('t', 'T5b', 'ok', false, 'err', sqlerrm);
  end;

  -- ------------------------------------------------------------ T6: Überschneidung bei B, mit Nachtschicht
  begin
    -- A gibt zt3 (Fr 23:30–01:00) ab und will zt2. B hat zusätzlich zt4 (00:30–02:00).
    insert into public.hp_assignments (shift_id, helper_id) values ('zt3', h_a), ('zt4', h_b);
    perform set_config('request.jwt.claims', jsonb_build_object('sub', u_a, 'role', 'authenticated')::text, true);
    r := public.hp_swap_request('zt3', 'zt2', '');
    assert (r ->> 'ok')::boolean, 'Anfrage: ' || r::text;
    s1 := (r ->> 'id')::bigint;
    select string_agg(shift_id || ':' || helper_id, ',' order by shift_id, helper_id) into v_before from public.hp_assignments;
    perform set_config('request.jwt.claims', jsonb_build_object('sub', u_b, 'role', 'authenticated')::text, true);
    r := public.hp_swap_accept(s1);
    assert r ->> 'code' = 'SWAP_OVERLAP', 'Annahme: ' || r::text;
    select string_agg(shift_id || ':' || helper_id, ',' order by shift_id, helper_id) into v_after from public.hp_assignments;
    assert v_before = v_after, 'Plan hat sich geändert';
    assert (select status from public.hp_swaps where id = s1) = 'pending', 'Vorgang nicht mehr offen';
    -- Gegenprobe: zt3 endet um 01:00, zt4 beginnt um 00:30 derselben Nacht.
    assert (select start_min from public.hp_shifts where id = 'zt4') = 1470, 'Nachtschicht zählt nicht als Folgetag';
    raise exception using errcode = 'HPT00';
  exception
    when sqlstate 'HPT00' then res := res || jsonb_build_object('t', 'T6', 'ok', true);
    when assert_failure then res := res || jsonb_build_object('t', 'T6', 'ok', false, 'err', sqlerrm);
    when others then res := res || jsonb_build_object('t', 'T6', 'ok', false, 'err', sqlerrm);
  end;

  -- ------------------------------------------------------------ T6b: Überschneidung schon bei der Anfrage
  begin
    -- A hat zt1 (17:30–19:00) und zt3. zt5 (18:00–19:30) überschneidet zt1.
    insert into public.hp_assignments (shift_id, helper_id) values ('zt3', h_a), ('zt5', h_c);
    perform set_config('request.jwt.claims', jsonb_build_object('sub', u_a, 'role', 'authenticated')::text, true);
    r := public.hp_swap_request('zt3', 'zt5', '');
    assert r ->> 'code' = 'SWAP_OVERLAP', 'Anfrage: ' || r::text;
    assert (select count(*) from public.hp_swaps) = 0, 'Vorgang trotzdem angelegt';
    -- zt1 selbst gegen zt5 tauschen ist erlaubt: die abgegebene Schicht zählt nicht mit.
    r := public.hp_swap_request('zt1', 'zt5', '');
    assert (r ->> 'ok')::boolean, 'Anfrage zt1→zt5: ' || r::text;
    raise exception using errcode = 'HPT00';
  exception
    when sqlstate 'HPT00' then res := res || jsonb_build_object('t', 'T6b', 'ok', true);
    when assert_failure then res := res || jsonb_build_object('t', 'T6b', 'ok', false, 'err', sqlerrm);
    when others then res := res || jsonb_build_object('t', 'T6b', 'ok', false, 'err', sqlerrm);
  end;

  -- ------------------------------------------------------------ T7: Unbeteiligter nimmt an
  begin
    perform set_config('request.jwt.claims', jsonb_build_object('sub', u_a, 'role', 'authenticated')::text, true);
    r := public.hp_swap_request('zt1', 'zt2', '');
    s1 := (r ->> 'id')::bigint;
    select string_agg(shift_id || ':' || helper_id, ',' order by shift_id, helper_id) into v_before from public.hp_assignments;
    perform set_config('request.jwt.claims', jsonb_build_object('sub', u_c, 'role', 'authenticated')::text, true);
    r := public.hp_swap_accept(s1);
    assert r ->> 'code' = 'SWAP_NOT_ALLOWED', 'Annahme durch C: ' || r::text;
    r := public.hp_swap_reject(s1);
    assert r ->> 'code' = 'SWAP_NOT_ALLOWED', 'Ablehnung durch C: ' || r::text;
    r := public.hp_swap_cancel(s1);
    assert r ->> 'code' = 'SWAP_NOT_ALLOWED', 'Rückzug durch C: ' || r::text;
    -- Auch die anfragende Person kann ihren eigenen Tausch nicht annehmen.
    perform set_config('request.jwt.claims', jsonb_build_object('sub', u_a, 'role', 'authenticated')::text, true);
    r := public.hp_swap_accept(s1);
    assert r ->> 'code' = 'SWAP_NOT_ALLOWED', 'Annahme durch A: ' || r::text;
    select string_agg(shift_id || ':' || helper_id, ',' order by shift_id, helper_id) into v_after from public.hp_assignments;
    assert v_before = v_after, 'Plan hat sich geändert';
    assert (select status from public.hp_swaps where id = s1) = 'pending', 'Vorgang nicht mehr offen';
    raise exception using errcode = 'HPT00';
  exception
    when sqlstate 'HPT00' then res := res || jsonb_build_object('t', 'T7', 'ok', true);
    when assert_failure then res := res || jsonb_build_object('t', 'T7', 'ok', false, 'err', sqlerrm);
    when others then res := res || jsonb_build_object('t', 'T7', 'ok', false, 'err', sqlerrm);
  end;

  -- ------------------------------------------------------------ T8: Tausch gesperrt
  begin
    perform set_config('request.jwt.claims', jsonb_build_object('sub', u_a, 'role', 'authenticated')::text, true);
    r := public.hp_swap_request('zt1', 'zt2', '');
    s1 := (r ->> 'id')::bigint;
    perform set_config('request.jwt.claims', jsonb_build_object('sub', u_admin, 'role', 'authenticated')::text, true);
    r := public.hp_admin_set_setting('swaps_locked', 'true'::jsonb);
    assert (r ->> 'ok')::boolean, 'Sperren: ' || r::text;
    select string_agg(shift_id || ':' || helper_id, ',' order by shift_id, helper_id) into v_before from public.hp_assignments;
    perform set_config('request.jwt.claims', jsonb_build_object('sub', u_b, 'role', 'authenticated')::text, true);
    r := public.hp_swap_accept(s1);
    assert r ->> 'code' = 'SWAP_LOCKED', 'Annahme: ' || r::text;
    r := public.hp_swap_request('zt2', 'zt1', '');
    assert r ->> 'code' = 'SWAP_LOCKED', 'Anfrage: ' || r::text;
    select string_agg(shift_id || ':' || helper_id, ',' order by shift_id, helper_id) into v_after from public.hp_assignments;
    assert v_before = v_after, 'Plan hat sich geändert';
    -- Sperre über den Zeitpunkt statt über den Schalter.
    perform set_config('request.jwt.claims', jsonb_build_object('sub', u_admin, 'role', 'authenticated')::text, true);
    perform public.hp_admin_set_setting('swaps_locked', 'false'::jsonb);
    perform public.hp_admin_set_setting('swaps_lock_at', to_jsonb((now() - interval '1 minute')::text));
    perform set_config('request.jwt.claims', jsonb_build_object('sub', u_b, 'role', 'authenticated')::text, true);
    r := public.hp_swap_accept(s1);
    assert r ->> 'code' = 'SWAP_LOCKED', 'Annahme nach Sperrzeitpunkt: ' || r::text;
    raise exception using errcode = 'HPT00';
  exception
    when sqlstate 'HPT00' then res := res || jsonb_build_object('t', 'T8', 'ok', true);
    when assert_failure then res := res || jsonb_build_object('t', 'T8', 'ok', false, 'err', sqlerrm);
    when others then res := res || jsonb_build_object('t', 'T8', 'ok', false, 'err', sqlerrm);
  end;

  -- ------------------------------------------------------------ T9: Wechsel auf freien Platz
  begin
    perform set_config('request.jwt.claims', jsonb_build_object('sub', u_a, 'role', 'authenticated')::text, true);
    r := public.hp_swap_request('zt1', 'zt7', '');
    assert (r ->> 'ok')::boolean and r ->> 'kind' = 'move', 'Anfrage: ' || r::text;
    s1 := (r ->> 'id')::bigint;
    r := public.hp_swap_accept(s1);
    assert r ->> 'code' = 'SWAP_NOT_ALLOWED', 'Selbst angenommen: ' || r::text;
    perform set_config('request.jwt.claims', jsonb_build_object('sub', u_d, 'role', 'authenticated')::text, true);
    r := public.hp_swap_accept(s1);
    assert r ->> 'code' = 'SWAP_NOT_ALLOWED', 'Von D angenommen: ' || r::text;
    assert exists (select 1 from public.hp_assignments where shift_id = 'zt1' and helper_id = h_a), 'A schon weg';
    perform set_config('request.jwt.claims', jsonb_build_object('sub', u_admin, 'role', 'authenticated')::text, true);
    r := public.hp_swap_accept(s1);
    assert (r ->> 'ok')::boolean, 'Freigabe: ' || r::text;
    assert exists (select 1 from public.hp_assignments where shift_id = 'zt7' and helper_id = h_a), 'A nicht in zt7';
    assert (select count(*) from public.hp_assignments where shift_id = 'zt1') = 0, 'zt1 hat keinen freien Platz';
    assert (select count(*) from public.hp_assignments where shift_id = 'zt7') = 2, 'zt7 nicht voll';
    assert exists (select 1 from public.hp_notifications where helper_id = h_a and kind = 'swap_accepted' and swap_id = s1), 'A nicht informiert';
    raise exception using errcode = 'HPT00';
  exception
    when sqlstate 'HPT00' then res := res || jsonb_build_object('t', 'T9', 'ok', true);
    when assert_failure then res := res || jsonb_build_object('t', 'T9', 'ok', false, 'err', sqlerrm);
    when others then res := res || jsonb_build_object('t', 'T9', 'ok', false, 'err', sqlerrm);
  end;

  -- ------------------------------------------------------------ T10: zwei offene Anfragen, eine wird angenommen
  begin
    perform set_config('request.jwt.claims', jsonb_build_object('sub', u_a, 'role', 'authenticated')::text, true);
    r := public.hp_swap_request('zt1', 'zt2', '');
    s1 := (r ->> 'id')::bigint;
    r := public.hp_swap_request('zt1', 'zt6', '');
    s2 := (r ->> 'id')::bigint;
    assert s1 is not null and s2 is not null and s1 <> s2, 'zwei Anfragen erwartet';
    perform set_config('request.jwt.claims', jsonb_build_object('sub', u_b, 'role', 'authenticated')::text, true);
    r := public.hp_swap_accept(s1);
    assert (r ->> 'ok')::boolean, 'Annahme: ' || r::text;
    assert (select status from public.hp_swaps where id = s2) = 'expired', 'zweite Anfrage nicht verfallen';
    assert exists (select 1 from public.hp_notifications where helper_id = h_a and kind = 'swap_expired' and swap_id = s2), 'A nicht informiert';
    perform set_config('request.jwt.claims', jsonb_build_object('sub', u_d, 'role', 'authenticated')::text, true);
    r := public.hp_swap_accept(s2);
    assert r ->> 'code' = 'SWAP_STALE', 'verfallene Anfrage angenommen: ' || r::text;
    assert (select count(*) from public.hp_assignments where helper_id = h_a) = 1, 'A hat nicht genau eine Schicht';
    raise exception using errcode = 'HPT00';
  exception
    when sqlstate 'HPT00' then res := res || jsonb_build_object('t', 'T10', 'ok', true);
    when assert_failure then res := res || jsonb_build_object('t', 'T10', 'ok', false, 'err', sqlerrm);
    when others then res := res || jsonb_build_object('t', 'T10', 'ok', false, 'err', sqlerrm);
  end;

  -- ------------------------------------------------------------ T10b: Anfrage eines Dritten auf eine getauschte Zuweisung
  begin
    -- C will mit A tauschen (zt5 gegen zt1). Bevor A antwortet, tauscht A mit B.
    insert into public.hp_assignments (shift_id, helper_id) values ('zt4', h_c);
    perform set_config('request.jwt.claims', jsonb_build_object('sub', u_c, 'role', 'authenticated')::text, true);
    r := public.hp_swap_request('zt4', 'zt1', '');
    assert (r ->> 'ok')::boolean and r ->> 'kind' = 'swap', 'Anfrage C: ' || r::text;
    s2 := (r ->> 'id')::bigint;
    perform set_config('request.jwt.claims', jsonb_build_object('sub', u_a, 'role', 'authenticated')::text, true);
    r := public.hp_swap_request('zt1', 'zt2', '');
    s1 := (r ->> 'id')::bigint;
    perform set_config('request.jwt.claims', jsonb_build_object('sub', u_b, 'role', 'authenticated')::text, true);
    r := public.hp_swap_accept(s1);
    assert (r ->> 'ok')::boolean, 'Annahme: ' || r::text;
    -- In zt1 sitzt jetzt B, der die Anfrage von C nie gesehen hat: sie verfällt.
    assert (select status from public.hp_swaps where id = s2) = 'expired', 'Anfrage von C nicht verfallen';
    assert exists (select 1 from public.hp_notifications where helper_id = h_c and kind = 'swap_expired' and swap_id = s2), 'C nicht informiert';
    r := public.hp_swap_accept(s2);
    assert r ->> 'code' = 'SWAP_STALE', 'B nimmt verfallene Anfrage an: ' || r::text;
    assert exists (select 1 from public.hp_assignments where shift_id = 'zt4' and helper_id = h_c), 'C nicht mehr in zt4';
    raise exception using errcode = 'HPT00';
  exception
    when sqlstate 'HPT00' then res := res || jsonb_build_object('t', 'T10b', 'ok', true);
    when assert_failure then res := res || jsonb_build_object('t', 'T10b', 'ok', false, 'err', sqlerrm);
    when others then res := res || jsonb_build_object('t', 'T10b', 'ok', false, 'err', sqlerrm);
  end;

  raise exception 'HP_TEST_RESULTS %', res::text;
end $$;
