-- Nur für lokale Tests. Bildet nach, was ein Supabase-Projekt mitbringt:
-- die Rollen, das Schema auth, auth.uid() und die Standardrechte, die Supabase
-- neuen Tabellen und Funktionen im Schema public gibt. Ohne diese Standardrechte
-- würden die Negativtests lokal immer bestehen, auch wenn ein Entzug fehlt.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end $$;

create schema if not exists auth;

-- Wie im echten Projekt: created_at hat keinen Vorgabewert (der Auth-Dienst setzt
-- es selbst), die App-Metadaten liegen in raw_app_meta_data.
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  encrypted_password text,
  raw_app_meta_data jsonb,
  created_at timestamptz
);

create or replace function auth.uid()
returns uuid
language sql stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid;
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;

alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
