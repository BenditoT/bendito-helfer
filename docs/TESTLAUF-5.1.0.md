# Testlauf 5.1.0 — 25.10.2026

**S7 bestanden.** Zeiten Europe/Berlin, CET (UTC+01:00). Ausschließlich zwei ausdrücklich im Chat bestätigte eigene Empfänger. Kein Versand an echte Helfer, keine echten Login-Links erzeugt oder erneuert. Regulärer Versand bleibt ausgeschaltet.

## Durchführung und Grenze des Tests

Unveröffentlichte Oberfläche 5.1.0 lokal ausgeliefert. Ein ausschließlich auf dem eigenen Rechner erreichbarer Testadapter ersetzte die Anmeldung durch drei feste Testrollen und rief über SSH die unveränderten Live-Funktionen als `authenticated` mit dem jeweiligen Benutzer auf. Schreibzugriffe waren auf die beiden Testhelfer, ihre Tauschvorgänge, die drei Testschichten und die bestätigten Empfänger begrenzt. Der Mailweg lief vollständig über Live-Outbox, vorhandenen Apps-Script-Minutentrigger und Gmail. Der Testadapter prüfte bei jedem `hp_state`-Ergebnis, dass es keine Mailadresse enthielt.

Damit sind Oberfläche, Funktionen, Warteschlange und Empfang geprüft. Die normale Anmeldung und der HTTP-Datenzugang wurden in diesem Durchgang nicht erneut geprüft; der Testadapter durchlief diese beiden Schichten nicht. Die frühere Backend-Abnahme O6 enthält den separaten externen Empfangsnachweis. Die hier nachgewiesenen Eingänge lagen im ausdrücklich bestätigten eigenen Absenderpostfach.

Zwei Testhelfer und drei eigene Schichten (Fr 06:00, 07:00 und 08:00 Bar). Anlage und erste Fälle ab 14:19 Uhr. Nach einer Unterbrechung war der lokale Testadapter verloren; Fortsetzung ab 17:07 Uhr mit denselben Testhelfern. Der Google-Trigger lief während der Unterbrechung weiter; da nur Testadressen hinterlegt waren und keine weiteren Ereignisse erzeugt wurden, entstanden keine Mails an echte Helfer. Zum Abschluss wurde er entfernt.

## Die fünf Fälle

| Fall | Auslöser | Nachweis | Ergebnis |
|---|---|---|---|
| Tauschanfrage | 14:27:08 | Tatsächlicher Posteingang und Originalkopf **14:28:12**, rund 64 Sekunden | grün |
| Annehmen | 14:26:34 | Tausch in der Oberfläche bestätigt, Schichten getauscht. Tatsächlicher Posteingang und Originalkopf **14:28:12**, rund 98 Sekunden | grün |
| Ablehnen | 17:08:59 | Oberfläche zeigt „Anfrage abgelehnt“, Plan bleibt bestehen. Tatsächlicher Posteingang und Originalkopf **17:10:12**, rund 73 Sekunden | grün |
| Orga-Zuweisung | 17:09:36 | 08:00 Bar zugewiesen; Hinweis „Schicht zugewiesen“ mit richtiger Schicht. Tatsächlicher Posteingang und Originalkopf **17:10:12**, rund 36 Sekunden | grün |
| Mail abschalten | spätestens 17:10:52 | Schalter aus, auch nach Neuladen. Danach Orga-Entfernung 17:11:04 und neue Tauschanfrage 17:11:12: Hinweise vorhanden, **keine neue Outbox-Zeile** (weiter acht bereits gesendete Ereignisse) | grün |

Anfrage und Annahme sowie Ablehnung und Zuweisung kamen jeweils gebündelt. Die Zuweisung konnte deshalb mit einer schon versandreifen Gruppe früher als nach einer eigenen Minute zugestellt werden. Die Mails enthielten Schichttag, Uhrzeit und Dienst, den allgemeinen App-Link und den Hinweis zum Abschalten. Keine persönlichen Login-Codes und keine freie Tauschnotiz.

Der erste Versuch an die ins Absenderkonto zurückleitende Teamadresse wurde um 14:21:39 ausgelöst und um 14:23:11 gesendet. Dort war nur die gesendete Kopie belegt; dieser Versuch zählt **nicht** als Empfangsnachweis. Der anschließende direkte Eingang um 14:28:12 und der Eingang um 17:10:12 waren jeweils in der tatsächlichen Posteingangsansicht sichtbar; in beiden Originalnachrichten wurde die exakte Zeit geprüft. Adressen und Nachrichtenkennungen bleiben außerhalb des Repos.

## Oberfläche und Datenschutz

- S1 mit beiden Testhelfern geprüft: „Mail für Benachrichtigungen“ gespeichert, danach „Mail hinterlegt“, alle zehn Eingabefelder leer. Kein Auslesen der Adresse, keine Adresse in `hp_state`.
- S2 in „Mein Plan“ und „Hinweise“ geprüft: an/aus und nach Neuladen weiterhin aus. Die App-Hinweise bleiben beim Opt-out erhalten.
- S3 Datenschutz-Dialog tatsächlich geöffnet und Text zu Zweck, Bendito-Gmail, Abschalten und Löschung spätestens 15.11.2026 geprüft. Ankündigung entsprechend ergänzt.
- S4 Zuweisung und Entfernung werden anhand `shift_id` vor dem Tausch-Nachschlagen dargestellt. Kein falscher Hinweis auf einen verschwundenen Tauschvorgang.

## Abschluss und Aufräumen

`stopMailTest` **17:11:33–17:11:34**, erfolgreich. Diese Funktion setzt `HP_MAIL_ENABLED=false` und entfernt die pollMail-Trigger. Anschließend Triggeransicht geprüft: **keine Ergebnisse / null Trigger**.

Mit `hp_admin_remove_test_data()` genau zwei Testhelfer entfernt, danach nur die drei Testschichten gelöscht. Die beiden ausschließlich für diesen Adapter angelegten synthetischen Anmeldezeilen wurden gezielt entfernt; sie lagen außerhalb der vom normalen Aufräum-RPC vorgesehenen Helfer-Domain. Abschluss: **8 echte Helfer, 42 echte Zuweisungen, 0 Testhelfer, 0 Testkonten, 0 private Benachrichtigungsadressen, 0 Outbox-Zeilen**. Echte Helfer und echte Zuweisungen waren vor und nach dem Aufräumen per Prüfsumme identisch. Keine Datenbankfunktion und kein Apps-Script-Code geändert.

S8/S9 stehen noch aus: CSV fehlt, reguläre Versandfreigabe angefragt. Keine Einladungsentwürfe verändert. Aus dem bestandenen Test folgt keine Freigabe zum Versand an echte Helfer.

## Lokale Prüfungen

18/18 statische und 11/11 Mail-/Importprüfungen grün, Veröffentlichungsschranke grün. Der zuerst verwendete Node 18 stürzte beim Teststart ab; mit installiertem Node 22 laufen die Prüfungen. Die neue Adressprüfung erlaubt reservierte Testdomains, das öffentliche Bendito-Absenderkonto und genau einen vorhandenen synthetischen Grenzwert-Test.
