**25.10.2026 — Version 5.0.7 veröffentlicht.** Norbert hat Codex ausdrücklich zum selbstständigen Push ermächtigt. Commit `1edc156` auf origin/main gepusht, Live-Seite zeigt 5.0.7, „← Zur Bendito-App“ live angeklickt und korrekt zur Gäste-App navigiert. 28 Prüfungen und Veröffentlichungsschranke grün. Mailversand bleibt ausgeschaltet.

**Was Norbert jetzt tut:** Den Rückweg zur Bendito-App in der veröffentlichten Helfer-App ausprobieren.

---

**25.10.2026 — Opus-Mail-Sprint abgeschlossen; Rückweg zur Bendito-App (5.0.7) vorbereitet.** Datenbank nach Sicherung 20261025-1313 live installiert und geprüft. O6 bestanden: tatsächliche Tauschanfrage 13:44:37, automatischer Versand und Received-Header 13:45:43 CET, tatsächlicher Eingang im separaten eigenen Postfach geprüft — rund 66 Sekunden. Insgesamt zwei ausdrücklich autorisierte Testmails nur an Norberts eigene Empfänger; erster Versuch über Rückleitung ins Senderkonto war nicht eindeutig. Danach Versand aus, Triggerübersicht 0, Testhelfer samt Adressen/Outbox entfernt; 8 echte Helfer und Zuweisungen unverändert. Die normale Helferbenachrichtigung bleibt bis zur Sonnet-Abnahme und ausdrücklichen Versandfreigabe aus. Version 5.0.7 ergänzt „← Zur Bendito-App“ in Kopfzeile, Login und Verbindungsmeldungen; echter Klick, erhaltene Anmeldung und Handyansicht geprüft. 28 lokale Prüfungen und Veröffentlichungsschranke grün. Noch kein Push; Veröffentlichung laut Projektvorgabe durch Norbert. [Testbericht](docs/TESTLAUF-MAIL-BACKEND-2026-10-25.md).

**Was Norbert jetzt tut:** Den Rückweg zur Bendito-App in der veröffentlichten Helfer-App ausprobieren.

---

# HANDOVER – Bendito Helferplan

## Mein Plan ohne Soll-Stunden (25.10.2026, 5.0.6, noch nicht live)

Helfer sahen „9,5 h von 9 h“ (Sylvia) oder „8,5 h von 9 h“ ohne Haken (Claudia, Marita), obwohl alle 6 von 6 Schichten haben. Grund: Schichten von 1 oder 2 Stunden. „Mein Plan“ zeigt jetzt „6 Schichten · 9,5 h ✓“. Der Haken kommt, wenn die Soll-Schichten erreicht sind. Die Orga-Ansicht ist unverändert. Geändert: `app.js`, `config.js`, `index.html`, `CHANGELOG.md`, `README.md`. Geprüft: `node --check app.js`, Schranke `prepublish-check` grün. `tests/static.test.mjs` hat 3 Fehler. Sie sind älter als diese Änderung (CSP `'self'` aus 5.0.4, `kb-team-pass` aus 5.0.3, CSP von mithilfe.html) und nicht behoben. Nicht committed, weil git im Cowork-Ordner keine Lock-Dateien löschen kann. Mit dem Push gehen auch die 3 lokalen Commits davor raus (Schichtraster 2026, zwei Übergabe-Notizen).

**Was Norbert jetzt tut:** Den Befehl aus dem Chat im Terminal ausführen (Commit und Push), dann nach etwa 10 Minuten im Helferplan prüfen, ob unten 5.0.6 steht.

## Orga-Login wieder erreichbar (24.10.2026, nachts)

Die Anmeldung kam an, der Planabruf danach nicht. Der Browser schickt dafür die Köpfe `content-profile` und `prefer`. Die Gateway-Freigabe für `/rest/v1/` ließ sie nicht zu, also blieb der eigentliche Aufruf aus. Ergänzt in `lds.template.yaml` auf dem Server, nur die Route `rest-v1-protected`. Sicherung davor: `lds.template.yaml.vor-cors-profil-2026-10-24`. Neu gestartet nur `bendito-envoy`. Danach lässt der Browser den Aufruf durch und bekommt ohne Anmeldung die erwartete Ablehnung. Auth, Datenbank und die übrigen Bendito-Container liefen weiter. Norbert hat danach bestätigt: der Orga-Login geht.

**Was Norbert jetzt tut:** Ein neues privates Fenster auf [helfer.benditotango.de](https://helfer.benditotango.de/) öffnen und über Orga-Login anmelden. Ein schon offenes Fenster kann die alte Sperre noch bis zu zehn Minuten behalten.

## Mailentwurf für den Login-Link (24.10.2026, 5.0.5)

Die Orga erzeugt den persönlichen Link wie bisher. Daneben öffnet „Mail vorbereiten“ das eigene Mailprogramm. Betreff und Text sind gefüllt, die Adresse nicht, weil die App keine Mailadresse des Helfers speichert. Die App verschickt nichts. Ein neuer Link macht den alten sofort ungültig, auch den in einer schon offenen Mail.

Live: [Helferplan](https://helfer.benditotango.de/) liefert `config.js?v=5.0.5` mit Version 5.0.5. `app.js?v=5.0.5` enthält „Mail vorbereiten“. Beim Abruf kam die neue Datei mit `x-cache: MISS`. Commit `355dc2e` auf `main`. Geprüft: `node --check app.js`. Keine Datenbankänderung. `offline-store.js`, `print.css`, `print.js` und `sw.js` gehören nicht dazu.

**Was Norbert jetzt tut:** Den [Helferplan](https://helfer.benditotango.de/) einmal neu laden. Beim neuen Login-Link steht „Mail vorbereiten“.

## Neue Fassung kommt von allein (24.10.2026, 5.0.4)

Eine offene Seite holt `config.js` ohne Zwischenspeicher: beim Start, alle zwei Minuten und wenn das Fenster wieder nach vorn kommt. Gleiche Fassung bleibt. Eine neuere lädt über eine frische Adresse, weil GitHub Pages die Dateien etwa zehn Minuten hält. Danach verschwindet der Zusatz in der Adresse, der Anker `#k=` bleibt. Wer gerade tippt, sieht „Neue Fassung da.“ und „Neu laden“. Eine schon offene Fassung 5.0.3 merkt das erst nach einem normalen Laden dieser Ausgabe.

Die Inhalts-Sicherheitsregel erlaubt den Abruf der eigenen Datei (`connect-src 'self'`).

Geprüft: `node --check app.js`. Live: [Helferplan](https://helfer.benditotango.de/) liefert `config.js?v=5.0.4` mit Version 5.0.4, `app.js?v=5.0.4` enthält die Prüfung, die Startseite nennt `connect-src 'self'`. Beim zweiten Abruf kam die neue Datei mit `x-cache: MISS`. Commit `797db3c` auf `main`. `offline-store.js`, `print.css`, `print.js` und `sw.js` gehören nicht zu dieser Ausgabe.

**Was Norbert jetzt tut:** Den [Helferplan](https://helfer.benditotango.de/) einmal neu laden, falls er schon offen ist.

## Kuchen nur fürs Team (24.10.2026, 5.0.3)

Die Orga hat im [Helferplan](https://helfer.benditotango.de/) den Reiter Kuchen. Dort stehen nur die Meldungen, die Gäste nicht in der Liste sehen. Das Passwort ist ein eigener Hash in `kb_config.team_pass_hash` auf db.benditotango.de, nicht das Marathon-Passwort und nicht das Orga-Passwort. Der Hash steht nicht in Git.

Der Browser speichert das Passwort unter `kb-team-pass` in localStorage. Ein Cookie gibt es dafür nicht, damit GitHub Pages es nicht bei jedem Seitenaufruf sieht. Der Knopf „Passwort auf diesem Gerät vergessen“ löscht es. Helfer ohne Orga-Login sehen den Reiter nicht. Die Datenbank prüft das Passwort bei jedem Laden. Falsch, zu viele Versuche und geschlossen kommen als Text.

Geprüft: `node --check app.js`. Der Reiter selbst ist nicht mit dem Orga-Passwort angeklickt. `kb_team` mit dem gesetzten Passwort liefert live eine leere Liste, ein falsches Passwort wird abgewiesen. Die Herkunft helfer.benditotango.de ist für den Aufruf erlaubt.

**Was Norbert jetzt tut:** Als Orga den Reiter Kuchen öffnen und das Team-Passwort einmal eingeben.
