# Mail-Backend: Empfangstest vom 25.10.2026

**O6 bestanden.** Zeiten: Europe/Berlin (CET, UTC+01:00). Norbert hat beide eigenen Testempfänger ausdrücklich bestätigt; deren Adressen bleiben außerhalb des Repos. Insgesamt zwei autorisierte Testmails gesendet, keine Mail an echte Helfer.

## Einrichtung und erster Versuch

Apps-Script-Projekt im Bendito-Konto eingerichtet. Norbert hat Geheimniserzeugung und Google-Freigabe selbst abgeschlossen; der Hash wurde über `hp_admin_set_mail_secret_hash` gesetzt. Das Geheimnis wurde nicht ausgelesen.

Erster Versuch: Minutentrigger 13:32:44–13:32:45 gestartet, tatsächliche Tauschanfrage 13:33:26.765792, Gmail-Versand 13:34:36.366360, `sent`, `tries=1`, Abstand rund 70 Sekunden. Mailtext und Gesendet-Ordner geprüft. Norbert sah keinen neuen Eingang. Er bestätigte anschließend, dass die verwendete Teamadresse in dasselbe absendende Gmail-Konto weiterleitet. Gmail dokumentiert die fehlende separate Inbox-Anzeige für eigene Alias-Mails; das ist eine plausible Erklärung, aber kein Nachweis für diese konkrete Weiterleitung. Deshalb separaten eigenen Empfänger ausdrücklich bestätigen lassen.

Danach `stopMailTest` um 13:36:17 ausgeführt, Triggerübersicht 0, Versand aus. Beide Testhelfer über `hp_admin_remove_test_data()` entfernt, private Adressen und Outbox leer, Testschichten entfernt, 8 echte Helfer und echte Zuweisungen unverändert.

## Zweiter Versuch: tatsächlicher Eingang nachgewiesen

| Schritt | Ergebnis |
|---|---|
| Eigener separater Empfänger | Von Norbert ausdrücklich für genau eine weitere Testmail bestätigt |
| Zwei neue Testhelfer mit zwei Testschichten | Angelegt, beide `is_test=true`, nur Empfänger mit Testadresse versehen |
| Tatsächliche Tauschanfrage | 13:44:37.904195; eine Outbox-Zeile `swap_request` |
| Minutentrigger gestartet | `startMailTest`, 13:45:11–13:45:12 erfolgreich |
| Automatischer Gmail-Versand | 13:45:43.497472; `sent`, `tries=1`, Abstand rund **66 Sekunden** |
| Tatsächlicher Empfang | Empfangendes Gmail per Connector gelesen: Label **INBOX**, `Received` beim Empfänger **13:45:43 CET**; damit innerhalb von drei Minuten |
| Authentizität und Text | SPF, DKIM und DMARC `pass`; erwartete Test-Tauschanfrage, Schichttag/Zeit/Dienst und allgemeiner App-Link; kein persönlicher Login-Code und keine freie Notiz |
| Testversand beendet | `stopMailTest`, 13:46:24–13:46:25 erfolgreich; `HP_MAIL_ENABLED=false`, danach Triggerübersicht **0 Trigger** |
| „Testdaten entfernen“ | Tatsächlichen RPC `hp_admin_remove_test_data()` ausgeführt; genau zwei Testhelfer entfernt, Testschichten anschließend gelöscht |
| Abschlusskontrolle | **8 echte Helfer, 0 Testhelfer, 0 private Mailadressen, 0 Outbox-Zeilen**; echte Zuweisungszahl unverändert |

Kein Empfangs-Header mit Adresse oder Message-ID im Repo gespeichert. Die temporären lokalen Testdateien und Testzugänge wurden entfernt. Die Google-Einrichtung bleibt erhalten, der automatische Versand ist aus. Die Versandfreigabe gilt bislang nur für die ausdrücklich bestätigten eigenen Testempfänger. Keine Helferadressen importieren und keine Mailzusagen in Einladungen aufnehmen, bevor der Sonnet-Testlauf mit allen fünf Fällen bestanden und der Versand an echte Helfer freigegeben ist.

## Zusatzauftrag: Rückweg zur Bendito-App (5.0.7)

„← Zur Bendito-App“ ist in der Kopfzeile aller angemeldeten Ansichten sowie auf Anmeldung und Verbindungs-/Ladeseiten vorhanden. Der Link führt im selben Tab auf die Gäste-App. Ein tatsächlicher Klick mit einem Testhelfer erreichte die Bendito-App; der Browser-Rückweg zeigte die weiter angemeldete Helferansicht. Bei 360 Pixeln Bildschirmbreite kein Überlauf; der Link ist 44 Pixel hoch. Testhelfer anschließend vollständig entfernt.

17 statische Prüfungen und 11 Poller-/Import-/Teststeuerungsprüfungen bestanden, Veröffentlichungsschranke grün. Norbert hat Codex am 25.10.2026 ausdrücklich zum selbstständigen Push ermächtigt. Version 5.0.7 (Commit 1edc156) ist veröffentlicht; Versionsanzeige und tatsächlicher Klick zur Gäste-App auf der Live-Seite geprüft.

Quelle zum Alias-Sonderfall: [Google-Hilfe: Messages sent to email alias or Group aren't in my inbox](https://knowledge.workspace.google.com/admin/support/troubleshooting/messages-sent-to-email-alias-or-group-arent-in-my-inbox). Die STRATO-Weiterleitung wurde nicht geändert.
