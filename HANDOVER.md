# HANDOVER – Bendito Helferplan

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
