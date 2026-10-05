-- Prüft Rechte und Zeilensicherheit der Helfer-App.
--
-- Liest nur den Katalog der Datenbank. Ändert nichts und fasst keine Daten an,
-- läuft also auch im laufenden Betrieb mit echten Helfern. Gedacht für den Fall,
-- dass eine andere Anwendung im selben Projekt Rechte pauschal vergeben oder
-- entzogen hat.
--
-- Erwartet: in jeder Zeile ok = true. Sonst 0006_hp_grants.sql noch einmal
-- ausführen und erneut prüfen. Die Liste der 18 Funktionen muss zu
-- 0006_hp_grants.sql passen.

with fn as (
  select n.nspname as schema_name, p.oid, p.proname, p.proconfig,
         case when n.nspname = 'public' then p.proname
              else n.nspname || '.' || p.proname end as label
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where (n.nspname = 'public' and p.proname like 'hp\_%') or n.nspname = 'hp_private'
),
tb as (
  select c.oid, c.relname, c.relrowsecurity
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'hp\_%'
),
soll_auth(label) as (values
  ('hp_my_context'), ('hp_state'), ('hp_mark_read'),
  ('hp_swap_request'), ('hp_swap_accept'), ('hp_swap_reject'), ('hp_swap_cancel'),
  ('hp_admin_assign'), ('hp_admin_unassign'), ('hp_admin_upsert_helper'), ('hp_admin_add_helpers'),
  ('hp_admin_deactivate_helper'), ('hp_admin_reactivate_helper'), ('hp_admin_set_setting'),
  ('hp_admin_remove_test_data'), ('hp_admin_purge'), ('hp_admin_new_login_code'), ('hp_admin_revoke_login')
),
soll_svc(label) as (values ('hp_login_lookup'), ('hp_login_bind')),
ist_anon as (select label from fn where has_function_privilege('anon', oid, 'execute')),
ist_auth as (select label from fn where has_function_privilege('authenticated', oid, 'execute')),
ist_svc as (select label from fn where has_function_privilege('service_role', oid, 'execute')),
abw_auth as (
  select 'fehlt: ' || label as txt from soll_auth where label not in (select label from ist_auth)
  union all
  select 'zu viel: ' || label from ist_auth where label not in (select label from soll_auth)
),
abw_svc as (
  select 'fehlt: ' || label as txt from soll_svc where label not in (select label from ist_svc)
  union all
  select 'zu viel: ' || label from ist_svc where label not in (select label from soll_svc)
),
tabrecht as (
  select tb.relname || ' ' || r.rolle || ' ' || pr.recht as txt
  from tb
  cross join (values ('anon'), ('authenticated')) as r(rolle)
  cross join (values ('select'), ('insert'), ('update'), ('delete'), ('truncate'), ('references'), ('trigger')) as pr(recht)
  where has_table_privilege(r.rolle, tb.oid, pr.recht)
),
pol as (
  select tablename, policyname, qual, with_check
  from pg_policies where schemaname = 'public' and tablename like 'hp\_%'
)
select 1 as nr, 'Zeilensicherheit auf allen neun Tabellen' as pruefung, '9 von 9' as soll,
       (select count(*) filter (where relrowsecurity) || ' von ' || count(*) from tb) as ist,
       (select count(*) = 9 and coalesce(bool_and(relrowsecurity), false) from tb) as ok
union all
select 2, 'Je Tabelle nur die Sperr-Regel hp_no_client', '9, alle gesperrt',
       (select count(*) || ', davon gesperrt ' || count(*) filter (where policyname = 'hp_no_client' and qual = 'false' and with_check = 'false') from pol),
       (select count(*) = 9 and count(*) filter (where policyname = 'hp_no_client' and qual = 'false' and with_check = 'false') = 9 from pol)
union all
select 3, 'Tabellenrechte für anon und authenticated', 'keine',
       (select coalesce(string_agg(txt, ', ' order by txt), 'keine') from tabrecht),
       (select count(*) = 0 from tabrecht)
union all
select 4, 'Funktionen ohne Anmeldung ausführbar', 'keine',
       (select coalesce(string_agg(label, ', ' order by label), 'keine') from ist_anon),
       (select count(*) = 0 from ist_anon)
union all
select 5, 'Funktionen für angemeldete Konten', 'genau die 18 der App',
       (select coalesce(string_agg(txt, ', ' order by txt), 'genau die 18 der App') from abw_auth),
       (select count(*) = 0 from abw_auth) and (select count(*) = 18 from ist_auth)
union all
select 6, 'Funktionen für die Edge Function', 'genau hp_login_lookup und hp_login_bind',
       (select coalesce(string_agg(txt, ', ' order by txt), 'genau hp_login_lookup und hp_login_bind') from abw_svc),
       (select count(*) = 0 from abw_svc)
union all
select 7, 'Schema hp_private für anon und authenticated', 'kein Zugriff',
       case when has_schema_privilege('anon', 'hp_private', 'usage') or has_schema_privilege('authenticated', 'hp_private', 'usage')
            then 'Zugriff' else 'kein Zugriff' end,
       not (has_schema_privilege('anon', 'hp_private', 'usage') or has_schema_privilege('authenticated', 'hp_private', 'usage'))
union all
select 8, 'Alle Funktionen mit festem, leerem Suchpfad', 'alle',
       (select coalesce(string_agg(label, ', ' order by label), 'alle') from fn
         where proconfig is null or not (proconfig @> array['search_path=""'])),
       (select count(*) = 0 from fn where proconfig is null or not (proconfig @> array['search_path=""']))
order by nr;
