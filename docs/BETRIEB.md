# Betrieb: Bendito Helferplan 5.0.0

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
| Link wurde weitergegeben oder Telefon verloren | „Login-Link erneuern“. Alle Geräte mit dem alten Link sind sofort draußen. |
| „Keine Verbindung“ | Netz prüfen, „Erneut versuchen“. Bleibt es rot: Ausdruck verwenden. |
| „Keine Verbindung“ bei allen, obwohl das Netz geht | Das kostenlose Supabase-Projekt wurde pausiert, siehe unten. |

## Damit die Datenbank nicht einschläft

Ein kostenloses Supabase-Projekt wird nach etwa einer Woche ohne Zugriffe pausiert. Dann zeigt die App bei allen „Keine Verbindung“.

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

Pro Helfer: Anzeigename, Farbe, bevorzugter Kontaktweg ohne Nummer, Aufbau-Team ja oder nein, die zugewiesenen Schichten und Tauschvorgänge samt Notiz. Der Login-Link liegt nur als Prüfsumme in der Datenbank. Ein Protokoll hält fest, wann welche Aktion lief, ohne Namen. Die Daten liegen bei Supabase; die Region steht im Dashboard des Projekts.

Helfer finden eine Kurzfassung in der App unten unter „Datenschutz“. Der Text dort ist ein Entwurf aus der Technik. Ob er rechtlich genügt, prüft Norbert.

## Testlauf

Vor dem Verteilen der Links läuft einmal der komplette Testlauf mit den drei Testhelfern (siehe README). Er schaltet die Tauschsperre um und entfernt am Ende die Testdaten. Deshalb bricht er sofort ab, sobald es einen Helfer gibt, der kein Testhelfer ist.
