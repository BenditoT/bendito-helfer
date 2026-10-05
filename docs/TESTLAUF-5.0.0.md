# Testprotokoll Helferplan 5.0.0

Läufe vom 04. und 05.10.2026 (lokal) und aus der Nacht zum 05.10.2026 (echtes Projekt). Alle Namen in diesem Protokoll und auf den Bildern sind erfundene Testhelfer.

## Wogegen getestet wurde

**Lokal, gegen einen Nachbau von Supabase:** Postgres 16 mit denselben Rollen und Standardrechten wie ein Supabase-Projekt, die echte Login-Funktion `hp-login` unter Deno, die App-Dateien unverändert; nur `config.js` und das Verbindungsziel der Content-Security-Policy zeigen auf den Nachbau.

**Im echten Supabase-Projekt und auf der veröffentlichten Seite** (Nacht zum 05.10.2026): die Datenbanktests im SQL-Editor, die Login-Funktion über HTTP und der Aufruf der Seite. Ergebnis im Abschnitt „Echtes Projekt“.

**Noch nicht gelaufen:** der Durchgang mit Anmeldung auf der veröffentlichten Seite. Er braucht ein Orga-Konto und ist Voraussetzung, bevor Links an Helfer gehen. Die Schritte stehen unten unter „Durchgang auf der veröffentlichten Seite“.

## Ergebnis

| Gruppe | Aufruf | Ergebnis |
|---|---|---|
| Statische Prüfungen | `node --test tests/static.test.mjs` | 16 von 16 |
| Datenbank: Tausch T1–T11, Rechte R1–R20, gleichzeitige Annahme, keine Datenreste, Abbruch bei vorhandenen Helfern, Rechteprüfung mit Gegenproben | `node --test tests/sql.test.mjs` | 40 von 40 |
| HTTP: Login-Funktion, Fehlversuche, Herkünfte, abgelaufene Token, leerer Wert | `node --test tests/http.test.mjs` | 6 von 6 |
| Browser-Testlauf mit drei Profilen | `node tests/e2e/testlauf.cjs` | 27 von 27 |
| Gegenproben: absichtlich eingebaute Fehler in der Datenbank | siehe Review | 27 von 27 erkannt |

Der Browser-Testlauf lief dreimal hintereinander vollständig grün. Die 30 Sekunden in den Schritten sind die Anforderung aus dem Sprint, kein Puffer.

## Browser-Testlauf

Drei getrennte Browserprofile: Orga (1280 × 900), Test Anna (Telefon, 390 × 844, Touch), Test Ben (1024 × 768).

| Schritt | Was geprüft wird | Ergebnis | Messwert |
|---|---|---|---|
| 0 | Orga meldet sich an; Version 5.0.0 im Fuß | grün | 3 Helfer, alle Testhelfer |
| 1 | Orga weist Anna und Ben je zwei Schichten zu | grün |  |
| 1b | Überschneidung wird abgefragt, nicht still zugewiesen | grün |  |
| 1c | Orga entfernt eine Zuweisung: Rückmeldung mit Erinnerung, Bescheid zu sagen | grün |  |
| 1d | Haken „Testhelfer“ springt nach dem Anlegen zurück | grün |  |
| 1e | Fehler im Dialog: Meldung steht unter dem Dialog und verdeckt nichts, Fokus bleibt im Dialog | grün |  |
| 1f | Ein überholter Abruf überschreibt den Stand nach einer eigenen Änderung nicht | grün |  |
| 2 | Anna und Ben öffnen ihre Links und sehen ihre Schichten | grün |  |
| 2b | Neue Zuweisung erscheint bei Anna ohne Neuladen | grün | nach 19.3 s |
| 2c | Nach Neuladen bleibt Anna angemeldet | grün |  |
| 2d | Helfer ruft Orga-Funktion direkt auf: Server lehnt ab | grün | HTTP 403, 403, 403 |
| 3 | Anna fragt Tausch mit Bens Schicht an; Ben nimmt an | grün | Anfrage bei Ben sichtbar, geprüft 19.8 s nach dem Absenden |
| 4 | Beide Pläne und das Board zeigen den Tausch, auch nach Neuladen | grün |  |
| 5 | Falscher Link: verständliche Meldung, kein Zugang | grün |  |
| 6 | Orga erneuert Annas Link: alter Link tot, offene Sitzung endet, neuer Link geht | grün | offene Sitzung endete nach 19.2 s |
| 6b | Ohne Netz: roter Hinweis, Aktionen gesperrt; mit Netz wieder grün | grün | rot nach 0.3 s, grün nach 0.3 s |
| 6b2 | Server antwortet nicht (Browser meldet kein „offline“): trotzdem rot binnen 30 s | grün | rot nach 26.8 s, grün nach 12.1 s |
| 6c | Tausch nur mit der Tastatur: Ben fragt an, Anna nimmt an | grün |  |
| 6e | Zugriffstoken abgelaufen: App erneuert die Sitzung selbst, eine Änderung geht genau einmal durch | grün |  |
| 6f | Datenschutz-Hinweis und Nachtschicht-Vermerk auf dem Telefon | grün |  |
| 6d | Telefonbreite 390 px: kein waagerechtes Scrollen, Tippziele ab 44 px | grün |  |
| 7 | Tausch sperren: Anfrage nicht mehr möglich | grün | bei Ben nach 17.9 s |
| 7b | Sperrzeitpunkt setzen und wieder leeren (leerer Wert kommt beim Server an) | grün | vorher leer, wieder leer |
| 7c | Nach dem Event erinnert die App die Orga an Sperren und Löschen | grün |  |
| 8a | Druckansicht und Sicherung als Datei | grün | 69 Zeilen, Sicherung mit 5 Helfern |
| 8b | „Testdaten entfernen“: Plan ist leer, Testhelfer sind draußen | grün |  |
| 9 | Keine Skriptfehler, keine Anfragen an Dritte | grün | Herkünfte: http://127.0.0.1:4173 |

Änderungen erscheinen auf dem anderen Gerät innerhalb von 20 Sekunden, das ist der Abstand der Abrufe. Antwortet der Server gar nicht, kommt die Abbruchzeit von 8 Sekunden dazu: Der rote Hinweis steht dann nach spätestens 28 Sekunden.

## Bilder

| Bild | Zeigt |
|---|---|
| [Board der Orga](testlauf/02-orga-board-zugewiesen.png) | Zuweisungen nach Schritt 1 |
| [Fehler im Dialog](testlauf/04-orga-fehler-im-dialog.png) | Meldung unter dem Dialog bei 390 × 664 |
| [Mein Plan](testlauf/05-anna-mein-plan.png) | Annas Plan auf dem Telefon |
| [Meldung trotz Scrollen](testlauf/07-anna-meldung-trotz-scrollen.png) | Meldung am unteren Rand, Markierung der eigenen Anfrage |
| [Ohne Netz](testlauf/12-ben-offline.png) | Roter Hinweis oben und unten, Knöpfe gesperrt |
| [Board bei 390 px](testlauf/14-anna-board-390.png) | Telefonbreite ohne waagerechtes Scrollen |
| [Erinnerung](testlauf/16-orga-erinnerung.png) | Hinweis für die Orga nach dem Löschtermin |
| [Druckansicht](testlauf/17-orga-druckansicht.png) | Notfallplan auf Papier |

## Echtes Projekt

Projekt in Frankfurt, Postgres 17. Eingespielt wurden die Migrationen `0001` bis `0006` unverändert aus dem veröffentlichten Repository.

| Prüfung | Ergebnis |
|---|---|
| Abgleich mit der lokalen Testdatenbank (Tabellen, Spalten, Indizes, Regeln, Funktionen, Rechte, Schichtraster) | gleich |
| `supabase/tests/t_swaps.sql` im SQL-Editor, bei leerer Helfertabelle | 14 von 14 |
| `supabase/tests/t_rights.sql` im SQL-Editor, bei leerer Helfertabelle | 20 von 20 |
| Datenreste nach den Tests | keine |
| `supabase/tests/check_rechte.sql` im SQL-Editor, mit den drei Testhelfern in der Datenbank | 8 von 8 Zeilen in Ordnung |
| Login-Funktion: falscher Code, kaputter Rumpf | 401 `invalid` |
| Login-Funktion: falsche Methode | 405 |
| Login-Funktion: Vorabfrage von der Pages-Adresse und von einer fremden Herkunft | Pages-Adresse erlaubt, fremde Herkunft nicht zurückgespiegelt |
| Ohne Anmeldung: Funktionen und Tabellen | abgelehnt |
| Schema `hp_private` über die Daten-API | nicht angeboten |
| Elfter Fehlversuch in zehn Minuten, auch mit selbst gesetzter Absenderadresse | 429 |
| Security Advisor | 0 Fehler, 18 Warnungen (begründet im Review) |
| Veröffentlichte Seite | Version 5.0.0, keine Skriptfehler, falscher Link zeigt „Dieser Link ist nicht gültig“ |

Die beiden Testskripte liefen im Stand des veröffentlichten Commits `4d3159b`. Seitdem ist nur der Abbruch bei vorhandenen Helfern dazugekommen, die Fälle sind dieselben. Die Zeilen aus den Fehlversuchen wurden danach gelöscht. In der Datenbank stehen die drei Testhelfer ohne Link und ohne Schichten, kein Orga-Konto und kein Anmeldekonto.

## Durchgang auf der veröffentlichten Seite

**Offen.** Dieser Durchgang von Hand ist die Freigabe, bevor Links an Helfer gehen. Er dauert rund 15 Minuten und braucht einen Rechner, ein Telefon und den Blick ins Supabase-Dashboard.

Vorher im Dashboard: Selbstregistrierung ausschalten (nur die Neuanmeldung, der Login mit E-Mail bleibt an), Orga-Konto bestätigt anlegen und in `hp_admins` eintragen. Die Orga meldet sich selbst an; Passwörter gibt niemand weiter.

1. Über „Orga-Login“ anmelden. Im Fuß steht „Version 5.0.0“. Unter „Einstellungen“ zeigt „Alle Helfer (3)“ Test Anna, Test Ben und Test Cleo, jeweils mit „kein Login-Link“. Steht stattdessen „Dieses Konto hat keinen Zugriff auf den Helferplan.“, fehlt der Eintrag in `hp_admins`.
2. Auf dem Board Test Anna antippen, dann „+“ bei Fr 17:30 Bar A und bei Sa 10:00 Bar A. Test Ben ebenso bei Fr 19:00 Bar A und Sa 11:30 Bar A.
3. Unter „Einstellungen“ bei Test Anna „Login-Link erzeugen“, „Link kopieren“, ans eigene Telefon schicken und dort öffnen. „Mein Plan“ zeigt beide Schichten. Seite neu laden: Anna bleibt angemeldet. Den Link aufheben.
4. Denselben Link auf dem Telefon noch einmal antippen und zusätzlich in einem privaten Fenster am Rechner öffnen. Beide Male ist Anna angemeldet und sieht denselben Plan.
5. Als Orga Test Anna zusätzlich So 11:30 Bar A zuweisen. Das Telefon bleibt an, die Seite im Vordergrund: Die Schicht erscheint ohne Neuladen innerhalb von 30 Sekunden.
6. Bei Test Ben „Login-Link erzeugen“ und den Link im privaten Fenster öffnen (Ben ersetzt dort Anna). Auf dem Telefon unter „Mein Plan“ bei Fr 17:30 Bar auf „Tausch“, bei „Dafür möchtest du“ die Schicht „19:00 Bar · mit Test Ben“ wählen, „Anfrage senden“. Bei Ben erscheint binnen 30 Sekunden eine Zahl am Reiter „Mein Tausch“; dort „Annehmen“, dann „Tauschen“. Beide Pläne und das Board zeigen den Tausch, auch nach Neuladen.
7. Bei Test Anna „Login-Link erneuern“, dann „Neuen Link erzeugen“. Das Telefon zeigt nach spätestens 30 Sekunden „Dieser Zugang ist nicht mehr gültig.“, der alte Link zeigt „Dieser Link ist nicht gültig“, der neue meldet Anna wieder an. Im Dashboard unter „Authentication“ gibt es jetzt genau zwei Konten der Form `hp-…@helfer.bendito.invalid`.
8. Unter „Einstellungen“ → „Schichttausch“ das Feld „Automatisch gesperrt ab“ leeren, „Speichern“: Meldung „Sperrzeitpunkt entfernt.“, nach Neuladen ist das Feld leer. Dann 29.10.2026, 20:00 eintragen, „Speichern“: „Sperrzeitpunkt gespeichert.“
9. Unter „Testdaten und Löschung“ auf „Testdaten entfernen“; der Dialog nennt die drei Namen. Danach: „3 Testhelfer entfernt.“, oben „0/64 belegt“, Telefon und privates Fenster zeigen binnen 30 Sekunden die Anmeldeseite. Im Dashboard gibt es kein Konto `hp-…@helfer.bendito.invalid` mehr, und `select count(*) from public.hp_audit where action = 'auth_cleanup'` ergibt 0.

Für einen zweiten Durchgang vorher `supabase/tests/seed_test_helpers.sql` im SQL-Editor ausführen.

## Was der Lauf nicht zeigt

- Den Durchgang mit Anmeldung auf der veröffentlichten Seite, siehe oben.
- Das Neuladen ohne Netz bei Auslieferung über GitHub Pages.
- Ein echtes Telefon. Getestet ist die Telefonbreite in einem Desktop-Browser mit Touch.
- Einen Screenreader.
- Die übrigen offenen Punkte im echten Projekt (zweite App, Sitzung über eine Stunde, pausiertes Projekt, gleichzeitiges Öffnen auf zwei Geräten). Sie stehen in der Prüfliste im Review.
