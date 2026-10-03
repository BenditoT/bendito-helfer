# Bendito Helferplan

Schichtplan der ehrenamtlichen Helfer beim Bendito Tango Marathon (30.10.–01.11.2026). Die Orga weist Schichten zu, Helfer sehen ihren Plan am Telefon und tauschen untereinander.

Version 5.0.0. Dieses Repository ist öffentlich und enthält **keine Personendaten und keine Geheimnisse**, auch nicht in der Historie. Namen stehen nur in der Datenbank.

## Aufbau

| Pfad | Inhalt |
|---|---|
| `index.html`, `app.js`, `styles.css` | Die App. Preact und htm ohne Build-Schritt. |
| `config.js` | Adresse des Supabase-Projekts und der anon-Schlüssel. Wird nur über `tools/set-backend.mjs` geändert. |
| `vendor/` | Preact, htm und supabase-js als feste Dateien mit Prüfsummen. Zur Laufzeit wird kein Code von Dritten geladen. |
| `assets/` | Logo. |
| `supabase/migrations/` | Datenbank: Tabellen `hp_…`, Funktionen, Schichtraster, Rechte. |
| `supabase/functions/hp-login/` | Edge Function, die den persönlichen Link gegen eine Sitzung tauscht. |
| `supabase/tests/` | SQL-Tests für Tausch (T1–T10) und Rechte (R1–R17), Testhelfer. |
| `tests/` | Statische Prüfungen, SQL-Testlauf, Browser-Testlauf, Schranke vor der Veröffentlichung. |
| `docs/` | Betrieb, Ankündigung, Review, Testprotokoll. |

Kein Client liest oder schreibt eine Tabelle direkt. Gelesen wird über `hp_state()`, geändert über die `hp_…`-Funktionen, die bei jedem Aufruf prüfen, ob der Aufrufer Orga oder ein zugeordneter Helfer ist.

## Tests

```bash
node --test tests/static.test.mjs          # ohne Datenbank, ohne Paket
tests/local/db-reset.sh                    # lokale Postgres mit Supabase-Nachbau (PGHOST, PGPORT, PGUSER)
node --test tests/sql.test.mjs             # Tausch- und Rechtetests, gleichzeitige Annahme
tests/local/e2e-prepare.sh                 # Datenbank für den Browser-Testlauf
HP_PGDATABASE=hp_e2e node tests/local/stub-server.mjs &
node tests/e2e/testlauf.cjs                # drei Browserprofile; braucht Playwright und Deno
```

Die SQL-Dateien unter `supabase/tests/` laufen auch im echten Projekt: Jede rollt sich selbst zurück und meldet ihr Ergebnis in der Fehlermeldung nach `HP_TEST_RESULTS`.

Der Browser-Testlauf läuft gegen jede Adresse, auch gegen die Live-Seite:

```bash
HP_BASE_URL=https://benditot.github.io/bendito-helfer/ HP_ADMIN_EMAIL=… HP_ADMIN_PASSWORD=… node tests/e2e/testlauf.cjs
```

Rot gewordene Tests werden nicht durch längere Wartezeiten grün gemacht. Die 30 Sekunden im Testlauf sind die Anforderung.

## Datenbank einrichten

1. Migrationen `supabase/migrations/0001` bis `0006` in dieser Reihenfolge einspielen.
2. Edge Function `hp-login` deployen.
3. Orga-Konten in Supabase Auth anlegen und in `hp_admins` eintragen.
4. `node tools/set-backend.mjs https://<projekt>.supabase.co <anon-Schlüssel>` trägt das Projekt in `config.js` und in die Content-Security-Policy ein.

Teilt sich die App ein Supabase-Projekt mit einer anderen App und entzieht deren Migration pauschal Funktionsrechte, danach `0006_hp_grants.sql` noch einmal ausführen. Die Datei darf beliebig oft laufen.

## Veröffentlichen

GitHub Pages aus dem Zweig `main`, Wurzelverzeichnis. Vor jedem Push:

```bash
node --test tests/static.test.mjs && node tests/prepublish-check.mjs
```

Die Schranke prüft Dateien und Historie gegen die Namen und Geheimnisse aus dem alten Stand. Sie liest die alte Datei lokal und gibt die Werte nie aus. Nach einem Push kann es bis zu zehn Minuten dauern, bis die Seite neu ausgeliefert wird. Zum Prüfen die Adresse mit `?v=5.0.0` aufrufen.

## Zurück auf den vorherigen Stand

```bash
git revert --no-edit HEAD && git push
```

Das stellt die vorherige Fassung der App wieder her. Die Datenbank bleibt, wie sie ist: Migrationen werden nicht automatisch zurückgenommen.

## Betrieb

Siehe [docs/BETRIEB.md](docs/BETRIEB.md) und [docs/ANKUENDIGUNG.md](docs/ANKUENDIGUNG.md).
