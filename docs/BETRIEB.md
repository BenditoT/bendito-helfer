# Betrieb: Bendito Helferplan 5.0.0

Für die Orga. Bendito Tango Marathon, Fr 30.10. bis So 01.11.2026.

## Anmelden

Die Orga meldet sich auf der Startseite über „Orga-Login“ mit E-Mail und Passwort an. Das Passwort lässt sich unter „Einstellungen“ ganz unten ändern. Helfer haben kein Passwort, sie öffnen ihren persönlichen Link.

## Helfer anlegen und Links verteilen

1. „Einstellungen“ öffnen. Einzelne Person unter „Helfer anlegen“, viele auf einmal unter „Mehrere Namen einfügen“ (ein Name pro Zeile).
2. Eingetragen wird nur der Anzeigename, dazu Farbe, bevorzugter Kontaktweg und Aufbau-Team. Keine Telefonnummer, keine E-Mail-Adresse. Die App lehnt beides ab.
3. In der Liste „Alle Helfer“ bei der Person auf „Login-Link erzeugen“ tippen, dann „Link kopieren“ und der Person direkt schicken, zum Beispiel per WhatsApp. **Der Link wird nur dieses eine Mal angezeigt.**
4. Wer den Link hat, ist diese Person. Deshalb nie in eine Gruppe stellen.

## Schichten zuweisen

Auf dem Board oben eine Person antippen, dann bei der Schicht auf „+“. Das „×“ am Namen entfernt die Person wieder. Überschneidet sich eine Schicht mit einer anderen derselben Person, fragt die App nach. Hinweis zum Raster: Die Bar-Schichten Freitag 19:00 und 20:00 überschneiden sich rechnerisch um 30 Minuten, weil jede 1,5 Stunden dauert.

## Tausch

Helfer fragen einen Tausch aus ihrer Schicht heraus an. Ist die Zielschicht besetzt, entscheidet die dort eingeteilte Person. Ist dort ein Platz frei, gibt die Orga den Wechsel unter „Tausch“ frei. Angenommen wird ein Tausch ganz oder gar nicht.

**Sperre:** Der Tausch sperrt sich automatisch am **Do 29.10.2026 um 20:00 Uhr**. Schalter und Zeitpunkt stehen unter „Einstellungen“ → „Schichttausch“. Die Orga kann danach weiter zuweisen.

## Notfallplan auf Papier

Nach der Sperre, am Donnerstagabend oder Freitagmorgen: „Einstellungen“ → „Druckansicht“ → „Drucken“. Der Ausdruck gilt, wenn am Event kein Netz da ist. Ohne Netz zeigt die App den letzten Stand mit rotem Hinweis und lässt keine Änderungen zu.

## Wenn ein Link nicht geht

| Meldung oder Lage | Was tun |
|---|---|
| „Dieser Link ist nicht gültig“ | Link wurde erneuert, gesperrt oder unvollständig kopiert. Neuen Link erzeugen und schicken. Der alte ist damit tot. |
| „Zu viele Versuche“ | Zehn Minuten warten. Schutz gegen Ausprobieren. |
| Link wurde weitergegeben oder Telefon verloren | „Login-Link erneuern“. Alle Geräte mit dem alten Link sind sofort draußen. |
| „Keine Verbindung“ | Netz prüfen, „Erneut versuchen“. Bleibt es rot: Ausdruck verwenden. |
| „Keine Verbindung“ bei allen, obwohl das Netz geht | Das kostenlose Supabase-Projekt wurde nach etwa einer Woche ohne Zugriffe pausiert. Im [Supabase-Dashboard](https://supabase.com/dashboard/projects) das Projekt wieder starten. |

**Damit das Projekt nicht einschläft:** In den Wochen vor dem Event die App mindestens alle paar Tage einmal öffnen. Sobald Helfer ihre Links nutzen, erledigt sich das von selbst.

## Nach dem Event

| Wann | Was | Wo |
|---|---|---|
| Mo 02.11.2026 | Alle Login-Links sperren | „Einstellungen“ → „Alle Login-Links sperren“ |
| bis So 15.11.2026 | Plan als Datei sichern, dann Helferdaten löschen | „Einstellungen“ → „Helferdaten löschen“. Der Dialog verlangt zuerst die Sicherung. |

Die Sicherungsdatei enthält Namen. Sie bleibt auf dem eigenen Gerät und wird gelöscht, sobald sie nicht mehr gebraucht wird. Gelöscht werden alle Helfer mit Zuweisungen, Tauschvorgängen, Hinweisen, Login-Links und Protokoll. Schichtraster, Einstellungen und Orga-Konten bleiben für das nächste Jahr.

## Was gespeichert wird

Pro Helfer: Anzeigename, Farbe, bevorzugter Kontaktweg ohne Nummer, Aufbau-Team ja oder nein, die zugewiesenen Schichten und Tauschvorgänge. Der Login-Link liegt nur als Prüfsumme in der Datenbank. Ein Protokoll hält fest, wann welche Aktion lief, ohne Namen. Die Daten liegen bei Supabase; vorgesehen ist die Region Frankfurt.
