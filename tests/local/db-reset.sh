#!/usr/bin/env bash
# Legt die lokale Testdatenbank neu an und spielt Nachbau und Migrationen ein.
# Aufruf: tests/local/db-reset.sh [datenbankname]
# Verbindung über die üblichen Variablen PGHOST, PGPORT, PGUSER.
set -euo pipefail
cd "$(dirname "$0")/../.."
DB="${1:-hp_test}"
psql -v ON_ERROR_STOP=1 -q -d postgres -c "drop database if exists ${DB} with (force)" -c "create database ${DB}"
psql -v ON_ERROR_STOP=1 -q -d "$DB" -f tests/local/supabase-nachbau.sql
for f in supabase/migrations/*.sql; do
  psql -v ON_ERROR_STOP=1 -q -d "$DB" -f "$f"
done
echo "Datenbank ${DB} bereit: $(psql -At -d "$DB" -c "select count(*) from public.hp_shifts") Schichten"
