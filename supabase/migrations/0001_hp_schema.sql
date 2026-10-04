-- Bendito Helferplan 5.0.0 — Schema
-- Alle Tabellen tragen das Präfix hp_. Kein Client darf eine Tabelle direkt lesen
-- oder beschreiben: RLS ist aktiv, die einzige Policy verweigert alles, und die
-- Tabellenrechte von anon und authenticated sind entzogen. Gelesen und geändert
-- wird ausschließlich über die Funktionen aus 0002 bis 0004.
--
-- Interne Hilfsfunktionen liegen im Schema hp_private. Dieses Schema ist über
-- die Daten-API nicht erreichbar und für anon und authenticated nicht nutzbar.
-- Das gilt auch dann, wenn im selben Projekt eine andere Anwendung Rechte auf
-- Funktionen im Schema public pauschal vergibt.

create schema if not exists hp_private;
revoke all on schema hp_private from public, anon, authenticated;

create table public.hp_helpers (
  id uuid primary key default gen_random_uuid(),
  display_name text not null
    check (char_length(btrim(display_name)) between 1 and 40),
  color text not null default '#C9962B'
    check (color ~ '^#[0-9A-Fa-f]{6}$'),
  -- Nur der bevorzugte Weg, nie eine Nummer oder Adresse.
  contact_channel text not null default ''
    check (contact_channel in ('', 'WhatsApp', 'Signal', 'Telegram', 'Threema', 'E-Mail', 'Telefon', 'SMS')),
  is_setup_team boolean not null default false,
  target_shifts int check (target_shifts between 0 and 30),
  active boolean not null default true,
  is_test boolean not null default false,
  auth_user_id uuid unique references auth.users (id) on delete set null,
  login_code_hash text unique,
  login_code_created_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index hp_helpers_name_active on public.hp_helpers (lower(btrim(display_name))) where active;

create table public.hp_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.hp_shifts (
  id text primary key check (id ~ '^[a-z0-9]{2,12}$'),
  day text not null check (day in ('fri', 'sat', 'sun')),
  type_key text not null check (type_key ~ '^[a-z-]{2,20}$'),
  start_time time not null,
  duration_min int not null check (duration_min between 15 and 600),
  capacity int not null check (capacity between 1 and 20),
  sort int not null,
  -- Absolute Minute ab Freitag 00:00. Uhrzeiten vor 06:00 gehören fachlich zum
  -- Vorabend und zählen deshalb als Folgetag.
  start_min int generated always as (
    (case day when 'fri' then 0 when 'sat' then 1 else 2 end) * 1440
    + (extract(hour from start_time)::int * 60 + extract(minute from start_time)::int)
    + (case when start_time < time '06:00' then 1440 else 0 end)
  ) stored,
  end_min int generated always as (
    (case day when 'fri' then 0 when 'sat' then 1 else 2 end) * 1440
    + (extract(hour from start_time)::int * 60 + extract(minute from start_time)::int)
    + (case when start_time < time '06:00' then 1440 else 0 end)
    + duration_min
  ) stored
);

create table public.hp_assignments (
  shift_id text not null references public.hp_shifts (id) on delete cascade,
  helper_id uuid not null references public.hp_helpers (id) on delete cascade,
  assigned_at timestamptz not null default now(),
  assigned_by uuid,
  primary key (shift_id, helper_id)
);
create index hp_assignments_helper on public.hp_assignments (helper_id);

create table public.hp_swaps (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('swap', 'move')),
  from_helper uuid not null references public.hp_helpers (id) on delete cascade,
  from_shift text not null references public.hp_shifts (id) on delete cascade,
  to_shift text not null references public.hp_shifts (id) on delete cascade,
  note text not null default '' check (char_length(note) <= 200),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected', 'cancelled', 'expired')),
  accepted_by uuid references public.hp_helpers (id) on delete set null,
  resolved_by uuid,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  check (from_shift <> to_shift)
);
create unique index hp_swaps_one_pending on public.hp_swaps (from_helper, from_shift, to_shift) where status = 'pending';
create index hp_swaps_from_helper on public.hp_swaps (from_helper);
create index hp_swaps_from_shift on public.hp_swaps (from_shift);
create index hp_swaps_to_shift on public.hp_swaps (to_shift);
create index hp_swaps_accepted_by on public.hp_swaps (accepted_by);

create table public.hp_notifications (
  id bigint generated always as identity primary key,
  helper_id uuid not null references public.hp_helpers (id) on delete cascade,
  kind text not null
    check (kind in ('swap_request', 'swap_accepted', 'swap_rejected', 'swap_cancelled', 'swap_expired')),
  swap_id bigint references public.hp_swaps (id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index hp_notifications_helper on public.hp_notifications (helper_id, created_at desc);
create index hp_notifications_swap on public.hp_notifications (swap_id);

create table public.hp_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- Keine Namen, keine Codes: nur technische Kennungen.
create table public.hp_audit (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor uuid,
  action text not null,
  shift_id text,
  helper_id uuid,
  outcome text not null default 'ok'
);
create index hp_audit_at on public.hp_audit (at desc);

-- Fehlversuche beim Code-Login. Gespeichert wird ein Schlüssel-Hash der Adresse,
-- nie die Adresse selbst. Einträge älter als ein Tag werden beim Login entfernt.
create table public.hp_login_attempts (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  at timestamptz not null default now(),
  ok boolean not null
);
create index hp_login_attempts_ip on public.hp_login_attempts (ip_hash, at desc);

-- Zeilenrechte: alles zu.
do $$
declare
  t text;
begin
  foreach t in array array[
    'hp_helpers', 'hp_admins', 'hp_shifts', 'hp_assignments', 'hp_swaps',
    'hp_notifications', 'hp_settings', 'hp_audit', 'hp_login_attempts'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy hp_no_client on public.%I for all to anon, authenticated using (false) with check (false)', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
  end loop;
end $$;

-- Sequenzen der Identitätsspalten ebenfalls sperren. Bewusst nur die eigenen,
-- damit ein gemeinsam genutztes Projekt (Check-in) unberührt bleibt.
do $$
declare
  s text;
begin
  for s in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'S' and c.relname like 'hp\_%'
  loop
    execute format('revoke all on sequence public.%I from anon, authenticated', s);
  end loop;
end $$;

insert into public.hp_settings (key, value) values
  ('data_version', '1'::jsonb),
  ('target_shifts', '6'::jsonb),
  ('target_hours', '9'::jsonb),
  ('swaps_locked', 'false'::jsonb),
  ('swaps_lock_at', '"2026-10-29T20:00:00+01:00"'::jsonb),
  ('event_end', '"2026-11-01T17:00:00+01:00"'::jsonb),
  ('purge_after', '"2026-11-15"'::jsonb);
