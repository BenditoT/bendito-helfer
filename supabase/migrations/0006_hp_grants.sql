-- Bendito Helferplan 5.0.0 — Ausführungsrechte
--
-- Neue Funktionen sind in Postgres für PUBLIC ausführbar, und Supabase gibt sie
-- zusätzlich an anon und authenticated. Deshalb zuerst alles entziehen, dann
-- gezielt freigeben. Bewusst nur für hp_-Funktionen, damit ein gemeinsam
-- genutztes Projekt (Check-in) unberührt bleibt.
--
-- Diese Datei darf beliebig oft laufen. Wird im selben Projekt später eine
-- Migration eingespielt, die Rechte pauschal entzieht, diese Datei danach
-- erneut ausführen.

do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'hp\_%'
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
  end loop;
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
