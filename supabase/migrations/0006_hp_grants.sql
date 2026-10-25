-- Bendito Helferplan 5.0.0 — Ausführungsrechte
--
-- Neue Funktionen sind in Postgres für PUBLIC ausführbar, und Supabase gibt sie
-- im Schema public zusätzlich an anon und authenticated. Deshalb zuerst alles
-- entziehen, dann gezielt freigeben. Bewusst nur für die eigenen Funktionen
-- (public.hp_… und alles in hp_private), damit ein gemeinsam genutztes Projekt
-- (Check-in) unberührt bleibt.
--
-- Diese Datei darf beliebig oft laufen. Wird im selben Projekt später eine
-- Migration eingespielt, die Rechte pauschal entzieht oder vergibt, diese Datei
-- danach erneut ausführen.

revoke all on schema hp_private from public, anon, authenticated;

do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where (n.nspname = 'public' and p.proname like 'hp\_%')
       or n.nspname = 'hp_private'
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
  end loop;
end $$;

-- Die Edge Function arbeitet als service_role und braucht nur die beiden
-- Login-Funktionen. Alles andere ist auch für sie zu.
do $$
declare
  f record;
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    for f in
      select p.oid::regprocedure as sig
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where (n.nspname = 'public' and p.proname like 'hp\_%')
         or n.nspname = 'hp_private'
    loop
      execute format('revoke all on function %s from service_role', f.sig);
    end loop;
  end if;
end $$;

-- Für angemeldete Sitzungen. Jede Funktion prüft selbst, ob der Aufrufer Orga
-- oder ein zugeordneter Helfer ist.
grant execute on function public.hp_my_context() to authenticated;
grant execute on function public.hp_state() to authenticated;
grant execute on function public.hp_mark_read(bigint[]) to authenticated;
grant execute on function public.hp_swap_request(text, text, text) to authenticated;
grant execute on function public.hp_swap_accept(bigint) to authenticated;
grant execute on function public.hp_swap_reject(bigint) to authenticated;
grant execute on function public.hp_swap_cancel(bigint) to authenticated;
grant execute on function public.hp_admin_assign(text, uuid, boolean) to authenticated;
grant execute on function public.hp_admin_unassign(text, uuid) to authenticated;
grant execute on function public.hp_admin_upsert_helper(uuid, text, text, text, boolean, int, boolean) to authenticated;
grant execute on function public.hp_admin_add_helpers(text[], boolean) to authenticated;
grant execute on function public.hp_admin_deactivate_helper(uuid, boolean) to authenticated;
grant execute on function public.hp_admin_reactivate_helper(uuid) to authenticated;
grant execute on function public.hp_admin_set_setting(text, jsonb) to authenticated;
grant execute on function public.hp_admin_remove_test_data() to authenticated;
grant execute on function public.hp_admin_purge(text) to authenticated;
grant execute on function public.hp_admin_new_login_code(uuid) to authenticated;
grant execute on function public.hp_admin_revoke_login(uuid) to authenticated;

-- Nur für die Edge Function hp-login.
grant execute on function public.hp_login_lookup(text, text) to service_role;
grant execute on function public.hp_login_bind(uuid, text, uuid) to service_role;

-- Funktionen aus 0007 gibt es beim ersten Durchlauf noch nicht. Läuft diese
-- Datei später noch einmal, stellt der Block die Rechte wieder her, die der
-- Entzug oben gerade entfernt hat.
do $$
begin
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'hp_submit_help_offer'
  ) then
    execute 'grant execute on function public.hp_submit_help_offer(text, text, text, text, text, text, text, text, text, text) to service_role';
  end if;
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'hp_admin_list_help_offers'
  ) then
    execute 'grant execute on function public.hp_admin_list_help_offers() to authenticated';
  end if;
end $$;

-- Mail-RPCs aus 0009 bei einer späteren Rechte-Reparatur wiederherstellen.
do $$
begin
  if to_regprocedure('public.hp_mail_claim(text,integer)') is not null then
    grant execute on function public.hp_mail_claim(text,int), public.hp_mail_done(text,bigint[],boolean) to anon;
    grant execute on function public.hp_admin_set_helper_mail(uuid,text), public.hp_admin_helper_mail_list(),
      public.hp_my_mail_enabled(boolean), public.hp_admin_set_mail_secret_hash(text) to authenticated;
  end if;
end $$;
