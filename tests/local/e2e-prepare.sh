#!/usr/bin/env bash
# Bereitet die lokale Datenbank für den Testlauf vor: frisches Schema, ein
# Orga-Konto für den Nachbau und die drei synthetischen Testhelfer.
# Das Passwort gilt nur für den lokalen Nachbau.
set -euo pipefail
cd "$(dirname "$0")/../.."
DB="${1:-hp_e2e}"
tests/local/db-reset.sh "$DB"
psql -v ON_ERROR_STOP=1 -q -d "$DB" <<'SQL'
insert into auth.users (id, email, encrypted_password)
values ('00000000-0000-4000-8000-0000000000ad', 'orga@test.invalid', 'plain:lokal-orga-passwort');
insert into public.hp_admins (user_id) values ('00000000-0000-4000-8000-0000000000ad');
update public.hp_settings set value = 'null'::jsonb where key = 'swaps_lock_at';
\i supabase/tests/seed_test_helpers.sql
SQL
echo "Testlauf vorbereitet: $(psql -At -d "$DB" -c "select count(*) from public.hp_helpers") Testhelfer"
