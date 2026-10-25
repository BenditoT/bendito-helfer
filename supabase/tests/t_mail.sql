-- Synthetische Mailtests, immer ROLLBACK, auch auf der Live-DB keine Mails.
-- Purge nur in leerer Wegwerf-DB; auf Live nur kaskadierendes Testhelfer-Löschen.
\set ON_ERROR_STOP on
begin;
do $$
declare
  owner_role text := current_user;
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); admin_id uuid := gen_random_uuid();
  ha uuid; hb uuid; hc uuid; sid bigint; r jsonb; r2 jsonb; ids bigint[];
  secret text := repeat('mail-test-only-',4); n bigint; real_before int;
  t text; role_name text; denied boolean; hash text; k int;
begin
  if exists(select 1 from hp_private.helper_mail) or exists(select 1 from hp_private.mail_outbox) then
    raise exception 'Mailtests nur vor dem Adressimport oder in einer Wegwerf-DB ausführen.';
  end if;
  select count(*) into real_before from public.hp_helpers;
  insert into auth.users(id,email,raw_app_meta_data,created_at) values
    (ua,'hp-'||ua||'@helfer.bendito.invalid','{"hp":"helper"}',now()),
    (ub,'hp-'||ub||'@helfer.bendito.invalid','{"hp":"helper"}',now()),
    (admin_id,'hp-test-admin-'||admin_id||'@helfer.bendito.invalid','{}',now());
  insert into public.hp_admins(user_id) values(admin_id);
  insert into public.hp_helpers(display_name,auth_user_id,is_test) values('Test Mail Anna',ua,true) returning id into ha;
  insert into public.hp_helpers(display_name,auth_user_id,is_test) values('Test Mail Ben',ub,true) returning id into hb;
  insert into public.hp_helpers(display_name,is_test) values('Test Mail Ohne',true) returning id into hc;
  insert into public.hp_shifts(id,day,type_key,start_time,duration_min,capacity,sort) values
    ('zmail1','fri','bar','17:00',60,1,99001),('zmail2','sat','bar','19:00',60,1,99002),
    ('zmail3','sun','bar','12:00',60,3,99003);
  insert into public.hp_assignments(shift_id,helper_id) values('zmail1',ha),('zmail2',hb);
  update public.hp_settings set value='false' where key='swaps_locked';
  update public.hp_settings set value='null' where key='swaps_lock_at';
  perform set_config('request.jwt.claims',jsonb_build_object('sub',admin_id,'role','authenticated')::text,true);
  perform set_config('role','authenticated',true);
  r:=public.hp_admin_set_helper_mail(ha,'mail-anna@example.invalid'); assert (r->>'ok')::boolean;
  r:=public.hp_admin_set_helper_mail(hb,'mail-ben@example.invalid'); assert (r->>'ok')::boolean;
  r:=public.hp_admin_set_helper_mail(hc,E'bad\nmail@example.invalid'); assert not (r->>'ok')::boolean;
  r:=public.hp_admin_set_mail_secret_hash(encode(sha256(convert_to(secret,'UTF8')),'hex')); assert (r->>'ok')::boolean;
  r:=public.hp_admin_helper_mail_list(); assert r::text !~ '@';
  r:=public.hp_state(); assert r::text !~ 'mail_secret_hash|mail-anna|mail-ben';
  perform set_config('role',owner_role,true);
  raise notice 'M1 admin mail management and private state: ok';

  foreach role_name in array array['anon','authenticated'] loop
    perform set_config('role',role_name,true);
    foreach t in array array['helper_mail','mail_outbox'] loop
      denied:=false;
      begin execute format('select 1 from hp_private.%I limit 1',t);
      exception when insufficient_privilege then denied:=true; end;
      assert denied,'private table accessible';
    end loop;
    perform set_config('role',owner_role,true);
  end loop;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',ua,'role','authenticated')::text,true);
  perform set_config('role','authenticated',true);
  denied:=false;
  begin perform public.hp_admin_helper_mail_list(); exception when insufficient_privilege then denied:=true; end;
  assert denied;
  denied:=false;
  begin perform public.hp_admin_set_helper_mail(hb,'other@example.invalid'); exception when insufficient_privilege then denied:=true; end;
  assert denied;
  r:=public.hp_state(); assert r::text !~ 'mail_secret_hash|mail-anna|mail-ben';
  perform set_config('role',owner_role,true);
  select count(*) into n from public.hp_login_attempts where ip_hash like 'mail:%';
  perform set_config('role','anon',true);
  assert public.hp_mail_claim('wrong')='[]'::jsonb;
  assert public.hp_mail_done('wrong',array[1::bigint],true)='[]'::jsonb;
  perform set_config('role',owner_role,true);
  assert (select count(*) from public.hp_login_attempts where ip_hash like 'mail:%')=n+2;
  raise notice 'M2 table/function rights, wrong secret and rate counter: ok';

  perform set_config('role','authenticated',true);
  r:=public.hp_swap_request('zmail1','zmail2','Notiz gehört nicht in die Mail');
  assert (r->>'ok')::boolean; sid:=(r->>'id')::bigint;
  perform set_config('role',owner_role,true);
  assert (select count(*) from hp_private.mail_outbox where helper_id=hb and kind='swap_request')=1;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',ub,'role','authenticated')::text,true);
  perform set_config('role','authenticated',true);
  r:=public.hp_swap_accept(sid); assert (r->>'ok')::boolean;
  perform set_config('role',owner_role,true);
  assert (select count(*) from hp_private.mail_outbox where helper_id=ha and kind='swap_accepted')=1;
  assert not exists(select 1 from hp_private.mail_outbox where helper_id in(ha,hb) and kind in('assigned','unassigned'));
  raise notice 'M3 request and accept, no duplicate assignment: ok';

  -- Zweiten Tausch ablehnen.
  perform set_config('role','authenticated',true);
  r:=public.hp_swap_request('zmail1','zmail2',''); assert (r->>'ok')::boolean; sid:=(r->>'id')::bigint;
  perform set_config('role',owner_role,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',ua,'role','authenticated')::text,true);
  perform set_config('role','authenticated',true);
  r:=public.hp_swap_reject(sid); assert (r->>'ok')::boolean;
  perform set_config('role',owner_role,true);
  assert exists(select 1 from hp_private.mail_outbox where helper_id=hb and kind='swap_rejected');
  perform set_config('request.jwt.claims',jsonb_build_object('sub',admin_id,'role','authenticated')::text,true);
  perform set_config('role','authenticated',true);
  r:=public.hp_admin_assign('zmail3',ha,false); assert (r->>'ok')::boolean;
  r:=public.hp_admin_unassign('zmail3',ha); assert (r->>'ok')::boolean;
  r:=public.hp_admin_assign('zmail3',hc,false); assert (r->>'ok')::boolean;
  perform set_config('role',owner_role,true);
  assert exists(select 1 from hp_private.mail_outbox where helper_id=ha and kind='assigned');
  assert exists(select 1 from hp_private.mail_outbox where helper_id=ha and kind='unassigned');
  assert not exists(select 1 from hp_private.mail_outbox where helper_id=hc);
  raise notice 'M4 reject, admin assign/unassign, no address: ok';

  -- Alle Testereignisse auf denselben gereiften Bündelzeitpunkt setzen.
  update hp_private.mail_outbox set created_at=now()-interval '90 seconds' where helper_id in(ha,hb);
  perform set_config('role','anon',true);
  r:=public.hp_mail_claim(secret,20);
  assert jsonb_array_length(r)=2, 'bundle count';
  assert r::text !~ 'Notiz gehört|hp-.*helfer.bendito.invalid|mail_secret_hash';
  assert (r->0->>'text') like '%https://helfer.benditotango.de/%';
  assert public.hp_mail_claim(secret)='[]'::jsonb, 'double claim';
  perform set_config('role',owner_role,true);
  select array_agg(id) into ids from hp_private.mail_outbox where helper_id in(ha,hb);
  perform set_config('role','anon',true);
  r:=public.hp_mail_done(secret,ids,false); assert (r->>'ok')::boolean;
  for k in 2..3 loop
    r:=public.hp_mail_claim(secret); assert jsonb_array_length(r)=2;
    r:=public.hp_mail_done(secret,ids,false);
  end loop;
  assert public.hp_mail_claim(secret)='[]'::jsonb;
  perform set_config('role',owner_role,true);
  assert not exists(select 1 from hp_private.mail_outbox where helper_id in(ha,hb) and (tries<>3 or status<>'failed'));
  -- Erfolgsquittung + 7-Tage-Aufräumen und unklarer abgebrochener Versand.
  update hp_private.mail_outbox set status='pending',tries=0 where helper_id=ha;
  perform set_config('role','anon',true);
  r:=public.hp_mail_claim(secret); r:=public.hp_mail_done(secret,ids,true);
  perform set_config('role',owner_role,true);
  assert exists(select 1 from hp_private.mail_outbox where helper_id=ha and status='sent' and sent_at is not null);
  update hp_private.mail_outbox set sent_at=now()-interval '8 days' where helper_id=ha;
  update hp_private.mail_outbox set status='sending',tries=1,claimed_at=now()-interval '11 minutes' where helper_id=hb;
  perform set_config('role','anon',true); r:=public.hp_mail_claim(secret);
  perform set_config('role',owner_role,true);
  assert not exists(select 1 from hp_private.mail_outbox where helper_id=ha);
  assert not exists(select 1 from hp_private.mail_outbox where helper_id=hb and (tries<>3 or status<>'failed'));
  raise notice 'M5 bundles, exclusive claims, 3 failures, done, retention, expired lease: ok';

  perform set_config('request.jwt.claims',jsonb_build_object('sub',ua,'role','authenticated')::text,true);
  perform set_config('role','authenticated',true);
  r:=public.hp_my_mail_enabled(false); assert not (r->>'enabled')::boolean;
  perform set_config('role',owner_role,true);
  perform hp_private.notify(ha,'swap_expired',sid);
  assert not exists(select 1 from hp_private.mail_outbox where helper_id=ha);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',admin_id,'role','authenticated')::text,true);
  perform set_config('role','authenticated',true);
  r:=public.hp_admin_set_helper_mail(ha,'mail-new@example.invalid'); assert (r->>'ok')::boolean;
  perform set_config('role',owner_role,true);
  assert not (select enabled from hp_private.helper_mail where helper_id=ha),'opt out reset';
  perform set_config('role','authenticated',true);
  r:=public.hp_admin_deactivate_helper(hb,true); assert (r->>'ok')::boolean;
  perform set_config('role',owner_role,true);
  assert not (select enabled from hp_private.helper_mail where helper_id=hb);
  assert not exists(select 1 from hp_private.mail_outbox where helper_id=hb and status<>'sent');
  raise notice 'M6 opt-out, address change preserves opt-out, deactivate: ok';

  if real_before=0 then
    perform set_config('role','authenticated',true);
    r:=public.hp_admin_purge('LOESCHEN'); assert (r->>'ok')::boolean;
    perform set_config('role',owner_role,true);
    assert not exists(select 1 from hp_private.helper_mail);
    assert not exists(select 1 from hp_private.mail_outbox);
    raise notice 'M7 purge cascades private tables: ok';
  else
    -- Keine echten Helfer löschen, auch nicht innerhalb einer Rollback-Transaktion.
    delete from public.hp_helpers where id in(ha,hb,hc);
    assert not exists(select 1 from hp_private.helper_mail where helper_id in(ha,hb,hc));
    assert not exists(select 1 from hp_private.mail_outbox where helper_id in(ha,hb,hc));
    assert (select count(*) from public.hp_helpers)=real_before;
    raise notice 'M7 live-safe fixture cleanup: ok (full purge only in disposable DB)';
  end if;
  raise notice 'HP_MAIL_TEST_RESULTS: all passed; transaction rolls back';
end $$;
rollback;
