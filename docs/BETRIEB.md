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

## Mail-Benachrichtigung (Vorbereitung 5.1.0, 25.10.2026)

**Stand: Datenbank installiert und geprüft, Versand noch aus.** Das Apps-Script-Projekt „Bendito Helferplan Mail“ ist im Bendito-Konto angelegt; Code und öffentlicher API-Schlüssel sind gespeichert. Norberts Einrichtungsaufruf/Google-Freigabe und ein tatsächlicher zeitgesteuerter Testversand sind abgeschlossen. Nach einem uneindeutigen ersten Test über die ins Senderkonto zurückleitende Teamadresse wurde eine zweite Testmail an ein separat bestätigtes eigenes Postfach geschickt. Der tatsächliche Eingang ist per INBOX-Label und Received-Header nach rund 66 Sekunden nachgewiesen; O6 ist bestanden. Oberflächenprüfung und Freigabe für echte Helfer stehen noch aus. Danach Testtrigger gelöscht, HP_MAIL_ENABLED=false, Testhelfer entfernt. Siehe docs/TESTLAUF-MAIL-BACKEND-2026-10-25.md. Die bisherigen Hinweise „keine Mail“ gelten bis zur vollständigen Freigabe weiter. Keine echten Helferadressen importieren und keine Einladungen um Mailzusagen ergänzen, bevor der Sonnet-Testlauf bestanden ist.

### Einrichten im Bendito-Konto

1. In [Google Apps Script](https://script.google.com/home) mit **benditotango@gmail.com** ein neues eigenständiges Projekt „Bendito Helferplan Mail“ anlegen. Inhalt von `tools/mail-poller.gs` als Code einsetzen. Kein Web-App-Deployment und keine öffentliche Freigabe anlegen.
2. Norbert führt dort einmal `prepareMailSetup()` aus. Die Funktion erzeugt das Geheimnis aus zwei UUIDs und speichert es als `HP_MAIL_SECRET` in den **Script Properties**. Sie setzt `HP_MAIL_ENABLED=false`. Im Protokoll erscheint ausschließlich der SHA-256-Hash. Das Geheimnis bleibt im Projekt; niemals in Code, Chat oder Repository kopieren.
3. Unter Projekteinstellungen → Script Properties `HP_API_KEY` auf den **öffentlichen** Schlüssel `supabaseAnonKey` aus `config.js` setzen. `HP_MAIL_SECRET` dort nicht überschreiben. Das Projekt braucht ausgehende HTTP-Aufrufe, Gmail-Versand, die Kontokennung und zum Anlegen des Triggers die Script-Berechtigung. Norbert bestätigt die Google-Freigabe selbst im Bendito-Konto.
4. Den ausgegebenen Hash mit einer Orga-Sitzung über `hp_admin_set_mail_secret_hash(p_hash text)` setzen, Rückgabe `{"ok":true}`. Der allgemeine Einstellungs-RPC nimmt diesen Schlüssel absichtlich nicht an. Bei administrativer Installation durch den Serverbetreiber kann derselbe Aufruf mit einem gültigen Orga-JWT-Claim in einer Datenbanktransaktion laufen. Kein Geheimnis im SQL-Text verwenden, nur den Hash.
5. Für den Empfangstest zwei ausdrücklich als Testhelfer markierte Helfer anlegen; ausschließlich die konkret von Norbert bestätigte eigene Empfängeradresse mit `hp_admin_set_helper_mail` hinterlegen. Eigene Testschichten benutzen, keine echten Zuweisungen verändern. `HP_MAIL_ENABLED=true` setzen, `pollMail()` einmal manuell ausführen und anschließend `installMailTrigger()` ausführen: ein Zeit-Trigger **jede Minute**. Der Code prüft das ausführende Konto und verweigert das persönliche Gmail-Konto.
6. Tauschanfrage zwischen den Testhelfern auslösen. Mail-Eingangszeit prüfen und festhalten: spätestens drei Minuten nach Anfrage. Anschließend Annahme, Ablehnung, Orga-Zuweisung und Abschalten prüfen (Sonnet S7). Mit **„Testdaten entfernen“** nur die Testhelfer löschen; ihre privaten Adressen und Outbox-Zeilen verschwinden kaskadierend. Solange der Test nicht vollständig grün ist, Trigger wieder löschen und `HP_MAIL_ENABLED=false` setzen.
7. Erst nach Sonnet-Freigabe die echten Adressen importieren. Der Orga-Zugang und die bestehenden echten Login-Links bleiben unverändert.

### Abholen, Bündeln und Fehler

Neue Ereignisse werden nur bei aktiver Person mit hinterlegter, eingeschalteter Mailadresse in die private Warteschlange aufgenommen. Es gibt keinen Nachversand alter Hinweise. Eine Gruppe reift eine Minute; Ereignisse derselben Person im Fenster von zwei Minuten werden zu einer Mail gebündelt. Mit dem Minutentrigger ist der normale Abruf nach etwa ein bis zwei Minuten fällig; Google kann Zeit-Trigger verzögert ausführen, daher ist das keine harte Zustellgarantie.

Der Abruf liefert `[{id, ids, to, subject, text}]`. `id` ist die erste technische Ereignis-ID, `ids` enthält **alle** IDs der gebündelten Mail. Quittieren immer mit allen `ids`. Maximal 20 Ereignisse pro Poller-Abruf, Datenbankgrenze 100. Der Poller lässt zehn tägliche Empfängerplätze Reserve. Bei bekanntem Versandfehler folgen maximal drei Versuche; danach bleibt der Status `failed`. Keine Fehlerantwort von Gmail oder Datenbank mit Empfänger oder Mailtext protokollieren.

Ein erfolgreicher Versand wird vor dem nächsten Versand quittiert. Bei fehlgeschlagener Quittung liegen nur IDs und Ergebnis in `HP_MAIL_ACK`; der nächste Lauf quittiert erneut, ohne die Mail erneut zu senden. `HP_MAIL_UNSENT` hält ausschließlich IDs noch nicht versuchter Restgruppen und gibt sie nach einem Abbruch wieder frei. Steht `HP_MAIL_ACK.phase` auf `sending`, ist der Ausgang unklar: Trigger stoppen, **Gesendet** im Bendito-Gmail prüfen, die betreffenden IDs gezielt quittieren und erst dann die technische Property entfernen. Nicht einfach die Warteschlange zurücksetzen. Nach zehn Minuten werden unquittierte `sending`-Zeilen endgültig `failed` (tries=3), damit sie nicht blind doppelt verschickt werden. Eine verspätete Quittung ändert diese terminalen Zeilen nicht mehr. Gmail und Datenbank bieten zusammen keine atomare Genau-einmal-Zustellung; ein Fehler während der Gmail-Annahme kann eine Doppelmail verursachen.

Gesendete Einträge werden beim nächsten gültigen Abruf nach sieben Tagen entfernt. Ohne laufenden Poller findet diese Bereinigung erst beim nächsten Abruf statt. Abmelden, Adresse löschen oder Deaktivieren unterdrückt neue Einträge und entfernt wartende Einträge; eine bereits abgeholte Mail kann noch unterwegs sein. Reaktivieren oder Ändern der Adresse hebt ein bestehendes Opt-out nicht auf.

### Adressen importieren

`tools/helfer-mails-import.mjs` liest eine CSV **außerhalb des Repos**. Es unterstützt Komma, Semikolon, Tab, BOM und mehrzeilige Felder. Es ordnet genau acht aktive echte Helfer vor dem ersten Schreibzugriff eindeutig zu; Ein einzelner Vorname oder ein Vorname mit Nachnameninitiale wird nur bei genau einem passenden vollständigen Namen zugeordnet. Mehrere Treffer führen zum Abbruch. Bei abweichenden Überschriften `--name-column` und `--email-column` mit den tatsächlichen CSV-Spaltennamen angeben. Nicht raten und bei Mehrdeutigkeit keine Teilzuordnung verwenden.

Zuerst lokal `node tools/helfer-mails-import.mjs /privater/pfad.csv --dry-run` aufrufen. Für das tatsächliche Speichern `--dry-run` weglassen. Das Skript fragt Orga-E-Mail und Passwort verdeckt ab; alternativ ist eine vorhandene Orga-Sitzung als Umgebungsvariable `HP_ADMIN_TOKEN` möglich. Keine Zugangsdaten als Befehlsargument verwenden. Der Import gibt nur Zuordnungszahlen aus. Nach erfolgreicher Vorprüfung laufen die acht Schreibzugriffe einzeln; bei einer Verbindungsunterbrechung kann ein Teil gespeichert sein. Ein erneuter Lauf mit unveränderter CSV ist möglich und lässt vorhandene Opt-outs sowie bei unveränderter Adresse die Warteschlange bestehen. Die CSV nicht kopieren oder committen.

### Abschalten und Rückweg

**Zeit-Trigger `pollMail` löschen = sofort keine weiteren Poller-Läufe.** Ein bereits laufender Versand kann noch enden. Zusätzlich `HP_MAIL_ENABLED=false` setzen. In einer Notlage kann der Serverbetreiber die Ausführung von `hp_mail_claim(text,integer)` für `anon` entziehen. Vollständig den Trigger `hp_mail_enqueue` auf `hp_notifications` entfernen. Die Plan- und Tauschfunktionen bleiben nutzbar. Nach einem Geheimnisleck zuerst den Trigger stoppen und den Hash ersetzen; danach ein neues Geheimnis in den Script Properties einrichten und testen.

Wichtig: Der Browser erhält über die Mailverwaltungs-RPCs nur `has_mail`/`enabled`, nie die Mailadresse. **Der berechtigte Versandabruf muss jedoch die Adresse `to` erhalten.** Wer das Poller-Geheimnis kennt, kann deshalb Empfänger und Texte wartender Mails lesen und deren Zustellung stören. Das Geheimnis ist entsprechend vertraulich. Es erlaubt keine Änderung der hinterlegten Adressen und keinen Versand an frei gewählte Empfänger.

### Nachweise vom 25.10.2026

Vor Live-Migration: `bendito-backup` → `backup ok 20261025-1313`. Migration `0009_hp_mail.sql` auf PostgreSQL 17.6, davor 0001–0008 in separater Wegwerf-Datenbank geprüft, idempotent erneut ausgeführt. Zehn von zehn Rechteprüfungen grün, sieben Mail-Testgruppen grün, vorhandene Rechtefälle R1–R21 grün in der Wegwerf-Datenbank. Die elf lokalen Tests für Poller/CSV/Teststeuerung und 17 statische Prüfungen sind grün. Live-Mailtests rollen sich zurück und löschen keine echten Helfer; der vollständige Purge-Test lief ausschließlich in der Wegwerf-Datenbank. Gateway-Aufrufe ohne Origin: Claim und Done jeweils HTTP 200, falsches Geheimnis jeweils `[]`. Keine Gateway-Datei und kein anderer Container geändert. Zeitgesteuerter tatsächlicher Versand und Empfang im separaten eigenen Postfach nach rund 66 Sekunden nachgewiesen; **O6 bestanden**. Beide Testläufe danach vollständig bereinigt und Versand wieder aus.

Ein bestätigter eigener Empfangstest kann mit `startMailTest()` den Minutentrigger vorübergehend starten; unmittelbar danach beendet `stopMailTest()` den Versand und entfernt ausschließlich pollMail-Trigger. Nur verwenden, wenn ausschließlich ausdrücklich freigegebene Testempfänger in der privaten Mailtabelle stehen. Die normale Helferbenachrichtigung bleibt bis zur fachlichen Freigabe aus.
