-- Run only on the isolated local test database.
begin;
insert into auth.users(id,email) values ('00000000-0000-0000-0000-000000000071','reply-admin@example.test');
insert into public.hp_admins(user_id,active) values ('00000000-0000-0000-0000-000000000071',true);
insert into public.hp_help_offers(id,display_name,email,arrive_thu,stay_mon,pre_milonga,dinner_sun)
values ('00000000-0000-0000-0000-000000000072','Test Reply','reply-offer@example.test','ja','nein','ja','nein');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000071',true);
do $$ declare r jsonb; begin
  r := public.hp_admin_save_offer_reply('00000000-0000-0000-0000-000000000072','Danke','Antwort','draft',0);
  assert r->>'ok'='true' and r->>'revision'='1','save failed';
  r := public.hp_admin_save_offer_reply('00000000-0000-0000-0000-000000000072','Alt','Überschreiben','done',0);
  assert r->>'code'='CONFLICT','stale write accepted';
  r := public.hp_admin_save_offer_reply('00000000-0000-0000-0000-000000000072',E'Betreff\nBcc:','Antwort','draft',1);
  assert r->>'code'='INVALID_INPUT','header injection accepted';
  assert (public.hp_admin_list_help_offers()->0->>'reply_body')='Antwort','draft missing on reload';
  perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000073',true);
  begin
    perform public.hp_admin_save_offer_reply('00000000-0000-0000-0000-000000000072','X','X','draft',1);
    raise exception 'non-admin accepted';
  exception when insufficient_privilege then null; end;
  assert not has_function_privilege('anon','public.hp_admin_save_offer_reply(uuid,text,text,text,integer)','execute');
end $$;
rollback;
