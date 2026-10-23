# Betrieb: Bendito Helferplan 5.0.2

Für die Orga. Bendito Tango Marathon, Fr 30.10. bis So 01.11.2026.

## Anmelden

Die Orga meldet sich auf der Startseite über „Orga-Login“ mit E-Mail und Passwort an. Das Passwort lässt sich unter „Einstellungen“ ganz unten ändern. Helfer haben kein Passwort, sie öffnen ihren persönlichen Link.

## Helfer anlegen und Links verteilen

1. „Einstellungen“ öffnen. Einzelne Person unter „Helfer anlegen“, viele auf einmal unter „Mehrere Namen einfügen“ (ein Name pro Zeile).
2. Eingetragen wird nur der Anzeigename, dazu Farbe, bevorzugter Kontaktweg und Aufbau-Team. Keine Telefonnummer, keine E-Mail-Adresse. Die App lehnt Namen mit @ und mit mehr als vier Ziffern ab. Das fängt Versehen ab, ersetzt aber nicht das Hinschauen.
3. In der Liste „Alle Helfer“ bei der Person auf „Login-Link erzeugen“ tippen, dann „Link kopieren“ und der Person direkt schicken, zum Beispiel per WhatsApp. **Der Link wird nur dieses eine Mal angezeigt.**
4. Wer den Link hat, ist diese Person. Deshalb nie in eine Gruppe stellen.

Der Haken „Testhelfer“ gilt nur für die nächste Anlage und springt danach zurück. Echte Helfer bekommen ihn nie: „Testdaten entfernen“ löscht alles, was so markiert ist. Der Dialog nennt vorher die Namen.

## Schichten zuweisen

Auf dem Board oben eine Person antippen, dann bei der Schicht auf „+“. Das „×“ am Namen entfernt die Person wieder. Überschneidet sich eine Schicht mit einer anderen derselben Person, fragt die App nach. Hinweis zum Raster: Die Bar-Schichten Freitag 19:00 und 20:00 überschneiden sich rechnerisch um 30 Minuten, weil jede 1,5 Stunden dauert.

**Die App meldet Helfern nicht, wenn die Orga etwas ändert.** Sobald die Links verteilt sind, gilt: Wer jemanden aus einer Schicht nimmt oder neu einteilt, sagt der Person kurz Bescheid. Die App erinnert nach dem Entfernen daran. Hängt an der Zuweisung eine offene Tauschanfrage, fragt sie vorher nach.

Schichten nach Mitternacht stehen beim Vorabend und tragen den Vermerk „Nacht auf Sa“ oder „Nacht auf So“.

## Tausch

Helfer fragen einen Tausch aus ihrer Schicht heraus an. Ist die Zielschicht besetzt, entscheidet die dort eingeteilte Person. Ist dort ein Platz frei, gibt die Orga den Wechsel unter „Tausch“ frei. Angenommen wird ein Tausch ganz oder gar nicht.

Die App schickt keine Nachricht aufs Telefon. Eine Anfrage steht bei der anderen Person unter „Mein Tausch“, sobald sie die App öffnet. Deshalb sagt, wer anfragt, der anderen Person kurz Bescheid. Die App erinnert daran. Je Person sind höchstens fünf offene Anfragen gleichzeitig möglich.

**Sperre:** Der Tausch sperrt sich automatisch am **Do 29.10.2026 um 20:00 Uhr**. Schalter und Zeitpunkt stehen unter „Einstellungen“ → „Schichttausch“. Die Orga kann danach weiter zuweisen. Anfragen, die dann noch offen sind, bleiben stehen und lassen sich nicht mehr annehmen.

## Notfallplan auf Papier

Nach der Sperre, am Donnerstagabend oder Freitagmorgen: „Einstellungen“ → „Druckansicht“ → „Drucken“. **Der Ausdruck gilt, wenn am Event kein Netz da ist.**

Was die App ohne Netz kann und was nicht:

| Lage | Was man sieht |
|---|---|
| App war schon offen, dann fällt das Netz aus | Der zuletzt geladene Plan bleibt stehen, mit rotem Hinweis und Uhrzeit. Änderungen sind gesperrt. |
| App wird ohne Netz neu geöffnet oder neu geladen | Kein Plan. Nur „Keine Verbindung“. |

Darauf ist am Event also kein Verlass. Helfer machen deshalb vorher ein Bildschirmfoto von „Mein Plan“ (steht in der Ankündigung und in der App).

## Wenn ein Link nicht geht

| Meldung oder Lage | Was tun |
|---|---|
| „Dieser Link ist nicht gültig“ | Link wurde erneuert, gesperrt oder unvollständig kopiert. Neuen Link erzeugen und schicken. Der alte ist damit tot. |
| „Zu viele Versuche“ | Kommt nur bei falschen oder alten Links, nach zehn Fehlversuchen in zehn Minuten vom selben Anschluss. Ein gültiger Link geht immer, auch im selben WLAN. Also: neuen Link erzeugen und schicken. |
| Link wurde weitergegeben oder Telefon verloren | „Login-Link erneuern“. Der alte Link ist sofort tot. Ein Gerät, auf dem die App noch offen ist, fliegt beim nächsten Abruf raus, spätestens nach 30 Sekunden. |
| „Keine Verbindung“ | Netz prüfen, „Erneut versuchen“. Bleibt es rot: Ausdruck verwenden. |
| „Keine Verbindung“ bei allen, obwohl das Netz geht | Das kostenlose Supabase-Projekt wurde pausiert, siehe unten. |

## Datenbank auf netcup

Die App spricht seit 5.0.1 die eigene Datenbank unter [db.benditotango.de](https://db.benditotango.de/auth/v1/health) an. Erreichbar sind nur Anmeldung, Daten-API und die Login-Funktion. Studio und die Datenbank selbst sind von außen nicht erreichbar.

Auf dem Server laufen sieben Dienste im Compose-Projekt `bendito`: Datenbank, Anmeldung, Daten-API, Meta, Studio, Gateway und die Login-Funktion. Das Gateway hört nur auf `127.0.0.1:8100`. Caddy reicht die drei Pfade weiter. Realtime, Storage und der Pooler sind nicht gestartet.

Sicherung: alle sechs Stunden ein Dump auf dem Server, Aufbewahrung 28 Dateien. Eine Kopie liegt unter `~/Backups/bendito-db/` auf Norberts Mac (täglich 08:00 und beim Anmelden, 30 Dateien). Die Wiederherstellungsprobe legt eine Wegwerf-Datenbank an, vergleicht die Zeilenzahlen von Schichten und Helfern und löscht sie wieder.

Rückweg auf die Cloud, falls der eigene Server ausfällt: im Repo `node tools/set-backend.mjs https://pumbaojykazurlncntae.supabase.co sb_publishable_Rfc4THqxTClo3UMIk5c8Eg_FkDKpjh9`, Version hoch, Commit, Push. Vorher einen Dump ziehen. Was nur auf netcup steht, ist in der Cloud nicht vorhanden. Die Cloud nicht löschen und nicht pausieren. Bis zum 15.11. einmal pro Woche das [Dashboard](https://supabase.com/dashboard/project/pumbaojykazurlncntae) öffnen.

Das Orga-Konto legt Norbert selbst an: `tools/orga-konto-netcup.sh` im Terminal. Das Skript fragt E-Mail und Passwort ab und gibt beides nicht aus.

## Damit die Datenbank nicht einschläft

Dieser Abschnitt gilt nur, wenn die App wieder auf dem kostenlosen Supabase-Projekt läuft. Ein kostenloses Supabase-Projekt wird nach etwa einer Woche ohne Zugriffe pausiert. Dann zeigt die App bei allen „Keine Verbindung“.

- **Als Zugriff zählt nur eine Anmeldung oder ein geöffneter Plan.** Die Startseite allein aufzurufen genügt nicht, sie fragt die Datenbank nicht an.
- In den Wochen vor dem Event meldet sich deshalb jemand aus der Orga **mindestens zweimal pro Woche** an. Sobald Helfer ihre Links nutzen, erledigt sich das von selbst.
- Wieder starten kann nur, wer Zugang zum [Supabase-Dashboard](https://supabase.com/dashboard/projects) hat: dort das Projekt öffnen und wieder starten (die Schaltfläche heißt „Restore project“ oder „Resume project“). Wer das außer Norbert ist, steht in der Übergabe.
- Am Donnerstag vor dem Event einmal prüfen, ob die App lädt.

## Nach dem Event

Die App zeigt der Orga nach dem Eventende einen gelben Hinweis, bis beides erledigt ist.

| Wann | Was | Wo |
|---|---|---|
| Mo 02.11.2026 | Alle Login-Links sperren | „Einstellungen“ → „Alle Login-Links sperren“ |
| bis So 15.11.2026 | Plan als Datei sichern, dann Helferdaten löschen | „Einstellungen“ → „Helferdaten löschen“. Der Dialog verlangt zuerst die Sicherung. |

Die Sicherungsdatei enthält Namen. Sie bleibt auf dem eigenen Gerät, gehört in keinen geteilten Ordner und in kein Repository und wird gelöscht, sobald sie nicht mehr gebraucht wird. Zurückspielen lässt sie sich nicht: Sie ist ein Nachweis, kein Backup. Wie lange sie aufbewahrt wird, legt die Orga fest; die Ankündigung an die Helfer nennt die Kopie. Gelöscht werden alle Helfer mit Zuweisungen, Tauschvorgängen, Hinweisen, Login-Links, Anmeldekonten und Protokoll. Schichtraster, Einstellungen und Orga-Konten bleiben für das nächste Jahr. Meldet die App danach, dass sich Anmeldekonten nicht entfernen ließen, stehen sie im Supabase-Dashboard unter „Authentication“ und werden dort von Hand gelöscht (Adressen der Form `hp-…@helfer.bendito.invalid`).

Gelöscht wird von Hand. Eine automatische Löschung gibt es nicht, weil vorher gesichert werden soll.

## Was gespeichert wird

Pro Helfer: Anzeigename, Farbe, bevorzugter Kontaktweg ohne Nummer, Aufbau-Team ja oder nein, die zugewiesenen Schichten und Tauschvorgänge samt Notiz. Der Login-Link liegt nur als Prüfsumme in der Datenbank. Ein Protokoll hält fest, wann welche Aktion lief, ohne Namen. Die Daten liegen auf dem eigenen Server bei netcup in Nürnberg. Der Rückweg zur Supabase-Cloud in Frankfurt steht im Abschnitt „Datenbank auf netcup“.

Die Mithilfe-Abfrage (`mithilfe.html`) speichert dazu Name, E-Mail, optional Telefon und vier Antworten: Donnerstag 29.10. schon da, Montag 2.11. noch im Kloster, Helfer-Pre-Milonga, Abschlussessen am Sonntagabend. Dieselbe E-Mail überschreibt die vorige Antwort. Sehen kann das nur die Orga, im Reiter „Mithilfe“ und in der Sicherungsdatei. Gelöscht wird es mit „Helferdaten löschen“, zusammen mit dem übrigen Plan, bis zum 15.11.2026. Die Sicherung enthält dann auch diese Adressen und bleibt auf dem eigenen Gerät.

Helfer finden eine Kurzfassung in der App unten unter „Datenschutz“. Der Text dort ist ein Entwurf aus der Technik. Ob er rechtlich genügt, prüft Norbert.

## Testlauf

Vor dem Verteilen der Links läuft einmal der Durchgang von Hand auf der veröffentlichten Seite mit den drei Testhelfern. Die Schritte stehen in `docs/TESTLAUF-5.0.0.md`. Er endet mit „Testdaten entfernen“ und ist die Freigabe.

Den automatischen Browser-Testlauf gegen die Live-Seite (siehe README) startet nur die Orga selbst mit ihrem eigenen Passwort. Er braucht vorher wieder die drei Testhelfer (`supabase/tests/seed_test_helpers.sql`), schaltet die Tauschsperre um, ändert kurz Sperrzeitpunkt, Eventende und Löschtermin und bricht sofort ab, sobald es einen Helfer gibt, der kein Testhelfer ist.

Hat eine andere Anwendung im selben Supabase-Projekt Rechte verändert: `supabase/migrations/0006_hp_grants.sql` noch einmal ausführen und mit `supabase/tests/check_rechte.sql` prüfen. Beides geht im laufenden Betrieb.
