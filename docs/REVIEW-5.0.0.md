# Experten-Review Helferplan 5.0.0

Stand 05.10.2026. Das Review selbst (beide Durchgänge) lief am 04.10.2026 am Stand im Repository, lokal gegen einen Nachbau von Supabase (Postgres 16, die echte Login-Funktion unter Deno). Seit der Nacht zum 05.10.2026 stehen das echte Supabase-Projekt und die veröffentlichte Seite. Was dort seitdem geprüft ist und was noch fehlt, steht am Ende unter „Prüfliste im echten Projekt“. **Noch nicht gelaufen** ist der Durchgang mit Anmeldung auf der veröffentlichten Seite; er braucht ein Orga-Konto.

## Ergebnis

- Drei Durchgänge durch je einen unabhängigen Prüfer, der den Code nicht geschrieben hat: erst das Review (15 Befunde), dann eine Nachprüfung der Korrekturen (12 Befunde), nach der Einrichtung eine Prüfung der Nachträge (14 Befunde).
- Kein kritischer Befund in allen drei Durchgängen. Zwei hohe Befunde im ersten Durchgang (R-01, R-02), beide behoben; die Nachprüfung fand keinen hohen mehr. Der dritte Durchgang fand zwei hohe in Testprotokoll und Tests (P-01, P-02), beide behoben.
- Alle mittleren Befunde sind behoben. Was bewusst offen bleibt, steht unten mit Begründung.

## Die Befunde, die diese Fassung schließen sollte

Quelle: `reviews/SECURITY-CODE-REVIEW.md` (S1–S10) und `reviews/DOMAIN-UX-REVIEW.md` (D1–D6) zum Stand 4.x.

| Nr. | Befund im alten Stand | Status | Wodurch |
|---|---|---|---|
| S1 | Kein echtes Login, Orga-Passwort im Quelltext | geschlossen | Orga mit E-Mail und Passwort, Helfer mit persönlichem Link. Rechte prüft die Datenbank bei jedem Aufruf. Tests R1–R8, R18. |
| S2 | Daten nur im einzelnen Browser | geschlossen | Ein Datenstand in der Datenbank, Abruf alle 20 Sekunden. Testlauf 2b, 3, 4. |
| S3 | Tausch konnte eine Schicht leer zurücklassen | geschlossen | Tausch in einer Datenbankfunktion, ganz oder gar nicht. Tests T1–T11, gleichzeitige Annahme T3c. |
| S4 | Öffentlich lesbare Tabelle als Datenquelle | geschlossen | Abruf ersatzlos entfernt. Statischer Test gegen fremde Adressen. |
| S5 | Abgleich ohne feste Kennungen und ohne Vorschau | geschlossen | Entfällt mit S4. Helfer legt die Orga in der App an. |
| S6 | Namen und Planstand unbefristet im Browser und im Export | geschlossen, mit Rest | Im Browser bleiben nur Anmeldung und zwei Anzeige-Vorlieben. Löschtermin 15.11.2026 mit Erinnerung in der App. Rest: siehe „Bewusst offen“ 1 und 2. |
| S7 | Kein Repository, kein Weg zurück | geschlossen | Git-Historie, Schranke vor der Veröffentlichung, `git revert` im README. Veröffentlicht seit dem 04.10.2026. |
| S8 | Fremdcode zur Laufzeit ohne Schutz | geschlossen | Bibliotheken liegen im Repository mit Prüfsummen. Content-Security-Policy erlaubt nur eigene Dateien und das eigene Supabase-Projekt. |
| S9 | Fehler blieben stumm | geschlossen | Statuszeile mit Uhrzeit, roter Hinweis ohne Netz, Fehlermeldungen bleiben stehen, bis sie geschlossen werden. Testlauf 6b, 6b2. |
| S10 | `dangerouslySetInnerHTML` | geschlossen | Nur zwei Stellen mit festen Texten aus dem Quelltext. Statischer Test. |
| D1 | Oberfläche versprach Zusammenarbeit ohne gemeinsamen Stand | geschlossen | Wie S2. |
| D2 | Tausch verletzte die fachliche Regel | geschlossen | Wie S3. |
| D3 | Kein einsatzfähiger veröffentlichter Stand | offen bis zum Durchgang mit Anmeldung | Seite und Datenbank stehen seit dem 05.10.2026, die Datenbanktests sind dort grün. Einsatzfähig ist die App erst, wenn die Selbstregistrierung im Projekt ausgeschaltet ist (Prüfliste 5) und danach der Durchgang mit Anmeldung auf der veröffentlichten Seite grün ist (Prüfliste 2, 7, 8 und 12). Stand in der Übergabe. |
| D4 | Aktualität für Helfer nicht erkennbar | geschlossen | „Stand hh:mm:ss“ dauerhaft sichtbar. Ohne Netz rot mit Uhrzeit des letzten Stands. |
| D5 | Kein Weg zur Wiederherstellung und Übergabe | geschlossen, mit Rest | Betriebsanleitung, Übergabe, Sicherung als Datei, Druckansicht. Rest: siehe „Bewusst offen“ 3. |
| D6 | Bedienung unter Stress und Barrierearmut | geschlossen, mit Rest | Tastaturbedienung, Fokusführung, Tippziele ab 44 px, Telefonbreite 390 px. Testlauf 6c, 6d, 1e. Rest: siehe „Bewusst offen“ 6. |

## Erster Durchgang: Review

| Nr. | Stufe | Befund | Behandlung |
|---|---|---|---|
| R-01 | hoch | Mit einem publishable-Schlüssel hätte das Gateway die Login-Funktion abgewiesen; Herkunft fest im Code | `supabase/config.toml` mit `verify_jwt = false`, weitere Herkünfte über `HP_ALLOWED_ORIGINS`. HTTP-Test. |
| R-02 | hoch | Im gemeinsam genutzten Projekt könnten pauschale Rechte einer anderen App interne Funktionen öffnen | Interne Funktionen im Schema `hp_private`, das Clients nicht nutzen dürfen und das die Daten-API nicht anbietet. Login-Funktionen prüfen selbst, dass nur die Edge Function sie aufruft. Test R18. Rest: „Bewusst offen“ 4. |
| R-03 | mittel | Sperrzeitpunkt ließ sich über die Daten-API nicht leeren | Leerer Wert wird richtig behandelt. Tests R19, HTTP-Test, Testlauf 7b. |
| R-04 | mittel | Meldungen unsichtbar, wenn weit gescrollt | Meldungen fest am unteren Rand. Testlauf 3, 6b. |
| R-05 | mittel | Kein Hinweis an Helfer, wenn die Orga Schichten ändert | Rückmeldung mit Erinnerung, Rückfrage bei offener Tauschanfrage, eigene Anfrage an der Schicht markiert. Testlauf 1c, 3. Rest: „Bewusst offen“ 5. |
| R-06 | mittel | Anleitung versprach den letzten Stand ohne Netz zu pauschal | Anleitung nennt beide Fälle. Tipp zum Bildschirmfoto in App und Ankündigung. |
| R-07 | mittel | Haken „Testhelfer“ blieb gesetzt | Springt nach dem Anlegen zurück, Dialog nennt die Namen. Testlauf 1d, 8b. |
| R-08 | mittel | Sicherungsdatei könnte ins Repository geraten | `.gitignore`, statischer Test und Schranke erkennen sie am Namen und am Inhalt. |
| R-09 | mittel | Laufender Abruf konnte den Stand nach einer eigenen Änderung überschreiben | Nach einer Änderung zählt nur ein Abruf, der danach gestartet ist. Testlauf 1f. |
| R-10 | mittel | Testlücken; Testlauf hätte bei echten Helfern laufen können | `tests/http.test.mjs`, Testlauf 6e, 7b; Abbruch vor der ersten Änderung, wenn es echte Helfer gibt. |
| R-11 | niedrig | Abgelaufenes Token meldete die Person ab | Einmal erneuern und wiederholen. Testlauf 6e. |
| R-12 | niedrig | Zehn Fehlversuche sperrten auch gültige Links im selben WLAN | Ein gültiger Link kommt immer durch, begrenzt werden Fehlversuche. Test R9. |
| R-13 | niedrig | Unklar, was die Datenbank wach hält | Eigener Abschnitt in der Betriebsanleitung. |
| R-14 | niedrig | Keine Erinnerung an die Löschung, übrig gebliebene Anmeldekonten, kein Datenschutzhinweis | Erinnerung für die Orga, Aufräumen der Konten, Kurzfassung „Datenschutz“ im Fuß. Tests R20, Testlauf 6f, 7c. |
| R-15 | niedrig | Nachtschichten missverständlich, Status bei gesperrtem Tausch, unbegrenzte Anfragen | Vermerk „Nacht auf Sa“, Status „Offen, Tausch gesperrt“, höchstens fünf offene Anfragen. Test T11, Testlauf 3, 6f. |

## Zweiter Durchgang: Nachprüfung der Korrekturen

Der Prüfer hat versucht, die neuen Teile zu brechen. Kein Durchbruch: Nach einer pauschalen Freigabe aller Funktionen bleibt alles zu; die Rollenprüfung lässt sich über die Daten-API nicht fälschen; „ein gültiger Link kommt immer durch“ öffnet bei 244 Bit Zufall kein praktisches Fenster.

| Nr. | Stufe | Befund | Behandlung |
|---|---|---|---|
| N-01 | mittel | Testschritt 1c prüfte die Karte, bevor der Plan neu geladen war | Der Schritt wartet auf den Zustand. Keine Wartezeit verlängert. |
| N-02 | mittel | Ankündigung versprach „nur dein Vorname“ und „wir löschen alles“ | Text nennt, was wirklich gespeichert und sichtbar ist, und die Kopie bei der Orga. |
| N-03 | mittel | Mehrere Korrekturen ohne Verhaltenstest | Testlauf 1d, 1e, 1f, 6f, 7c und Erweiterung von 3. |
| N-04 | niedrig | Datenschutz-Hinweis nannte Protokoll und Absender-Prüfsumme nicht | Ergänzt. |
| N-05 | niedrig | Test R20 hing an einem Vorgabewert, den es im echten Projekt nicht gibt | Nachbau entspricht dem echten Schema, Tests setzen das Datum selbst. Konten ohne Datum gelten als alt. |
| N-06 | niedrig | Löschung meldete Erfolg, auch wenn ein Anmeldekonto liegen blieb | Die Funktion zählt, was übrig ist, die App meldet es. Test R20. |
| N-07 | niedrig | Meldung verdeckte auf kleinen Bildschirmen Knöpfe im Dialog; Fokus fiel aus dem Dialog | Bei offenem Dialog steht die Meldung darunter, der Dialog macht Platz; Fokus wird zurückgeholt. Testlauf 1e. |
| N-08 | niedrig | Löschtermin nahm „infinity“ und Zeitpunkte an | Feste Formate für Datum und Zeitpunkt. Test R19. |
| N-09 | niedrig | Serverfehler beim Orga-Login erschien als falsches Passwort | Eigene Meldung für nicht erreichbar und für zu viele Versuche. |
| N-10 | niedrig | README verwies auf fehlende Dokumente | Dieses Dokument und das Testprotokoll. |
| N-11 | niedrig | „Die App lehnt Nummern ab“ stimmte nicht ganz | Namen mit mehr als vier Ziffern werden abgelehnt (Test R17), die Anleitung sagt, was die Prüfung leistet. |
| N-12 | niedrig | Schritt 6e behauptete eine Änderung, machte aber keine | 6e weist mit entwertetem Token zu und prüft, dass genau eine Zuweisung entsteht. |

Dazu aus der Nachprüfung übernommen: Die Löschfunktionen treffen nur Konten, die die Login-Funktion selbst angelegt hat (Adresse **und** Marke in den App-Metadaten). Ein Konto einer anderen App mit ähnlicher Adresse bleibt (Tests R10, R14, R20).

## Dritter Durchgang: Nachträge nach der Einrichtung

Am 05.10.2026 hat ein weiterer Prüfer die nachgezogenen Dokumente gegen Code und Tests gehalten und die SQL-Tests in einer eigenen Datenbank nachgemessen.

| Nr. | Stufe | Befund | Behandlung |
|---|---|---|---|
| P-01 | hoch | Der Durchgang von Hand öffnete nie einen gültigen Link ein zweites Mal. Genau das ist der Alltag (Link im Messenger wieder antippen) und im echten Anmeldedienst noch nie gelaufen. | Eigener Schritt 4 im Durchgang: derselbe Link noch einmal und auf einem zweiten Gerät. |
| P-02 | hoch | „Die SQL-Tests laufen auch im echten Projekt“ stimmte nur bei leerer Helfertabelle. Mit Helfern in der Datenbank wurden fünf Rechte-Fälle rot, obwohl alles stimmte, weil sie Zeilen zählen. | Beide Testskripte brechen jetzt sofort ab, wenn schon Helfer in der Datenbank stehen, und ändern dann nichts. Für den laufenden Betrieb gibt es `supabase/tests/check_rechte.sql`: liest nur, läuft mit echten Daten. Beides ist getestet. |
| P-03 | mittel | Der Durchgang prüfte nicht, ob beim Erneuern eines Links und beim Entfernen der Testdaten die Anmeldekonten wirklich verschwinden. Ein Fehlschlag steht nur im Protokoll. | Kontrolle im Dashboard in Schritt 7 und 9 des Durchgangs. |
| P-04 | mittel | Unklar, welcher Lauf die Freigabe ist: Durchgang von Hand oder automatischer Browser-Testlauf. | Freigabe ist der Durchgang von Hand. Betrieb, README und Prüfliste sagen das jetzt gleich. |
| P-05 | mittel | Die Freigabebedingung ließ die Selbstregistrierung aus. Der Durchgang soll mit der endgültigen Einstellung laufen. | Reihenfolge festgelegt: erst ausschalten, dann der Durchgang (D3, Prüfliste 5). |
| P-06 | mittel | Die Begründung der 18 Warnungen war an drei Stellen ungenau (`hp_my_context()` lehnt nicht ab, sondern gibt die Rolle „none“ zurück). | Absatz unten neu gefasst. |
| P-07 bis P-14 | niedrig | Ungenaue Beschriftungen im Durchgang, erlaubte Herkünfte verkürzt beschrieben, „Tabellen sind leer“, veraltete Verweise, Region, „sofort draußen“. | In Testprotokoll, Betrieb und README berichtigt. |

Nicht übernommen: `hp_my_context()` die Freigabe für angemeldete Konten zu entziehen. Die Funktion gibt einem Konto ohne Zuordnung nur Rolle, Serverzeit und den Zähler des Datenstands zurück. Der Entzug wäre eine Änderung an der eingespielten Datenbank ohne Gewinn an Schutz.

### Haben die Tests Biss?

Zu jedem neuen Schutz wurde in einer Kopie ein Fehler eingebaut und geprüft, ob ein Test rot wird. Stand nach dem Nachschärfen: 27 von 27 eingebauten Fehlern in der Datenbank werden erkannt (Fälle R2, R7, R8, R9, R10, R14, R17, R18, R19, R20, T11). Ein Fall braucht dafür Superuser-Rechte und läuft deshalb nur lokal (Sitzung ohne Rollenwechsel in R18). Zwei Fehler in der Login-Funktion bleiben ohne Test, siehe „Bewusst offen“ 7. Die Rechteprüfung `check_rechte.sql` hat eigene Gegenproben: Zwölf eingebaute Abweichungen (fehlende Zeilensicherheit, offene Regel, Tabellenrecht, zu viel oder zu wenig freigegebene Funktion, Zugriff auf `hp_private`, fehlender Suchpfad, pauschale Freigabe und pauschaler Entzug) werden alle gemeldet.

## Bewusst offen

1. **Löschung von Hand.** Die App löscht am 15.11.2026 nicht selbst, weil vorher gesichert werden soll. Die Orga wird in der App erinnert. Wer das vergisst, behält die Daten länger als angekündigt.
2. **Sicherungsdatei.** Sie enthält Namen und liegt danach auf dem Gerät der Orga. Wie lange, legt die Orga fest. Die Ankündigung nennt die Kopie.
3. **Keine Wiederherstellung aus der Sicherung.** Ein kostenloses Supabase-Projekt hat keine Datensicherung auf Knopfdruck. Geht der Plan verloren, wird er aus der Sicherungsdatei oder dem Ausdruck von Hand neu eingetragen. Für rund 20 Helfer ist das vertretbar; ein Import wäre ein neuer Baustein mit eigenen Risiken.
4. **Gemeinsames Projekt.** Jeder Helfer-Link erzeugt ein Anmeldekonto. Für eine zweite App im selben Projekt ist das ein „angemeldetes“ Konto. Ob deren Daten davor sicher sind, lässt sich nur dort prüfen (siehe Prüfliste). Ein eigenes Projekt vermeidet die Frage.
5. **Keine Benachrichtigung bei Änderungen durch die Orga.** Wäre ein eigener Baustein. Stattdessen erinnert die App die Orga, Bescheid zu sagen, und die Ankündigung enthält eine fertige Zeile dafür.
6. **Kein Test mit einem Screenreader.** Geprüft sind Tastatur, Fokus, Beschriftungen und Rollen, nicht die Ausgabe eines Vorleseprogramms.
7. **Zwei Stellen in der Login-Funktion ohne eigenen Test.** Das Aufräumen eines Kontos, wenn die Zuordnung im letzten Moment scheitert, lässt sich über HTTP nicht gezielt auslösen; ein liegen gebliebenes Konto räumt die Datenbank später ab (Test R20). Die Formatprüfung des Codes ändert das Ergebnis nicht: Ein falsch geformter Code ist auch ohne sie ungültig.
8. **Gleichzeitiges Öffnen desselben Links auf zwei Geräten.** Das zweite Einmal-Token kann das erste entwerten. Das betroffene Gerät zeigt „Link nicht gültig“; erneutes Öffnen genügt. Nur im echten Projekt prüfbar, dort noch offen.
9. **Gemeinsamer Browser-Speicher unter `benditot.github.io`.** Alle Seiten unter dieser Adresse können die Anmeldung der anderen lesen. Dort also nur eigene, geprüfte Seiten veröffentlichen.
10. **Datenschutztext.** Die Kurzfassung in der App und der Absatz in der Ankündigung beschreiben, was die App tut. Ob das rechtlich genügt, ist nicht geprüft.

## Prüfliste im echten Projekt

Stand 05.10.2026, Projekt in Frankfurt (`eu-central-1`), Postgres 17. Die Migrationen wurden unverändert aus dem veröffentlichten Repository geladen (Prüfsumme je Datei gleich dem lokalen Stand). Ein Abgleich von Tabellen, Spalten, Indizes, Regeln, Funktionen und Rechten ergab denselben Fingerabdruck wie in der lokalen Testdatenbank: 9 Tabellen mit eingeschalteter Zeilensicherheit, 20 Funktionen im Schema `public`, 17 in `hp_private`, davon ohne Anmeldung aufrufbar 0, angemeldet 18, nur für die Edge Function 2. Die Rechteprüfung `check_rechte.sql` ist dort ebenfalls gelaufen: acht von acht Zeilen in Ordnung.

| Nr. | Prüfung | Stand | Ergebnis |
|---|---|---|---|
| 1 | Login-Funktion erreichbar mit dem Schlüssel aus `config.js`, von der Pages-Adresse aus | erledigt | Falscher Link auf der veröffentlichten Seite zeigt „Dieser Link ist nicht gültig“. Die Vorabfrage des Browsers erlaubt die Pages-Adresse (dazu Einträge aus `HP_ALLOWED_ORIGINS` und für lokale Tests `http://localhost` und `http://127.0.0.1`); eine fremde Herkunft wird nicht zurückgespiegelt. |
| 2 | Ganze Kette mit einem Testhelfer, auch auf einem zweiten Gerät | **offen** | Braucht ein Orga-Konto. Schritte 3 und 4 im Durchgang. |
| 3 | `t_rights.sql` und `t_swaps.sql` im SQL-Editor | erledigt | Rechte 20 von 20, Tausch 14 von 14, keine Datenreste. Gelaufen bei leerer Helfertabelle, vor dem Anlegen der drei Testhelfer. |
| 4 | Security Advisor ohne Fehler | erledigt | 0 Fehler, 18 Warnungen, siehe unten. |
| 5 | Ohne Anmeldung kein Zugriff; selbst registriertes Konto kein Zugriff | teils | Ohne Anmeldung: Tabellen und Funktionen lehnen ab, `hp_private` wird von der Daten-API nicht angeboten. Ein angemeldetes Konto ohne Zuordnung prüft Fall R6 in der Datenbank. **Offen:** Selbstregistrierung im Projekt ist noch eingeschaltet. Sie wird vor dem Durchgang ausgeschaltet. |
| 6 | Gemeinsames Projekt: Helfer-Token gegen die zweite App | **offen** | Die zweite App ist noch nicht eingespielt. Danach `0006_hp_grants.sql` erneut ausführen und mit `check_rechte.sql` prüfen. |
| 7 | Link erneuern: altes Anmeldekonto weg, kein `auth_cleanup FAILED` | **offen** | Braucht ein Orga-Konto. In der Datenbank grün (R8, R20). Schritte 7 und 9 im Durchgang. |
| 8 | Sperrzeitpunkt leeren und wieder setzen | **offen** | Über die echte Daten-API noch nicht gelaufen. In der Datenbank grün (R19). Schritt 8 im Durchgang. |
| 9 | Sitzung länger als eine Stunde | **offen** |  |
| 10 | Welche Absenderadresse die Login-Funktion sieht | erledigt | Die Adresse kommt vom Gateway. Selbst gesetzte Kopfzeilen (`CF-Connecting-IP`, `X-Forwarded-For`, `X-Real-IP`) umgehen die Begrenzung nicht. Der elfte Fehlversuch in zehn Minuten bekommt 429. |
| 11 | Region und Verhalten bei pausiertem Projekt | teils | Region Frankfurt. Das Pausieren wurde nicht ausprobiert. |
| 12 | Durchgang mit Anmeldung auf der veröffentlichten Seite (von Hand, Schritte im Testprotokoll) | **offen** | Seite liefert Version 5.0.0 ohne Skriptfehler aus. Der Durchgang fehlt. |

### Die 18 Warnungen des Security Advisors

Alle 18 lauten gleich: Eine Funktion mit den Rechten ihres Besitzers ist für angemeldete Konten aufrufbar. Das betrifft genau die 18 Funktionen, die `0006_hp_grants.sql` für angemeldete Konten freigibt (17 ruft die App direkt auf, `hp_my_context()` nur über `hp_state()`), und ist die gewählte Bauweise: Die Tabellen sind für Clients vollständig gesperrt, jeder Zugriff läuft über diese Funktionen. 17 davon prüfen als Erstes, ob Orga oder ein zugeordneter Helfer aufruft, und lehnen sonst mit `NOT_ALLOWED` ab. `hp_my_context()` lehnt nicht ab: Ein angemeldetes Konto ohne Zuordnung bekommt die Rolle „none“, die Serverzeit und den Zähler des Datenstands, aber keine Namen und keinen Plan. Fall R6 prüft das Konto ohne Zuordnung an den Lese- und Tauschfunktionen und an einer Orga-Funktion; die übrigen Orga-Funktionen prüft R4 mit einem Helfer-Konto über dieselbe Prüfung (`hp_private.require_admin()`). Die Warnungen bleiben deshalb stehen. Fehler meldet der Advisor keine.

Der Performance Advisor meldet 0 Fehler, 0 Warnungen und zwei Hinweise auf noch ungenutzte Indizes. Zuweisungen, Tausch und Hinweise sind noch leer, die Hinweise sagen deshalb nichts aus.
