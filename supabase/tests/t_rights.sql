-- Rechte- und Sicherheitstests R1–R21 (Sprint 4.1 und Akzeptanz 1.4, 2.5).
--
-- Läuft mit synthetischen Daten. Jeder Fall wird einzeln zurückgerollt, am Ende
-- bricht der Block mit dem Ergebnis ab und rollt damit auch die Testdaten
-- zurück. Das Ergebnis steht in der Fehlermeldung nach „HP_TEST_RESULTS“.
-- Rollenwechsel über SET ROLE (anon, authenticated) und die JWT-Angaben.
--
-- Nur bei leerer Helfertabelle: Sonst bricht der Block sofort ab, ohne etwas zu
-- ändern. Für eine Prüfung im laufenden Betrieb gibt es check_rechte.sql.

do $$
declare
  v_owner text := current_user;
  u_admin uuid := gen_random_uuid();
  u_a uuid := gen_random_uuid();
  u_b uuid := gen_random_uuid();
  u_x uuid := gen_random_uuid();   -- angemeldet, aber weder Orga noch Helfer
  u_new uuid := gen_random_uuid();
  u_ci uuid := gen_random_uuid();  -- Konto einer anderen Anwendung im selben Projekt
  h_a uuid;
  h_b uuid;
  h_off uuid;                      -- deaktivierter Helfer
  h_real uuid;                     -- kein Testhelfer
  tables text[] := array['hp_helpers', 'hp_admins', 'hp_shifts', 'hp_assignments', 'hp_swaps',
                         'hp_notifications', 'hp_settings', 'hp_audit', 'hp_login_attempts',
                         'hp_help_offers', 'hp_offer_rate'];
  client_rpcs text[] := array[
    'hp_my_context()', 'hp_state()', 'hp_mark_read(bigint[])',
    'hp_swap_request(text,text,text)', 'hp_swap_accept(bigint)', 'hp_swap_reject(bigint)', 'hp_swap_cancel(bigint)',
    'hp_admin_assign(text,uuid,boolean)', 'hp_admin_unassign(text,uuid)',
    'hp_admin_upsert_helper(uuid,text,text,text,boolean,integer,boolean)', 'hp_admin_add_helpers(text[],boolean)',
    'hp_admin_deactivate_helper(uuid,boolean)', 'hp_admin_reactivate_helper(uuid)',
    'hp_admin_set_setting(text,jsonb)', 'hp_admin_remove_test_data()', 'hp_admin_purge(text)',
    'hp_admin_new_login_code(uuid)', 'hp_admin_revoke_login(uuid)', 'hp_admin_list_help_offers()'];
  res jsonb := '[]'::jsonb;
  r jsonb;
  r2 jsonb;
  t text;
  q text;
  n bigint;
  bad text := '';
  v_code text;
  v_code2 text;
  v_swap bigint;
  f record;
begin
  -- Die Fälle zählen Zeilen. Stehen schon Helfer in der Datenbank, würden mehrere
  -- Fälle rot, obwohl alles stimmt. Dann lieber gar nicht laufen.
  if exists (select 1 from public.hp_helpers) then
    raise exception 'HP_TEST_ABGEBROCHEN: In hp_helpers stehen schon Zeilen. Diese Tests laufen nur bei leerer Helfertabelle, auch ohne Testhelfer. Im laufenden Betrieb stattdessen supabase/tests/check_rechte.sql ausführen.';
  end if;
  -- ------------------------------------------------------------ Testdaten
  -- Helfer-Konten tragen Adresse und Marke wie von der Login-Funktion angelegt.
  -- Das Orga-Konto trägt hier absichtlich beides auch: Geschützt ist es allein
  -- durch den Eintrag in hp_admins. u_ci hat nur die ähnliche Adresse.
  insert into auth.users (id, email, raw_app_meta_data, created_at) values
    (u_admin, 'hp-test-admin-' || u_admin || '@helfer.bendito.invalid', '{"hp": "helper"}', now()),
    (u_a, 'hp-' || u_a || '@helfer.bendito.invalid', '{"provider": "email", "hp": "helper"}', now()),
    (u_b, 'hp-' || u_b || '@helfer.bendito.invalid', '{"provider": "email", "hp": "helper"}', now()),
    (u_x, 'fremd-' || u_x || '@example.invalid', '{"hp": "helper"}', now()),
    (u_new, 'hp-' || u_new || '@helfer.bendito.invalid', '{"provider": "email", "hp": "helper"}', now()),
    (u_ci, 'hp-' || u_ci || '@helfer.bendito.invalid', '{"provider": "email"}', null);
  insert into public.hp_admins (user_id) values (u_admin);
  insert into public.hp_helpers (display_name, is_test, auth_user_id) values ('Test Anna R', true, u_a) returning id into h_a;
  insert into public.hp_helpers (display_name, is_test, auth_user_id) values ('Test Ben R', true, u_b) returning id into h_b;
  insert into public.hp_helpers (display_name, is_test, active) values ('Test Aus R', true, false) returning id into h_off;
  insert into public.hp_helpers (display_name, is_test) values ('Probe Kein Test R', false) returning id into h_real;
  insert into public.hp_shifts (id, day, type_key, start_time, duration_min, capacity, sort) values
    ('zr1', 'fri', 'bar', '17:30', 90, 1, 9101),
    ('zr2', 'fri', 'bar', '19:00', 90, 1, 9102),
    ('zr3', 'fri', 'springer', '18:00', 90, 1, 9103),
    ('zr4', 'sat', 'bar', '10:00', 90, 1, 9104);
  insert into public.hp_assignments (shift_id, helper_id) values ('zr1', h_a), ('zr2', h_b), ('zr4', h_real);
  insert into public.hp_login_attempts (ip_hash, ok) values ('fixture', true);
  update public.hp_settings set value = 'false'::jsonb where key = 'swaps_locked';
  update public.hp_settings set value = 'null'::jsonb where key = 'swaps_lock_at';
  -- Ein offener Tausch A→B, damit hp_swaps und hp_notifications Zeilen haben.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', u_a, 'role', 'authenticated')::text, true);
  r := public.hp_swap_request('zr1', 'zr2', 'Notiz');
  v_swap := (r ->> 'id')::bigint;
  perform set_config('request.jwt.claims', '', true);

  -- ------------------------------------------------------------ R1: anon liest keine Zeile
  begin
    bad := '';
    -- Die beiden neuen Tabellen sind im Raster leer. Eine Zeile je Tabelle,
    -- damit „anon sieht nichts“ wirklich geprüft wird. Die Zeilen rollen mit.
    insert into public.hp_help_offers (
      display_name, email, arrive_thu, stay_mon, pre_milonga, dinner_sun
    ) values (
      'Test Probe R', 'probe-r1@example.test', 'ja', 'nein', 'vielleicht', 'ja'
    );
    insert into public.hp_offer_rate (bucket, ip_hash, n)
    values (date_trunc('hour', now()), repeat('d', 32), 1);
    foreach t in array tables loop
      execute format('select count(*) from public.%I', t) into n;
      if n = 0 then bad := bad || ' leer:' || t; end if;
    end loop;
    assert bad = '', 'Testdaten unvollständig:' || bad;
    -- Schicht 1: Tabellenrechte sind entzogen.
    perform set_config('role', 'anon', true);
    foreach t in array tables loop
      begin
        execute format('select count(*) from public.%I', t) into n;
        bad := bad || ' lesbar:' || t;
      exception when insufficient_privilege then null;
      end;
    end loop;
    perform set_config('role', v_owner, true);
    assert bad = '', 'anon hat Tabellenrechte:' || bad;
    -- Schicht 2: Selbst mit Tabellenrechten lässt die Zeilenregel nichts durch.
    foreach t in array tables loop
      execute format('grant select on public.%I to anon', t);
    end loop;
    perform set_config('role', 'anon', true);
    foreach t in array tables loop
      execute format('select count(*) from public.%I', t) into n;
      if n <> 0 then bad := bad || ' ' || t || '=' || n; end if;
    end loop;
    perform set_config('role', v_owner, true);
    assert bad = '', 'anon sieht Zeilen:' || bad;
    raise exception using errcode = 'HPT00';
  exception
    when sqlstate 'HPT00' then res := res || jsonb_build_object('t', 'R1', 'ok', true);
    when assert_failure then res := res || jsonb_build_object('t', 'R1', 'ok', false, 'err', sqlerrm);
    when others then res := res || jsonb_build_object('t', 'R1', 'ok', false, 'err', sqlerrm);
  end;

  -- ------------------------------------------------------------ R2: anon kann keine Funktion ausführen
  begin
    bad := '';
    for f in
      select p.oid, p.oid::regprocedure::text as sig
      from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
      where (ns.nspname = 'public' and p.proname like 'hp\_%') or ns.nspname = 'hp_private'
    loop
      if has_function_privilege('anon', f.oid, 'execute') then bad := bad || ' ' || f.sig; end if;
    end loop;
    assert bad = '', 'anon darf ausführen:' || bad;
    assert not has_schema_privilege('anon', 'hp_private', 'usage'), 'anon darf das interne Schema nutzen';
    perform set_config('role', 'anon', true);
    begin
      perform public.hp_state();
      bad := bad || ' hp_state';
    exception when insufficient_privilege then null;
    end;
    begin
      perform public.hp_my_context();
      bad := bad || ' hp_my_context';
    exception when insufficient_privilege then null;
    end;
    begin
      perform public.hp_login_lookup('x', 'y');
      bad := bad || ' hp_login_lookup';
    exception when insufficient_privilege then null;
    end;
    perform set_config('role', v_owner, true);
    assert bad = '', 'anon konnte aufrufen:' || bad;
    raise exception using errcode = 'HPT00';
  exception
    when sqlstate 'HPT00' then res := res || jsonb_build_object('t', 'R2', 'ok', true);
    when assert_failure then res := res || jsonb_build_object('t', 'R2', 'ok', false, 'err', sqlerrm);
    when others then res := res || jsonb_build_object('t', 'R2', 'ok', false, 'err', sqlerrm);
  end;

  -- ------------------------------------------------------------ R3: Helfer kann keine Tabelle direkt lesen oder beschreiben
  begin
    bad := '';
    perform set_config('request.jwt.claims', jsonb_build_object('sub', u_a, 'role', 'authenticated')::text, true);
    perform set_config('role', 'authenticated', true);
    foreach q in array array[
      'select count(*) from public.hp_helpers',
      'select count(*) from public.hp_notifications',
      format('insert into public.hp_assignments (shift_id, helper_id) values (''zr3'', %L)', h_a),
      'update public.hp_helpers set display_name = ''x'' where true',
      'update public.hp_settings set value = ''true''::jsonb where key = ''swaps_locked''',
      'delete from public.hp_swaps where true',
      format('insert into public.hp_admins (user_id) values (%L)', u_a)
    ] loop
      begin
        execute q;
        bad := bad || ' [' || q || ']';
      exception when insufficient_privilege then null;
      end;
    end loop;
    perform set_config('role', v_owner, true);
    assert bad = '', 'Helfer durfte:' || bad;
    -- Schicht 2: mit Tabellenrechten greift die Zeilenregel.
    foreach t in array tables loop
      execute format('grant all on public.%I to authenticated', t);
    end loop;
    perform set_config('role', 'authenticated', true);
    foreach t in array tables loop
      execute format('select count(*) from public.%I', t) into n;
      if n <> 0 then bad := bad || ' liest ' || t; end if;
    end loop;
    begin
      execute format('insert into public.hp_assignments (shift_id, helper_id) values (''zr3'', %L)', h_a);
      bad := bad || ' insert';
    exception when insufficient_privilege then null;
    end;
    execute 'update public.hp_helpers set display_name = ''x'' where true';
    get diagnostics n = row_count;
    if n <> 0 then bad := bad || ' update'; end if;
    execute 'delete from public.hp_swaps where true';
    get diagnostics n = row_count;
    if n <> 0 then bad := bad || ' delete'; end if;
    perform set_config('role', v_owner, true);
    assert bad = '', 'Zeilenregel lässt durch:' || bad;
    assert (select count(*) from public.hp_assignments where shift_id = 'zr3') = 0, 'Zuweisung entstanden';
    raise exception using errcode = 'HPT00';
  exception
    when sqlstate 'HPT00' then res := res || jsonb_build_object('t', 'R3', 'ok', true);
    when assert_failure then res := res || jsonb_build_object('t', 'R3', 'ok', false, 'err', sqlerrm);
    when others then res := res || jsonb_build_object('t', 'R3', 'ok', false, 'err', sqlerrm);
  end;

  -- ------------------------------------------------------------ R4: Helfer ruft Orga-Funktionen → abgelehnt
  begin
    bad := '';
    perform set_config('request.jwt.claims', jsonb_build_object('sub', u_a, 'role', 'authenticated')::text, true);
    perform set_config('role', 'authenticated', true);
    foreach q in array array[
      format('select public.hp_admin_assign(''zr3'', %L, true)', h_a),
      format('select public.hp_admin_unassign(''zr2'', %L)', h_b),
      'select public.hp_admin_upsert_helper(null, ''Test Neu R'', ''#112233'', '''', false, null, true)',
      'select public.hp_admin_add_helpers(array[''Test Neu R''], true)',
      format('select public.hp_admin_deactivate_helper(%L, true)', h_b),
      format('select public.hp_admin_reactivate_helper(%L)', h_off),
      'select public.hp_admin_set_setting(''swaps_locked'', ''true''::jsonb)',
      'select public.hp_admin_remove_test_data()',
      'select public.hp_admin_purge(''LOESCHEN'')',
      format('select public.hp_admin_new_login_code(%L)', h_a),
      format('select public.hp_admin_revoke_login(%L)', h_b),
      'select public.hp_admin_revoke_login(null)'
    ] loop
      begin
        execute q;
        bad := bad || ' [' || q || ']';
      exception when insufficient_privilege then
        if sqlerrm <> 'NOT_ALLOWED' then bad := bad || ' [falscher Fehler: ' || sqlerrm || ']'; end if;
      end;
    end loop;
    perform set_config('role', v_owner, true);
    assert bad = '', 'Helfer durfte:' || bad;
    assert (select count(*) from public.hp_helpers) = 4, 'Helferzahl geändert';
    assert (select count(*) from public.hp_assignments) = 3, 'Zuweisungen geändert';
    assert (select value from public.hp_settings where key = 'swaps_locked') = 'false'::jsonb, 'Einstellung geändert';
    assert (select login_code_hash from public.hp_helpers where id = h_a) is null, 'Code erzeugt';
    raise exception using errcode = 'HPT00';
  exception
    when sqlstate 'HPT00' then res := res || jsonb_build_object('t', 'R4', 'ok', true);
    when assert_failure then res := res || jsonb_build_object('t', 'R4', 'ok', false, 'err', sqlerrm);
    when others then res := res || jsonb_build_object('t', 'R4', 'ok', false, 'err', sqlerrm);
  end;

  -- ------------------------------------------------------------ R5: Helfer sieht nur Eigenes, keine Geheimnisse
  begin
    perform set_config('request.jwt.claims', jsonb_build_object('sub', u_a, 'role', 'authenticated')::text, true);
    perform set_config('role', 'authenticated', true);
    r := public.hp_state();
    perform set_config('request.jwt.claims', jsonb_build_object('sub', u_b, 'role', 'authenticated')::text, true);
    r2 := public.hp_state();
    perform set_config('role', v_owner, true);
    assert r #>> '{ctx,role}' = 'helper' and (r #>> '{ctx,helper_id}')::uuid = h_a, 'Kontext A: ' || (r -> 'ctx')::text;
    assert jsonb_array_length(r -> 'notifications') = 0, 'A sieht fremde Benachrichtigungen';
    assert jsonb_array_length(r2 -> 'notifications') = 1, 'B sieht seine Anfrage nicht';
    assert r::text !~ 'login_code_hash|auth_user_id|is_test|has_login|signed_in', 'Helfer sieht interne Felder';
    assert r::text !~ 'Test Aus R', 'Helfer sieht deaktivierten Helfer';
    assert (select count(*) from jsonb_array_elements(r -> 'helpers')) = 3, 'Helferliste: ' || (r -> 'helpers')::text;
    -- Dritter Helfer ohne Beteiligung sieht den Tausch nicht.
    update public.hp_helpers set auth_user_id = u_new where id = h_real;
    perform set_config('request.jwt.claims', jsonb_build_object('sub', u_new, 'role', 'authenticated')::text, true);
    r := public.hp_state();
    assert jsonb_array_length(r -> 'swaps') = 0, 'Unbeteiligter sieht Tausch';
    assert jsonb_array_length(r2 -> 'swaps') = 1, 'B sieht den Tausch nicht';
    -- Orga sieht alles, aber weder Hash noch Auth-Kennung.
    perform set_config('request.jwt.claims', jsonb_build_object('sub', u_admin, 'role', 'authenticated')::text, true);
    r := public.hp_state();
    assert r #>> '{ctx,role}' = 'admin', 'Kontext Orga';
    assert (select count(*) from jsonb_array_elements(r -> 'helpers')) = 4, 'Orga sieht nicht alle Helfer';
    assert r::text !~ 'login_code_hash|auth_user_id', 'Orga-Abruf enthält Hash oder Auth-Kennung';
    -- Gelesen-Markierung wirkt nur auf Eigenes.
    perform set_config('request.jwt.claims', jsonb_build_object('sub', u_a, 'role', 'authenticated')::text, true);
    perform public.hp_mark_read(null);
    assert (select count(*) from public.hp_notifications where read_at is not null) = 0, 'A hat fremde Benachrichtigung markiert';
    raise exception using errcode = 'HPT00';
  exception
    when sqlstate 'HPT00' then res := res || jsonb_build_object('t', 'R5', 'ok', true);
    when assert_failure then res := res || jsonb_build_object('t', 'R5', 'ok', false, 'err', sqlerrm);
    when others then res := res || jsonb_build_object('t', 'R5', 'ok', false, 'err', sqlerrm);
  end;

  -- ------------------------------------------------------------ R6: angemeldet, aber ohne Zuordnung → kein Zugriff
  begin
    bad := '';
    perform set_config('request.jwt.claims', jsonb_build_object('sub', u_x, 'role', 'authenticated')::text, true);
    perform set_config('role', 'authenticated', true);
    r := public.hp_my_context();
    foreach q in array array[
      'select public.hp_state()',
      'select public.hp_mark_read(null)',
      'select public.hp_swap_request(''zr1'', ''zr2'', '''')',
      format('select public.hp_swap_accept(%s)', v_swap),
      format('select public.hp_swap_reject(%s)', v_swap),
      format('select public.hp_swap_cancel(%s)', v_swap),
      format('select public.hp_admin_assign(''zr3'', %L, false)', h_a)
    ] loop
      begin
        execute q;
        bad := bad || ' [' || q || ']';
      exception when insufficient_privilege then null;
      end;
    end loop;
    perform set_config('role', v_owner, true);
    assert r ->> 'role' = 'none' and r ->> 'helper_id' is null, 'Kontext: ' || r::text;
    assert bad = '', 'Fremdes Konto durfte:' || bad;
    assert (select status from public.hp_swaps where id = v_swap) = 'pending', 'Tausch verändert';
    raise exception using errcode = 'HPT00';
  exception
    when sqlstate 'HPT00' then res := res || jsonb_build_object('t', 'R6', 'ok', true);
    when assert_failure then res := res || jsonb_build_object('t', 'R6', 'ok', false, 'err', sqlerrm);
    when others then res := res || jsonb_build_object('t', 'R6', 'ok', false, 'err', sqlerrm);
  end;

  -- ------------------------------------------------------------ R7: Rechte-Matrix der Funktionen
  begin
    bad := '';
    for f in
      select p.oid, p.proname, p.oid::regprocedure::text as sig
      from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
      where ns.nspname = 'public' and p.proname like 'hp\_%'
    loop
      if f.sig = any (client_rpcs) then
        if not has_function_privilege('authenticated', f.oid, 'execute') then bad := bad || ' fehlt:' || f.sig; end if;
      else
        if has_function_privilege('authenticated', f.oid, 'execute') then bad := bad || ' zu viel:' || f.sig; end if;
      end if;
      if f.proname in ('hp_login_lookup', 'hp_login_bind', 'hp_submit_help_offer')
         and not has_function_privilege('service_role', f.oid, 'execute') then
        bad := bad || ' service_role fehlt:' || f.sig;
      end if;
    end loop;
    select count(*) into n from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public' and p.oid::regprocedure::text = any (client_rpcs);
    assert n = array_length(client_rpcs, 1), 'Liste der Client-Funktionen passt nicht zum Schema: ' || n;
    -- Interne Funktionen: für keine Client-Rolle ausführbar, Schema nicht nutzbar.
    select count(*) into n from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace where ns.nspname = 'hp_private';
    assert n >= 16, 'interne Funktionen fehlen: ' || n;
    for f in
      select p.oid, p.oid::regprocedure::text as sig
      from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
      where ns.nspname = 'hp_private'
    loop
      foreach t in array array['anon', 'authenticated', 'service_role'] loop
        if has_function_privilege(t, f.oid, 'execute') then bad := bad || ' intern für ' || t || ':' || f.sig; end if;
      end loop;
    end loop;
    foreach t in array array['anon', 'authenticated'] loop
      if has_schema_privilege(t, 'hp_private', 'usage') then bad := bad || ' Schema nutzbar für ' || t; end if;
    end loop;
    -- service_role braucht nur die beiden Login-Funktionen.
    for f in
      select p.oid, p.proname, p.oid::regprocedure::text as sig
      from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
      where ns.nspname = 'public' and p.proname like 'hp\_%' and p.proname not in ('hp_login_lookup', 'hp_login_bind', 'hp_submit_help_offer')
    loop
      if has_function_privilege('service_role', f.oid, 'execute') then bad := bad || ' service_role zu viel:' || f.sig; end if;
    end loop;
    assert bad = '', 'Rechte-Matrix:' || bad;
    raise exception using errcode = 'HPT00';
  exception
    when sqlstate 'HPT00' then res := res || jsonb_build_object('t', 'R7', 'ok', true);
    when assert_failure then res := res || jsonb_build_object('t', 'R7', 'ok', false, 'err', sqlerrm);
    when others then res := res || jsonb_build_object('t', 'R7', 'ok', false, 'err', sqlerrm);
  end;

  -- ------------------------------------------------------------ R8: Login-Code: einmalig, nur als Hash, sofort widerrufbar
  begin
    perform set_config('request.jwt.claims', jsonb_build_object('sub', u_admin, 'role', 'authenticated')::text, true);
    r := public.hp_admin_new_login_code(h_a);
    v_code := r ->> 'code';
    assert v_code ~ '^[0-9a-f]{64}$', 'Codeformat: ' || coalesce(v_code, 'null');
    assert (select login_code_hash from public.hp_helpers where id = h_a) = encode(sha256(convert_to(v_code, 'UTF8')), 'hex'), 'Hash passt nicht';
    assert not exists (select 1 from public.hp_helpers h where h.login_code_hash = v_code), 'Code im Klartext gespeichert';
    assert not exists (select 1 from public.hp_audit a where a.action like '%' || v_code || '%' or a.outcome like '%' || v_code || '%'), 'Code im Protokoll';
    -- Das bisherige Gerät von A ist sofort draußen.
    assert (select auth_user_id from public.hp_helpers where id = h_a) is null, 'alte Zuordnung besteht';
    assert not exists (select 1 from auth.users where id = u_a), 'altes Auth-Konto besteht';
    perform set_config('request.jwt.claims', jsonb_build_object('sub', u_a, 'role', 'authenticated')::text, true);
    begin
      perform public.hp_state();
      assert false, 'alte Sitzung hat noch Zugriff';
    exception when insufficient_privilege then null;
    end;
    -- Code einlösen und binden.
    r := public.hp_login_lookup(hp_private.code_hash(v_code), 'ip-r8');
    assert (r ->> 'ok')::boolean and (r ->> 'helper_id')::uuid = h_a and r ->> 'auth_user_id' is null, 'Einlösen: ' || r::text;
    assert public.hp_login_bind(h_a, hp_private.code_hash(v_code), u_new) = u_new, 'Binden';
    perform set_config('request.jwt.claims', jsonb_build_object('sub', u_new, 'role', 'authenticated')::text, true);
    r := public.hp_state();
    assert (r #>> '{ctx,helper_id}')::uuid = h_a, 'neue Sitzung gehört nicht zu A';
    -- Zweites Binden überschreibt nicht.
    assert public.hp_login_bind(h_a, hp_private.code_hash(v_code), u_x) = u_new, 'zweites Binden hat überschrieben';
    -- Erneuern: alter Code tot, alte Sitzung tot.
    perform set_config('request.jwt.claims', jsonb_build_object('sub', u_admin, 'role', 'authenticated')::text, true);
    r := public.hp_admin_new_login_code(h_a);
    v_code2 := r ->> 'code';
    assert v_code2 <> v_code, 'Code nicht erneuert';
    r := public.hp_login_lookup(hp_private.code_hash(v_code), 'ip-r8');
    r2 := public.hp_login_lookup(hp_private.code_hash('gibt-es-nicht'), 'ip-r8');
    assert r = r2 and r = '{"ok": false, "code": "INVALID"}'::jsonb, 'widerrufen und unbekannt unterscheiden sich: ' || r::text || ' / ' || r2::text;
    perform set_config('request.jwt.claims', jsonb_build_object('sub', u_new, 'role', 'authenticated')::text, true);
    begin
      perform public.hp_state();
      assert false, 'Sitzung überlebt die Erneuerung';
    exception when insufficient_privilege then null;
    end;
    r := public.hp_login_lookup(hp_private.code_hash(v_code2), 'ip-r8');
    assert (r ->> 'ok')::boolean, 'neuer Code geht nicht: ' || r::text;
    -- Widerrufen und deaktivieren.
    perform set_config('request.jwt.claims', jsonb_build_object('sub', u_admin, 'role', 'authenticated')::text, true);
    perform public.hp_admin_revoke_login(h_a);
    r := public.hp_login_lookup(hp_private.code_hash(v_code2), 'ip-r8');
    assert r ->> 'code' = 'INVALID', 'Code nach Widerruf gültig';
    r := public.hp_admin_new_login_code(h_off);
    assert r ->> 'code' = 'HELPER_INACTIVE', 'Code für deaktivierten Helfer: ' || r::text;
    -- Die Sperre hängt an der Zuordnung, nicht am Löschen des Auth-Kontos: Auch wenn
    -- das Konto bestehen bleibt (hier: fremdes Adressmuster), ist der Zugang weg.
    update public.hp_helpers set auth_user_id = u_x where id = h_b;
    perform public.hp_admin_new_login_code(h_b);
    assert exists (select 1 from auth.users where id = u_x), 'Vorbedingung: Konto sollte bestehen bleiben';
    perform set_config('request.jwt.claims', jsonb_build_object('sub', u_x, 'role', 'authenticated')::text, true);
    begin
      perform public.hp_state();
      assert false, 'Zugang besteht trotz neuem Code, weil das Auth-Konto noch existiert';
    exception when insufficient_privilege then null;
    end;
    raise exception using errcode = 'HPT00';
  exception
    when sqlstate 'HPT00' then res := res || jsonb_build_object('t', 'R8', 'ok', true);
    when assert_failure then res := res || jsonb_build_object('t', 'R8', 'ok', false, 'err', sqlerrm);
    when others then res := res || jsonb_build_object('t', 'R8', 'ok', false, 'err', sqlerrm);
  end;

  -- ------------------------------------------------------------ R9: begrenzte Fehlversuche, gültige Links kommen immer durch
  begin
    perform set_config('request.jwt.claims', jsonb_build_object('sub', u_admin, 'role', 'authenticated')::text, true);
    v_code := public.hp_admin_new_login_code(h_a) ->> 'code';
    for n in 1..10 loop
      r := public.hp_login_lookup(hp_private.code_hash('falsch-' || n), 'ip-r9');
      assert r ->> 'code' = 'INVALID', 'Versuch ' || n || ': ' || r::text;
    end loop;
    r := public.hp_login_lookup(hp_private.code_hash('falsch-11'), 'ip-r9');
    assert r ->> 'code' = 'RATE_LIMITED', 'elfter Fehlversuch: ' || r::text;
    r := public.hp_login_lookup(null, 'ip-r9');
    assert r ->> 'code' = 'RATE_LIMITED', 'leerer Code nach der Grenze: ' || r::text;
    -- Gesperrte Versuche werden nicht mehr mitgeschrieben: Die Tabelle wächst nicht unbegrenzt.
    assert (select count(*) from public.hp_login_attempts where ip_hash = 'ip-r9' and not ok) = 10, 'gesperrte Versuche gespeichert';
    -- Ein gültiger Link geht trotzdem, auch vom selben Absender (gemeinsames WLAN am Event).
    r := public.hp_login_lookup(hp_private.code_hash(v_code), 'ip-r9');
    assert (r ->> 'ok')::boolean and (r ->> 'helper_id')::uuid = h_a, 'gültiger Link durch fremde Fehlversuche gesperrt: ' || r::text;
    -- Ein anderer Absender ist nicht betroffen.
    r := public.hp_login_lookup(hp_private.code_hash('falsch-x'), 'ip-anders');
    assert r ->> 'code' = 'INVALID', 'anderer Absender gesperrt: ' || r::text;
    -- Erfolgreiche Anmeldungen zählen nicht mit: Nach zehn gültigen Aufrufen ist ein Tippfehler kein 429.
    for n in 1..10 loop
      r := public.hp_login_lookup(hp_private.code_hash(v_code), 'ip-viele');
      assert (r ->> 'ok')::boolean, 'gültiger Aufruf ' || n || ': ' || r::text;
    end loop;
    r := public.hp_login_lookup(hp_private.code_hash('falsch-y'), 'ip-viele');
    assert r ->> 'code' = 'INVALID', 'erfolgreiche Anmeldungen wurden mitgezählt: ' || r::text;
    -- Auch ohne Absenderangabe gilt die Grenze.
    for n in 1..10 loop
      r := public.hp_login_lookup(hp_private.code_hash('falsch-leer-' || n), null);
      assert r ->> 'code' = 'INVALID', 'ohne Absender, Versuch ' || n || ': ' || r::text;
    end loop;
    r := public.hp_login_lookup(hp_private.code_hash('falsch-leer-11'), '');
    assert r ->> 'code' = 'RATE_LIMITED', 'ohne Absender unbegrenzt: ' || r::text;
    -- Nach zehn Minuten zählt der Absender wieder von vorn.
    update public.hp_login_attempts set at = at - interval '11 minutes' where ip_hash = 'ip-r9';
    r := public.hp_login_lookup(hp_private.code_hash('falsch-12'), 'ip-r9');
    assert r ->> 'code' = 'INVALID', 'nach Ablauf weiter gesperrt: ' || r::text;
    raise exception using errcode = 'HPT00';
  exception
    when sqlstate 'HPT00' then res := res || jsonb_build_object('t', 'R9', 'ok', true);
    when assert_failure then res := res || jsonb_build_object('t', 'R9', 'ok', false, 'err', sqlerrm);
    when others then res := res || jsonb_build_object('t', 'R9', 'ok', false, 'err', sqlerrm);
  end;

  -- ------------------------------------------------------------ R10: Auth-Konten der Orga und Fremder werden nie gelöscht
  begin
    perform hp_private.drop_auth(u_admin);
    perform hp_private.drop_auth(u_x);
    assert exists (select 1 from auth.users where id = u_admin), 'Orga-Konto gelöscht';
    assert exists (select 1 from auth.users where id = u_x), 'fremdes Konto gelöscht';
    -- Ähnliche Adresse, aber nicht von der Login-Funktion angelegt: bleibt.
    perform hp_private.drop_auth(u_ci);
    assert exists (select 1 from auth.users where id = u_ci), 'Konto einer anderen Anwendung gelöscht';
    -- Auch ein deaktiviertes Orga-Konto bleibt.
    update public.hp_admins set active = false where user_id = u_admin;
    perform hp_private.drop_auth(u_admin);
    assert exists (select 1 from auth.users where id = u_admin), 'deaktiviertes Orga-Konto gelöscht';
    perform hp_private.drop_auth(u_b);
    assert not exists (select 1 from auth.users where id = u_b), 'Helfer-Konto nicht gelöscht';
    assert (select auth_user_id from public.hp_helpers where id = h_b) is null, 'Zuordnung nicht entfernt';
    raise exception using errcode = 'HPT00';
  exception
    when sqlstate 'HPT00' then res := res || jsonb_build_object('t', 'R10', 'ok', true);
    when assert_failure then res := res || jsonb_build_object('t', 'R10', 'ok', false, 'err', sqlerrm);
    when others then res := res || jsonb_build_object('t', 'R10', 'ok', false, 'err', sqlerrm);
  end;

  -- ------------------------------------------------------------ R11: jede Funktion mit festem, leerem search_path
  begin
    bad := '';
    for f in
      select p.oid::regprocedure::text as sig, p.prosecdef, p.proconfig
      from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
      where (ns.nspname = 'public' and p.proname like 'hp\_%') or ns.nspname = 'hp_private'
    loop
      if f.proconfig is null or not (f.proconfig @> array['search_path=""']) then
        bad := bad || ' ' || f.sig;
      end if;
    end loop;
    assert bad = '', 'search_path nicht leer:' || bad;
    raise exception using errcode = 'HPT00';
  exception
    when sqlstate 'HPT00' then res := res || jsonb_build_object('t', 'R11', 'ok', true);
    when assert_failure then res := res || jsonb_build_object('t', 'R11', 'ok', false, 'err', sqlerrm);
    when others then res := res || jsonb_build_object('t', 'R11', 'ok', false, 'err', sqlerrm);
  end;

  -- ------------------------------------------------------------ R12: Zeilenrechte auf jeder Tabelle, keine Tabellenrechte für Clients
  begin
    bad := '';
    select count(*) into n from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
    where ns.nspname = 'public' and c.relkind = 'r' and c.relname like 'hp\_%';
    assert n = array_length(tables, 1), 'Tabellenliste passt nicht zum Schema: ' || n;
    foreach t in array tables loop
      if not (select c.relrowsecurity from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
              where ns.nspname = 'public' and c.relname = t) then
        bad := bad || ' ohne RLS:' || t;
      end if;
      if (select count(*) from pg_policies p where p.schemaname = 'public' and p.tablename = t and p.qual <> 'false') > 0 then
        bad := bad || ' offene Policy:' || t;
      end if;
      foreach q in array array['select', 'insert', 'update', 'delete', 'truncate'] loop
        if has_table_privilege('anon', 'public.' || t, q) then bad := bad || ' anon ' || q || ':' || t; end if;
        if has_table_privilege('authenticated', 'public.' || t, q) then bad := bad || ' authenticated ' || q || ':' || t; end if;
      end loop;
    end loop;
    assert bad = '', 'Tabellenschutz:' || bad;
    raise exception using errcode = 'HPT00';
  exception
    when sqlstate 'HPT00' then res := res || jsonb_build_object('t', 'R12', 'ok', true);
    when assert_failure then res := res || jsonb_build_object('t', 'R12', 'ok', false, 'err', sqlerrm);
    when others then res := res || jsonb_build_object('t', 'R12', 'ok', false, 'err', sqlerrm);
  end;

  -- ------------------------------------------------------------ R13: „Testdaten entfernen“ trifft nur Testhelfer
  begin
    perform set_config('request.jwt.claims', jsonb_build_object('sub', u_admin, 'role', 'authenticated')::text, true);
    insert into public.hp_help_offers (
      display_name, email, arrive_thu, stay_mon, pre_milonga, dinner_sun
    ) values
      ('Test Probe R13', 'probe-r13@example.test', 'ja', 'nein', 'vielleicht', 'ja'),
      ('Test Echt R13', 'probe-r13@example.invalid', 'nein', 'nein', 'nein', 'nein');
    r := public.hp_admin_remove_test_data();
    assert (r ->> 'removed')::int = 3, 'entfernt: ' || r::text;
    assert not exists (select 1 from public.hp_help_offers where email = 'probe-r13@example.test'), 'Test-Antwort übrig';
    assert exists (select 1 from public.hp_help_offers where email = 'probe-r13@example.invalid'), 'echte Antwort mitgelöscht';
    assert (select count(*) from public.hp_helpers) = 1 and exists (select 1 from public.hp_helpers where id = h_real), 'falsche Helfer übrig';
    assert (select count(*) from public.hp_assignments) = 1 and exists (select 1 from public.hp_assignments where helper_id = h_real), 'Zuweisung des echten Helfers fehlt';
    assert (select count(*) from public.hp_swaps) = 0 and (select count(*) from public.hp_notifications) = 0, 'Tausch oder Benachrichtigung übrig';
    assert not exists (select 1 from auth.users where id in (u_a, u_b)), 'Auth-Konten der Testhelfer übrig';
    assert exists (select 1 from auth.users where id = u_admin), 'Orga-Konto gelöscht';
    raise exception using errcode = 'HPT00';
  exception
    when sqlstate 'HPT00' then res := res || jsonb_build_object('t', 'R13', 'ok', true);
    when assert_failure then res := res || jsonb_build_object('t', 'R13', 'ok', false, 'err', sqlerrm);
    when others then res := res || jsonb_build_object('t', 'R13', 'ok', false, 'err', sqlerrm);
  end;

  -- ------------------------------------------------------------ R14: Löschung nach dem Event
  begin
    perform set_config('request.jwt.claims', jsonb_build_object('sub', u_admin, 'role', 'authenticated')::text, true);
    select count(*) into n from public.hp_shifts;
    insert into public.hp_help_offers (
      display_name, email, arrive_thu, stay_mon, pre_milonga, dinner_sun
    ) values (
      'Test Probe R14', 'probe-r14@example.test', 'ja', 'ja', 'ja', 'ja'
    );
    insert into public.hp_offer_rate (bucket, ip_hash, n)
    values (date_trunc('hour', now()), repeat('e', 32), 1);
    r := public.hp_admin_purge('ja');
    assert r ->> 'code' = 'CONFIRM_REQUIRED', 'ohne Bestätigung: ' || r::text;
    assert (select count(*) from public.hp_helpers) = 4, 'ohne Bestätigung gelöscht';
    assert (select count(*) from public.hp_help_offers) = 1, 'Antwort ohne Bestätigung gelöscht';
    r := public.hp_admin_purge('LOESCHEN');
    assert (r ->> 'ok')::boolean and (r ->> 'helpers')::int = 4 and (r ->> 'offers')::int = 1, 'Löschung: ' || r::text;
    assert (r ->> 'auth_left')::int = 0, 'Anmeldekonten übrig: ' || r::text;
    assert exists (select 1 from auth.users where id = u_ci), 'Konto einer anderen Anwendung gelöscht';
    assert (select count(*) from public.hp_helpers) = 0 and (select count(*) from public.hp_assignments) = 0
       and (select count(*) from public.hp_swaps) = 0 and (select count(*) from public.hp_notifications) = 0
       and (select count(*) from public.hp_login_attempts) = 0
       and (select count(*) from public.hp_help_offers) = 0
       and (select count(*) from public.hp_offer_rate) = 0, 'Reste nach Löschung';
    assert (select count(*) from public.hp_audit) = 1, 'Protokoll nicht geleert';
    assert (select count(*) from public.hp_shifts) = n, 'Schichtraster verändert';
    assert (select count(*) from public.hp_admins) = 1 and (select count(*) from public.hp_settings) >= 7, 'Orga oder Einstellungen gelöscht';
    assert not exists (select 1 from auth.users where id in (u_a, u_b)), 'Auth-Konten der Helfer übrig';
    assert exists (select 1 from auth.users where id = u_admin), 'Orga-Konto gelöscht';
    raise exception using errcode = 'HPT00';
  exception
    when sqlstate 'HPT00' then res := res || jsonb_build_object('t', 'R14', 'ok', true);
    when assert_failure then res := res || jsonb_build_object('t', 'R14', 'ok', false, 'err', sqlerrm);
    when others then res := res || jsonb_build_object('t', 'R14', 'ok', false, 'err', sqlerrm);
  end;

  -- ------------------------------------------------------------ R15: Deaktivieren nur mit Bestätigung, dann ohne Reste
  begin
    perform set_config('request.jwt.claims', jsonb_build_object('sub', u_admin, 'role', 'authenticated')::text, true);
    perform public.hp_admin_new_login_code(h_b);
    r := public.hp_admin_deactivate_helper(h_b, false);
    assert r ->> 'code' = 'CONFIRM_REQUIRED' and (r ->> 'assignments')::int = 1, 'ohne Bestätigung: ' || r::text;
    assert exists (select 1 from public.hp_assignments where helper_id = h_b), 'ohne Bestätigung entfernt';
    r := public.hp_admin_deactivate_helper(h_b, true);
    assert (r ->> 'ok')::boolean, 'Deaktivieren: ' || r::text;
    assert not exists (select 1 from public.hp_assignments where helper_id = h_b), 'Zuweisung übrig';
    assert (select not active and login_code_hash is null and auth_user_id is null from public.hp_helpers where id = h_b), 'Zugang nicht entzogen';
    assert (select status from public.hp_swaps where id = v_swap) = 'expired', 'offener Tausch nicht verfallen';
    r := public.hp_admin_assign('zr2', h_b, false);
    assert r ->> 'code' = 'HELPER_INACTIVE', 'Zuweisung an Deaktivierten: ' || r::text;
    r := public.hp_admin_reactivate_helper(h_b);
    assert (r ->> 'ok')::boolean and (select active from public.hp_helpers where id = h_b), 'Reaktivieren: ' || r::text;
    raise exception using errcode = 'HPT00';
  exception
    when sqlstate 'HPT00' then res := res || jsonb_build_object('t', 'R15', 'ok', true);
    when assert_failure then res := res || jsonb_build_object('t', 'R15', 'ok', false, 'err', sqlerrm);
    when others then res := res || jsonb_build_object('t', 'R15', 'ok', false, 'err', sqlerrm);
  end;

  -- ------------------------------------------------------------ R16: Regeln beim Zuweisen
  begin
    perform set_config('request.jwt.claims', jsonb_build_object('sub', u_admin, 'role', 'authenticated')::text, true);
    r := public.hp_admin_assign('zr1', h_b, false);
    assert r ->> 'code' = 'SHIFT_FULL', 'volle Schicht: ' || r::text;
    r := public.hp_admin_assign('zr1', h_a, false);
    assert r ->> 'code' = 'ASSIGN_DUPLICATE', 'doppelt: ' || r::text;
    r := public.hp_admin_assign('zr3', h_a, false);
    assert r ->> 'code' = 'ASSIGN_OVERLAP' and r ->> 'conflict_shift' = 'zr1', 'Überschneidung: ' || r::text;
    assert not exists (select 1 from public.hp_assignments where shift_id = 'zr3'), 'trotz Überschneidung zugewiesen';
    r := public.hp_admin_assign('zr3', h_a, true);
    assert (r ->> 'ok')::boolean, 'mit Übersteuern: ' || r::text;
    r := public.hp_admin_assign('gibtsnicht', h_a, false);
    assert r ->> 'code' = 'NOT_FOUND', 'unbekannte Schicht: ' || r::text;
    r := public.hp_admin_unassign('zr3', h_b);
    assert r ->> 'code' = 'NOT_FOUND', 'Entfernen ohne Zuweisung: ' || r::text;
    -- Zuweisung der Orga lässt den offenen Tausch verfallen, wenn A dadurch schon in der Zielschicht wäre.
    perform public.hp_admin_unassign('zr2', h_b);
    assert (select status from public.hp_swaps where id = v_swap) = 'expired', 'Tausch nicht verfallen';
    raise exception using errcode = 'HPT00';
  exception
    when sqlstate 'HPT00' then res := res || jsonb_build_object('t', 'R16', 'ok', true);
    when assert_failure then res := res || jsonb_build_object('t', 'R16', 'ok', false, 'err', sqlerrm);
    when others then res := res || jsonb_build_object('t', 'R16', 'ok', false, 'err', sqlerrm);
  end;

  -- ------------------------------------------------------------ R17: Eingaben: nur Anzeigename und Kontaktweg, keine Nummern oder Adressen
  begin
    perform set_config('request.jwt.claims', jsonb_build_object('sub', u_admin, 'role', 'authenticated')::text, true);
    foreach t in array array['', '   ', 'name@example.invalid', 'Test 01701234567', 'Test +49 170 123 45 67', 'Test 0170/12 34 5', repeat('x', 41), 'Test <b>'] loop
      r := public.hp_admin_upsert_helper(null, t, '#112233', '', false, null, true);
      assert r ->> 'code' = 'INVALID_INPUT', 'Name angenommen: [' || t || '] ' || r::text;
    end loop;
    r := public.hp_admin_upsert_helper(null, 'Test Neu R', '#112233', '0170 1234567', false, null, true);
    assert r ->> 'code' = 'INVALID_INPUT', 'Nummer als Kontaktweg angenommen: ' || r::text;
    r := public.hp_admin_upsert_helper(null, 'Test Neu R', 'rot', '', false, null, true);
    assert r ->> 'code' = 'INVALID_INPUT', 'ungültige Farbe angenommen: ' || r::text;
    r := public.hp_admin_upsert_helper(null, 'test anna r', '#112233', '', false, null, true);
    assert r ->> 'code' = 'NAME_TAKEN', 'doppelter Name angenommen: ' || r::text;
    r := public.hp_admin_upsert_helper(null, 'Test Neu R', '#112233', 'WhatsApp', true, 4, true);
    assert (r ->> 'ok')::boolean, 'gültiger Helfer abgelehnt: ' || r::text;
    r := public.hp_admin_upsert_helper(null, 'Test Zwei 2', '#112233', '', false, null, true);
    assert (r ->> 'ok')::boolean, 'Name mit einer Ziffer abgelehnt: ' || r::text;
    r := public.hp_admin_add_helpers(array['Test Eins R', 'Test Zwei R', 'Test Anna R', 'x@y.invalid', '  '], true);
    assert (r ->> 'created')::int = 2 and jsonb_array_length(r -> 'skipped') = 2, 'Mehrfach-Anlage: ' || r::text;
    r := public.hp_admin_set_setting('data_version', '99'::jsonb);
    assert r ->> 'code' = 'INVALID_INPUT', 'fremder Schlüssel angenommen: ' || r::text;
    r := public.hp_admin_set_setting('target_shifts', '"viele"'::jsonb);
    assert r ->> 'code' = 'INVALID_INPUT', 'Text als Zahl angenommen: ' || r::text;
    r := public.hp_admin_set_setting('swaps_lock_at', '"kein Datum"'::jsonb);
    assert r ->> 'code' = 'INVALID_INPUT', 'ungültiger Zeitpunkt angenommen: ' || r::text;
    r := public.hp_admin_set_setting('target_shifts', '5'::jsonb);
    assert (r ->> 'ok')::boolean, 'gültige Einstellung abgelehnt: ' || r::text;
    -- Notiz beim Tausch wird auf 200 Zeichen begrenzt.
    perform set_config('request.jwt.claims', jsonb_build_object('sub', u_b, 'role', 'authenticated')::text, true);
    r := public.hp_swap_request('zr2', 'zr4', repeat('n', 500));
    assert (r ->> 'ok')::boolean, 'Anfrage mit langer Notiz: ' || r::text;
    assert (select char_length(note) from public.hp_swaps where id = (r ->> 'id')::bigint) = 200, 'Notiz nicht gekürzt';
    raise exception using errcode = 'HPT00';
  exception
    when sqlstate 'HPT00' then res := res || jsonb_build_object('t', 'R17', 'ok', true);
    when assert_failure then res := res || jsonb_build_object('t', 'R17', 'ok', false, 'err', sqlerrm);
    when others then res := res || jsonb_build_object('t', 'R17', 'ok', false, 'err', sqlerrm);
  end;

  -- ------------------------------------------------------------ R18: gemeinsames Projekt – pauschale Freigabe einer anderen Anwendung öffnet nichts
  begin
    bad := '';
    -- So sähe es aus, wenn eine andere Anwendung im selben Projekt alle Funktionen in public freigibt.
    grant execute on all functions in schema public to anon, authenticated;
    -- Interne Funktionen bleiben unerreichbar, für anon und für einen angemeldeten Helfer.
    perform set_config('request.jwt.claims', jsonb_build_object('sub', u_a, 'role', 'authenticated')::text, true);
    foreach t in array array['anon', 'authenticated'] loop
      perform set_config('role', t, true);
      foreach q in array array[
        'select hp_private.touch()',
        'select hp_private.is_admin()',
        'select hp_private.sweep()',
        format('select hp_private.drop_auth(%L)', u_b),
        'select hp_private.drop_orphans(interval ''0'')',
        'select hp_private.audit(''x'', null, null, ''ok'')',
        'select hp_private.code_hash(''x'')'
      ] loop
        begin
          execute q;
          bad := bad || ' [' || t || ': ' || q || ']';
        exception when insufficient_privilege then null;
        end;
      end loop;
      -- Login-Funktionen: trotz Ausführungsrecht nur für die Edge Function.
      foreach q in array array[
        'select public.hp_login_lookup(''x'', ''y'')',
        format('select public.hp_login_bind(%L, ''x'', %L)', h_a, u_x)
      ] loop
        begin
          execute q;
          bad := bad || ' [' || t || ': ' || q || ']';
        exception when insufficient_privilege then
          if sqlerrm <> 'NOT_ALLOWED' then bad := bad || ' [falscher Fehler: ' || sqlerrm || ']'; end if;
        end;
      end loop;
    end loop;
    -- anon mit Ausführungsrecht: jede Client-Funktion lehnt ab oder gibt nichts preis.
    perform set_config('request.jwt.claims', jsonb_build_object('role', 'anon')::text, true);
    perform set_config('role', 'anon', true);
    r := public.hp_my_context();
    foreach q in array array[
      'select public.hp_state()',
      'select public.hp_mark_read(null)',
      'select public.hp_swap_request(''zr1'', ''zr2'', '''')',
      format('select public.hp_swap_accept(%s)', v_swap),
      format('select public.hp_admin_assign(''zr3'', %L, true)', h_a),
      'select public.hp_admin_purge(''LOESCHEN'')',
      format('select public.hp_admin_new_login_code(%L)', h_a),
      'select public.hp_admin_revoke_login(null)',
      'select public.hp_admin_list_help_offers()',
      'select public.hp_submit_help_offer(''x'', ''a@b.co'', '''', ''ja'', ''ja'', ''ja'', ''ja'', '''', '''', repeat(''ab'', 16))'
    ] loop
      begin
        execute q;
        bad := bad || ' [anon: ' || q || ']';
      exception when insufficient_privilege then null;
      end;
    end loop;
    perform set_config('role', v_owner, true);
    assert r ->> 'role' = 'none' and r ->> 'helper_id' is null, 'Kontext für anon: ' || r::text;
    assert bad = '', 'trotz Freigabe erreichbar sollte nichts sein:' || bad;
    assert (select count(*) from public.hp_helpers) = 4 and (select count(*) from public.hp_assignments) = 3, 'Daten verändert';
    assert (select auth_user_id from public.hp_helpers where id = h_a) = u_a, 'Zuordnung verändert';
    -- Eine Sitzung, die sich direkt als Client-Rolle verbindet (ohne Rollenwechsel), kommt
    -- auch nicht durch. Nachstellbar nur mit Superuser-Rechten, also lokal.
    if (select rolsuper from pg_roles where rolname = v_owner) then
      perform set_config('role', 'none', true);
      execute 'set local session authorization authenticated';
      begin
        perform public.hp_login_lookup('x', 'y');
        bad := bad || ' [Sitzung als authenticated ohne Rollenwechsel]';
      exception when insufficient_privilege then
        if sqlerrm <> 'NOT_ALLOWED' then bad := bad || ' [falscher Fehler: ' || sqlerrm || ']'; end if;
      end;
      execute 'reset session authorization';
      perform set_config('role', v_owner, true);
      assert bad = '', 'Sitzung ohne Rollenwechsel:' || bad;
    end if;
    -- Die Edge Function (service_role) kommt weiter durch.
    perform set_config('role', 'service_role', true);
    r := public.hp_login_lookup('x', 'ip-r18');
    perform set_config('role', v_owner, true);
    assert r ->> 'code' = 'INVALID', 'service_role abgewiesen: ' || r::text;
    raise exception using errcode = 'HPT00';
  exception
    when sqlstate 'HPT00' then res := res || jsonb_build_object('t', 'R18', 'ok', true);
    when assert_failure then res := res || jsonb_build_object('t', 'R18', 'ok', false, 'err', sqlerrm);
    when others then res := res || jsonb_build_object('t', 'R18', 'ok', false, 'err', sqlerrm);
  end;

  -- ------------------------------------------------------------ R19: Einstellungen – JSON-null kommt als SQL-NULL an
  begin
    perform set_config('request.jwt.claims', jsonb_build_object('sub', u_admin, 'role', 'authenticated')::text, true);
    update public.hp_settings set value = '"2026-10-29T20:00:00+01:00"'::jsonb where key = 'swaps_lock_at';
    -- So reicht die Daten-API {"p_value": null} durch.
    r := public.hp_admin_set_setting('swaps_lock_at', null);
    assert (r ->> 'ok')::boolean, 'Sperrzeit leeren: ' || r::text;
    assert (select value from public.hp_settings where key = 'swaps_lock_at') = 'null'::jsonb, 'Sperrzeit nicht geleert';
    r := public.hp_state();
    assert (r #>> '{settings,locked}')::boolean = false, 'nach dem Leeren noch gesperrt';
    r := public.hp_admin_set_setting('swaps_lock_at', 'null'::jsonb);
    assert (r ->> 'ok')::boolean, 'JSON-null direkt: ' || r::text;
    foreach t in array array['target_shifts', 'target_hours', 'swaps_locked', 'event_end', 'purge_after'] loop
      r := public.hp_admin_set_setting(t, null);
      assert r ->> 'code' = 'INVALID_INPUT', 'leerer Wert angenommen für ' || t || ': ' || r::text;
      assert (select value from public.hp_settings where key = t) is not null
         and (select jsonb_typeof(value) from public.hp_settings where key = t) <> 'null', 'Einstellung geleert: ' || t;
    end loop;
    r := public.hp_admin_set_setting(null, null);
    assert r ->> 'code' = 'INVALID_INPUT', 'leerer Schlüssel: ' || r::text;
    -- Nur feste Formate: kein „infinity“, kein „today“, kein Zeitpunkt als Datum.
    foreach t in array array['infinity', 'today', '2026-11-15T00:00:00+01:00', '15.11.2026', '2026-13-40', ''] loop
      r := public.hp_admin_set_setting('purge_after', to_jsonb(t));
      assert r ->> 'code' = 'INVALID_INPUT', 'Löschtermin angenommen: [' || t || '] ' || r::text;
    end loop;
    assert (select value from public.hp_settings where key = 'purge_after') = '"2026-11-15"'::jsonb, 'Löschtermin verändert';
    foreach t in array array['infinity', 'now', 'today', '2026-10-29', '2026-10-29 20:00', '2026-10-29T20:00:00', '2026-10-29T25:00:00+01:00'] loop
      r := public.hp_admin_set_setting('swaps_lock_at', to_jsonb(t));
      assert r ->> 'code' = 'INVALID_INPUT', 'Sperrzeit angenommen: [' || t || '] ' || r::text;
      r := public.hp_admin_set_setting('event_end', to_jsonb(t));
      assert r ->> 'code' = 'INVALID_INPUT', 'Eventende angenommen: [' || t || '] ' || r::text;
    end loop;
    foreach t in array array['2026-10-29T20:00:00+01:00', '2026-10-29T19:00:00.000Z', '2026-10-29T20:00+01:00'] loop
      r := public.hp_admin_set_setting('swaps_lock_at', to_jsonb(t));
      assert (r ->> 'ok')::boolean, 'gültige Sperrzeit abgelehnt: [' || t || '] ' || r::text;
    end loop;
    r := public.hp_admin_set_setting('purge_after', '"2026-11-20"'::jsonb);
    assert (r ->> 'ok')::boolean, 'gültiger Löschtermin abgelehnt: ' || r::text;
    -- Sperrzeit in der Vergangenheit sperrt sofort, in der Zukunft nicht.
    r := public.hp_admin_set_setting('swaps_lock_at', to_jsonb(to_char((now() - interval '1 minute') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')));
    assert (r ->> 'ok')::boolean, 'vergangene Sperrzeit abgelehnt: ' || r::text;
    assert (public.hp_state() #>> '{settings,locked}')::boolean, 'vergangene Sperrzeit sperrt nicht';
    r := public.hp_admin_set_setting('swaps_lock_at', to_jsonb(to_char((now() + interval '1 day') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')));
    assert (r ->> 'ok')::boolean, 'künftige Sperrzeit abgelehnt: ' || r::text;
    assert not (public.hp_state() #>> '{settings,locked}')::boolean, 'künftige Sperrzeit sperrt schon';
    raise exception using errcode = 'HPT00';
  exception
    when sqlstate 'HPT00' then res := res || jsonb_build_object('t', 'R19', 'ok', true);
    when assert_failure then res := res || jsonb_build_object('t', 'R19', 'ok', false, 'err', sqlerrm);
    when others then res := res || jsonb_build_object('t', 'R19', 'ok', false, 'err', sqlerrm);
  end;

  -- ------------------------------------------------------------ R20: verwaiste Helfer-Konten werden aufgeräumt, andere nie
  begin
    perform set_config('request.jwt.claims', jsonb_build_object('sub', u_admin, 'role', 'authenticated')::text, true);
    -- u_new ist ein Helfer-Konto ohne Helfer (Anmeldung abgebrochen), frisch angelegt.
    assert exists (select 1 from auth.users where id = u_new), 'Vorbedingung';
    -- Konten, an denen ein Helfer hängt, sind keine Waisen. Orga-Konten (auch
    -- deaktivierte) und Konten anderer Anwendungen bleiben immer.
    update public.hp_admins set active = false where user_id = u_admin;
    n := hp_private.drop_orphans(interval '0');
    update public.hp_admins set active = true where user_id = u_admin;
    assert n = 1 and not exists (select 1 from auth.users where id = u_new), 'Waise nicht entfernt: ' || n;
    assert (select count(*) from auth.users where id in (u_a, u_b)) = 2, 'gebundenes Helfer-Konto als Waise gelöscht';
    assert (select auth_user_id from public.hp_helpers where id = h_a) = u_a, 'Zuordnung verloren';
    assert exists (select 1 from auth.users where id = u_admin), 'deaktiviertes Orga-Konto als Waise gelöscht';
    assert exists (select 1 from auth.users where id = u_ci), 'Konto einer anderen Anwendung als Waise gelöscht';
    assert exists (select 1 from auth.users where id = u_x), 'fremdes Konto als Waise gelöscht';
    -- Ein Helfer-Konto ohne Anlagedatum gilt als alt und wird auch mit Schonfrist aufgeräumt.
    insert into auth.users (id, email, raw_app_meta_data, created_at) values (u_new, 'hp-' || u_new || '@helfer.bendito.invalid', '{"hp": "helper"}', null);
    n := hp_private.drop_orphans(interval '10 minutes');
    assert n = 1 and not exists (select 1 from auth.users where id = u_new), 'Waise ohne Anlagedatum bleibt liegen: ' || n;
    -- Einzelnes Sperren räumt keine Waisen ab (dort könnte gerade jemand anderes anmelden).
    insert into auth.users (id, email, raw_app_meta_data, created_at) values (u_new, 'hp-' || u_new || '@helfer.bendito.invalid', '{"hp": "helper"}', now());
    perform public.hp_admin_revoke_login(h_b);
    assert exists (select 1 from auth.users where id = u_new), 'einzelnes Sperren hat eine Waise gelöscht';
    assert not exists (select 1 from auth.users where id = u_b), 'Konto des gesperrten Helfers übrig';
    -- „Alle sperren“ schont frische Konten einer laufenden Anmeldung und räumt ältere ab.
    perform public.hp_admin_revoke_login(null);
    assert exists (select 1 from auth.users where id = u_new), 'frisches Konto einer laufenden Anmeldung gelöscht';
    assert not exists (select 1 from auth.users where id = u_a), 'gebundenes Helfer-Konto übrig';
    update auth.users set created_at = now() - interval '11 minutes' where id = u_new;
    perform public.hp_admin_revoke_login(null);
    assert not exists (select 1 from auth.users where id = u_new), 'verwaistes Konto übrig';
    assert exists (select 1 from auth.users where id = u_admin), 'Orga-Konto gelöscht';
    assert exists (select 1 from auth.users where id = u_x) and exists (select 1 from auth.users where id = u_ci), 'fremdes Konto gelöscht';
    -- Die Löschung nach dem Event räumt auch frische Waisen ab und meldet, was übrig bleibt.
    insert into auth.users (id, email, raw_app_meta_data, created_at) values
      (u_new, 'hp-' || u_new || '@helfer.bendito.invalid', '{"hp": "helper"}', now()),
      (u_a, 'hp-' || u_a || '@helfer.bendito.invalid', '{"hp": "helper"}', now());
    -- u_a lässt sich nicht löschen, weil eine fremde Tabelle darauf verweist.
    create table public.zz_hp_test_fremd (uid uuid references auth.users (id));
    insert into public.zz_hp_test_fremd values (u_a);
    r := public.hp_admin_purge('LOESCHEN');
    assert (r ->> 'ok')::boolean, 'Löschung: ' || r::text;
    assert not exists (select 1 from auth.users where id = u_new), 'löschbares Konto blieb liegen, weil ein anderes scheiterte';
    assert exists (select 1 from auth.users where id = u_a), 'Vorbedingung: Konto sollte nicht löschbar sein';
    assert (r ->> 'auth_left')::int = 1, 'übrig gebliebenes Konto nicht gemeldet: ' || r::text;
    assert exists (select 1 from public.hp_audit where action = 'auth_cleanup' and outcome = 'FAILED'), 'Fehlschlag nicht protokolliert';
    assert exists (select 1 from auth.users where id = u_admin) and exists (select 1 from auth.users where id = u_x)
       and exists (select 1 from auth.users where id = u_ci), 'Orga- oder fremdes Konto gelöscht';
    raise exception using errcode = 'HPT00';
  exception
    when sqlstate 'HPT00' then res := res || jsonb_build_object('t', 'R20', 'ok', true);
    when assert_failure then res := res || jsonb_build_object('t', 'R20', 'ok', false, 'err', sqlerrm);
    when others then res := res || jsonb_build_object('t', 'R20', 'ok', false, 'err', sqlerrm);
  end;

  -- ------------------------------------------------------------ R21: Mithilfe-Abfrage speichert nur Geprüftes, lesen darf nur die Orga
  begin
    bad := '';
    perform set_config('role', 'anon', true);
    begin
      perform public.hp_submit_help_offer('Test Probe', 'probe-r21@example.test', '', 'ja', 'nein', 'vielleicht', 'ja', '', '', repeat('a', 32));
      bad := bad || ' anon-schreiben';
    exception when insufficient_privilege then null;
    end;
    begin
      perform public.hp_admin_list_help_offers();
      bad := bad || ' anon-lesen';
    exception when insufficient_privilege then null;
    end;
    perform set_config('role', v_owner, true);
    r := public.hp_submit_help_offer('Test Probe', 'keine mail', '', 'ja', 'ja', 'ja', 'ja', '', '', repeat('b', 32));
    assert r ->> 'code' = 'INVALID_INPUT', 'ungültige Mail angenommen: ' || r::text;
    r := public.hp_submit_help_offer('Test Probe', 'probe-r21@example.test', 'abc', 'ja', 'ja', 'ja', 'ja', '', '', repeat('b', 32));
    assert r ->> 'code' = 'INVALID_INPUT', 'Telefon angenommen: ' || r::text;
    r := public.hp_submit_help_offer('Test Probe', 'probe-r21@example.test', '', 'morgen', 'ja', 'ja', 'ja', '', '', repeat('b', 32));
    assert r ->> 'code' = 'INVALID_INPUT', 'Antwort angenommen: ' || r::text;
    r := public.hp_submit_help_offer('Bot', 'bot-r21@example.test', '', 'ja', 'ja', 'ja', 'ja', '', 'acme', repeat('b', 32));
    assert (r ->> 'ok')::boolean, 'Köder abgelehnt: ' || r::text;
    assert not exists (select 1 from public.hp_help_offers where email = 'bot-r21@example.test'), 'Köder gespeichert';
    r := public.hp_submit_help_offer('Test Probe', 'probe-r21@example.test', '', 'ja', 'nein', 'vielleicht', 'ja', 'komme nachmittags', '', repeat('b', 32));
    assert (r ->> 'ok')::boolean, 'gültige Antwort abgelehnt: ' || r::text;
    r := public.hp_submit_help_offer('Test Probe Zwei', 'Probe-R21@example.test', '015112345678', 'nein', 'ja', 'nein', 'vielleicht', '', '', repeat('b', 32));
    assert (r ->> 'ok')::boolean, 'Korrektur abgelehnt: ' || r::text;
    assert (select count(*) from public.hp_help_offers) = 1, 'dieselbe Adresse legt eine zweite Zeile an';
    assert (select display_name from public.hp_help_offers) = 'Test Probe Zwei', 'Name nicht ersetzt';
    assert (select stay_mon from public.hp_help_offers) = 'ja', 'Montag nicht ersetzt';
    insert into public.hp_offer_rate (bucket, ip_hash, n) values (date_trunc('hour', now()), repeat('c', 32), 8)
      on conflict (bucket, ip_hash) do update set n = 8;
    r := public.hp_submit_help_offer('Test Rate', 'rate-r21@example.test', '', 'ja', 'ja', 'ja', 'ja', '', '', repeat('c', 32));
    assert r ->> 'code' = 'RATE', 'Obergrenze nicht gegriffen: ' || r::text;
    assert not exists (select 1 from public.hp_help_offers where email = 'rate-r21@example.test'), 'Antwort trotz Obergrenze';
    perform set_config('request.jwt.claims', jsonb_build_object('sub', u_a, 'role', 'authenticated')::text, true);
    perform set_config('role', 'authenticated', true);
    begin
      perform public.hp_admin_list_help_offers();
      bad := bad || ' helfer-liste';
    exception when insufficient_privilege then null;
    end;
    perform set_config('role', v_owner, true);
    perform set_config('request.jwt.claims', jsonb_build_object('sub', u_admin, 'role', 'authenticated')::text, true);
    perform set_config('role', 'authenticated', true);
    r := public.hp_admin_list_help_offers();
    assert jsonb_array_length(r) = 1 and r -> 0 ->> 'email' = 'probe-r21@example.test', 'Orga sieht die Antwort nicht: ' || r::text;
    perform set_config('role', v_owner, true);
    assert bad = '', 'Abfrage offen:' || bad;
    raise exception using errcode = 'HPT00';
  exception
    when sqlstate 'HPT00' then res := res || jsonb_build_object('t', 'R21', 'ok', true);
    when assert_failure then res := res || jsonb_build_object('t', 'R21', 'ok', false, 'err', sqlerrm);
    when others then res := res || jsonb_build_object('t', 'R21', 'ok', false, 'err', sqlerrm);
  end;

  raise exception 'HP_TEST_RESULTS %', res::text;
end $$;
