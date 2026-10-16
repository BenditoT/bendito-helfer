# Bendito Helferplan

Schichtplan der ehrenamtlichen Helfer beim Bendito Tango Marathon (30.10.–01.11.2026). Die Orga weist Schichten zu, Helfer sehen ihren Plan am Telefon und tauschen untereinander.

Version 5.0.1. Dieses Repository ist öffentlich und enthält **keine Personendaten und keine Geheimnisse**, auch nicht in der Historie. Namen stehen nur in der Datenbank.

## Aufbau

| Pfad | Inhalt |
|---|---|
| `index.html`, `app.js`, `styles.css` | Die App. Preact und htm ohne Build-Schritt. |
| `config.js` | Adresse des Supabase-Projekts und der öffentliche Schlüssel (publishable, früher anon). Wird nur über `tools/set-backend.mjs` geändert. |
| `vendor/` | Preact, htm und supabase-js als feste Dateien mit Prüfsummen. Zur Laufzeit wird kein Code von Dritten geladen. |
| `assets/` | Logo. |
| `supabase/migrations/` | Datenbank: Tabellen `hp_…`, Funktionen, Schichtraster, Rechte. Interne Hilfsfunktionen liegen im Schema `hp_private`. |
| `supabase/functions/hp-login/` | Edge Function, die den persönlichen Link gegen eine Sitzung tauscht. `supabase/config.toml` stellt sie ohne JWT-Prüfung bereit. |
| `supabase/tests/` | SQL-Tests für Tausch (T1–T11) und Rechte (R1–R20), Rechteprüfung für den laufenden Betrieb (`check_rechte.sql`), Testhelfer. |
| `tests/` | Statische Prüfungen, SQL-Testlauf, HTTP-Tests, Browser-Testlauf, Schranke vor der Veröffentlichung. |
| `docs/` | [Betrieb](docs/BETRIEB.md), [Ankündigung](docs/ANKUENDIGUNG.md), [Review](docs/REVIEW-5.0.0.md), [Testprotokoll](docs/TESTLAUF-5.0.0.md). |

Kein Client liest oder schreibt eine Tabelle direkt. Gelesen wird über `hp_state()`, geändert über die `hp_…`-Funktionen, die bei jedem Aufruf prüfen, ob der Aufrufer Orga oder ein zugeordneter Helfer ist. Die beiden Login-Funktionen lassen nur die Edge Function durch.

## Tests

```bash
node --test tests/static.test.mjs          # ohne Datenbank, ohne Paket
tests/local/db-reset.sh                    # lokale Postgres mit Supabase-Nachbau (PGHOST, PGPORT, PGUSER)
node --test tests/sql.test.mjs             # Tausch- und Rechtetests, gleichzeitige Annahme
node --test tests/http.test.mjs            # Login-Funktion, Fehlversuche, abgelaufene Token; braucht Deno
tests/local/e2e-prepare.sh                 # Datenbank für den Browser-Testlauf
HP_PGDATABASE=hp_e2e node tests/local/stub-server.mjs &
node tests/e2e/testlauf.cjs                # drei Browserprofile; braucht Playwright und Deno
```

Die Testdateien `t_rights.sql` und `t_swaps.sql` laufen auch im echten Projekt, solange dort noch keine Helfer stehen: Jede rollt sich selbst zurück und meldet ihr Ergebnis in der Fehlermeldung nach `HP_TEST_RESULTS`. Die Fälle zählen Zeilen. Stehen schon Helfer in der Datenbank (auch Testhelfer), brechen beide sofort mit `HP_TEST_ABGEBROCHEN` ab und ändern nichts.

Im laufenden Betrieb prüft `supabase/tests/check_rechte.sql` Rechte und Zeilensicherheit. Die Datei liest nur den Katalog, ändert nichts und läuft mit echten Daten. Erwartet: acht Zeilen, in jeder `ok = true`.

Der Browser-Testlauf läuft gegen jede Adresse, auch gegen die Live-Seite:

```bash
HP_BASE_URL=https://benditot.github.io/bendito-helfer/ HP_ADMIN_EMAIL=… HP_ADMIN_PASSWORD=… node tests/e2e/testlauf.cjs
```

Der Testlauf schaltet die Tauschsperre um, ändert kurz Sperrzeitpunkt, Eventende und Löschtermin, legt zwei weitere Testhelfer an und entfernt am Ende die Testdaten. Gegen die Live-Seite startet ihn nur die Orga selbst mit ihrem eigenen Passwort. Er bricht vor der ersten Änderung ab, wenn es einen Helfer gibt, der kein Testhelfer ist. Er gehört also vor das Verteilen der Links.

Rot gewordene Tests werden nicht durch längere Wartezeiten grün gemacht. Die 30 Sekunden im Testlauf sind die Anforderung.

## Datenbank einrichten

1. Migrationen `supabase/migrations/0001` bis `0006` in dieser Reihenfolge einspielen.
2. Edge Function `hp-login` bereitstellen, **ohne JWT-Prüfung** (`verify_jwt = false`, steht in `supabase/config.toml`). Die Funktion ist der Login selbst und prüft den Code. Mit eingeschalteter Prüfung weist das Gateway Aufrufe mit einem publishable-Schlüssel ab, bevor die Funktion läuft.
3. Orga-Konten in Supabase Auth anlegen und in `hp_admins` eintragen.
4. `node tools/set-backend.mjs https://<projekt>.supabase.co <anon-Schlüssel>` trägt das Projekt in `config.js` und in die Content-Security-Policy ein.
5. Prüfen: `supabase/tests/t_rights.sql` und `t_swaps.sql` im SQL-Editor laufen lassen (vor dem Anlegen der ersten Helfer), den Security Advisor ansehen, die Selbstregistrierung im Projekt ausschalten, dann der Durchgang von Hand auf der veröffentlichten Seite (`docs/TESTLAUF-5.0.0.md`). Er ist die Freigabe.

Hinweise zum Dashboard, falls ohne Supabase-CLI eingerichtet wird:

- Der SQL-Editor fragt bei `0001` nach, weil Tabellen zunächst ohne Zeilensicherheit entstehen. Das Skript schaltet sie im selben Lauf selbst ein; „Run without RLS“ ist hier richtig. Bei `0002` bis `0004` genügt „Run query“.
- Im Funktions-Editor heißt der Schalter für die JWT-Prüfung „Verify JWT with legacy secret“. Er muss **aus** sein.
- Die Testskripte melden ihr Ergebnis als Fehlermeldung, die mit `HP_TEST_RESULTS` beginnt. Das ist Absicht: So bleibt von den Testdaten nichts in der Datenbank.
- Der Security Advisor meldet für die 18 Funktionen der App je eine Warnung. Begründung in `docs/REVIEW-5.0.0.md`.

Läuft die App unter einer anderen Adresse als `https://benditot.github.io`, die Herkunft in der Umgebungsvariable `HP_ALLOWED_ORIGINS` der Funktion eintragen (kommagetrennt, nur `https://…`).

### Ein Projekt gemeinsam mit einer anderen App

Die App kommt mit einem geteilten Supabase-Projekt zurecht, ein eigenes ist aber die sauberere Lösung. Was beim Teilen gilt:

- Alle Objekte heißen `hp_…` oder liegen im Schema `hp_private`. Die Migrationen fassen nichts anderes an.
- Entzieht oder vergibt die andere App Funktionsrechte pauschal, danach `0006_hp_grants.sql` noch einmal ausführen und mit `supabase/tests/check_rechte.sql` prüfen. Beide Dateien dürfen beliebig oft laufen.
- Die internen Funktionen bleiben auch bei einer pauschalen Freigabe unerreichbar (eigenes Schema), die Login-Funktionen lassen weiterhin nur die Edge Function durch (Test R18).
- Jeder Helfer-Link erzeugt ein Anmeldekonto im Projekt. Für die andere App ist so ein Konto „angemeldet“. Deren Rechte dürfen deshalb nicht an „ist angemeldet“ hängen. Das vor dem Zusammenlegen mit einem Helfer-Konto gegen die Tabellen und Funktionen der anderen App prüfen.

## Veröffentlichen

GitHub Pages aus dem Zweig `main`, Wurzelverzeichnis. Vor jedem Push:

```bash
node --test tests/static.test.mjs && node tests/prepublish-check.mjs
```

Die Schranke prüft Dateien und Historie gegen die Namen und Geheimnisse aus dem alten Stand. Sie liest die alte Datei lokal und gibt die Werte nie aus. Nach einem Push kann es bis zu zehn Minuten dauern, bis die Seite neu ausgeliefert wird. Zum Prüfen die Adresse mit `?v=5.0.0` aufrufen.

Unter `benditot.github.io` teilen sich alle Seiten den Speicher des Browsers. Eine andere Seite unter dieser Adresse könnte die Anmeldung des Helferplans lesen. Dort also nur eigene, geprüfte Seiten veröffentlichen.

## Zurück auf den vorherigen Stand

```bash
git revert --no-edit HEAD && git push
```

Das stellt die vorherige Fassung der App wieder her. Die Datenbank bleibt, wie sie ist: Migrationen werden nicht automatisch zurückgenommen.

## Betrieb

Siehe [docs/BETRIEB.md](docs/BETRIEB.md) und [docs/ANKUENDIGUNG.md](docs/ANKUENDIGUNG.md).
