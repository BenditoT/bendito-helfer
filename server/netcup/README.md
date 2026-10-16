# Bendito-Datenbank auf netcup

Betrieb der zweiten Supabase-Installation neben dem Stack `teams`. Der `teams`-Stack unter `/opt/teams` wird nicht angefasst.

## Was läuft

- Compose-Projekt `bendito`, Verzeichnis `/opt/bendito/supabase/docker`
- Dienste: `db`, `auth`, `rest`, `meta`, `studio`, `api-gw`, `functions`
- Gateway nur auf `127.0.0.1:8100`
- Öffentlich nur [db.benditotango.de](https://db.benditotango.de/auth/v1/health) für `/auth/v1/*`, `/rest/v1/*` und `/functions/v1/*`
- Realtime, Storage, imgproxy und der Pooler sind nicht gestartet. Ihre Containernamen tragen trotzdem den Präfix `bendito-`, und der Pooler hat keine Ports, damit ein versehentliches `compose up` nicht die Namen des `teams`-Stacks trifft.
- `COMPOSE_FILE` in der Server-`.env` ist `docker-compose.yml:docker-compose.override.yml`. Ohne den zweiten Eintrag ignoriert Compose die Override-Datei, weil die Beispiel-Umgebung `COMPOSE_FILE` setzt.
- Die Login-Funktion liegt in `volumes/functions/hp-login/`. Mitkopiert ist `volumes/functions/deno.jsonc`, weil der Router diese Import-Map fest verdrahtet.
- Am Gateway ist die Functions-Route auf die Herkunft `https://benditot.github.io` und auf localhost begrenzt. Die übrige Envoy-Vorlage erlaubt sonst jede Herkunft. Der Ausschnitt steht in der Route `functions-v1-all` von `volumes/api/envoy/lds.template.yaml`.

## Sicherung

- `/usr/local/sbin/bendito-backup`, Timer `bendito-backup.timer`, alle sechs Stunden um :15, `Persistent=true`
- Dumps in `/var/backups/bendito/`, Modus 600, 28 Dateien
- Abholer-Kopie `/home/nk/bendito-backups/latest.dump`
- Auf dem Mac: LaunchAgent `de.benditotango.db-backup-pull`, täglich 08:00 und beim Anmelden, Ziel `~/Backups/bendito-db/`, 30 Dateien. Nicht ins Git und nicht in den Projektordner.

Wiederherstellungsprobe: `/usr/local/sbin/bendito-restore-probe`. Sie legt `restore_probe` an, spielt den Dump mit `--no-owner --no-privileges` ein, vergleicht `hp_shifts` und `hp_helpers` und löscht die Wegwerf-Datenbank. `pg_restore` meldet Exit 1, weil `vault.secrets` dem Wiederhersteller die Rechte verweigert. Die Zeilenzahlen der Helfer-App stimmen trotzdem.

## Orga-Konto

Norbert führt auf dem Mac `tools/orga-konto-netcup.sh` aus. Das Gegenstück auf dem Server ist `/home/nk/bendito-paket/create_admin.py`.

## Rückweg auf die Cloud

1. Dump ziehen.
2. Im Repo: `node tools/set-backend.mjs https://pumbaojykazurlncntae.supabase.co sb_publishable_Rfc4THqxTClo3UMIk5c8Eg_FkDKpjh9`
3. Version hoch, Commit, Push.
4. Die Cloud nicht löschen und nicht pausieren. Bis zum 15.11. einmal pro Woche das [Dashboard](https://supabase.com/dashboard/project/pumbaojykazurlncntae) öffnen.

Daten, die nur auf netcup stehen, sind in der Cloud nicht vorhanden.

In diesem Ordner liegen keine `.env` und kein Dienstschlüssel. Der öffentliche anon-Schlüssel steht in `config.js` und im Health-Workflow.
