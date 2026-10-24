# HANDOVER – Bendito Helferplan

## Kuchen nur fürs Team (24.10.2026, 5.0.3)

Die Orga hat im [Helferplan](https://helfer.benditotango.de/) den Reiter Kuchen. Dort stehen nur die Meldungen, die Gäste nicht in der Liste sehen. Das Passwort ist ein eigener Hash in `kb_config.team_pass_hash` auf db.benditotango.de, nicht das Marathon-Passwort und nicht das Orga-Passwort. Der Hash steht nicht in Git.

Der Browser speichert das Passwort unter `kb-team-pass` in localStorage. Ein Cookie gibt es dafür nicht, damit GitHub Pages es nicht bei jedem Seitenaufruf sieht. Der Knopf „Passwort auf diesem Gerät vergessen“ löscht es. Helfer ohne Orga-Login sehen den Reiter nicht. Die Datenbank prüft das Passwort bei jedem Laden. Falsch, zu viele Versuche und geschlossen kommen als Text.

Geprüft: `node --check app.js`. Der Reiter selbst ist nicht mit dem Orga-Passwort angeklickt. `kb_team` mit dem gesetzten Passwort liefert live eine leere Liste, ein falsches Passwort wird abgewiesen. Die Herkunft helfer.benditotango.de ist für den Aufruf erlaubt.

**Was Norbert jetzt tut:** Als Orga den Reiter Kuchen öffnen und das Team-Passwort einmal eingeben.
