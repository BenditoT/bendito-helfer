# Changelog

## 5.0.0 — 2026-10-04

Erste gemeinsam nutzbare Fassung. Der bisherige Stand lief nur in einem einzelnen Browser.

### Neu

- Persönlicher Login: Helfer öffnen ihren eigenen Link, die Orga meldet sich mit E-Mail und Passwort an. Rechte prüft die Datenbank bei jedem Aufruf.
- Ein gemeinsamer Datenstand für alle Geräte. Die App lädt alle 20 Sekunden, beim Zurückkehren ins Fenster und nach jeder eigenen Aktion neu und zeigt „Stand hh:mm:ss“.
- Ohne Netz bleibt der letzte Stand sichtbar, ein roter Hinweis erscheint und Änderungen sind gesperrt.
- Schichttausch neu: 1:1-Tausch mit Annahme durch die andere Person oder Wechsel auf einen freien Platz mit Freigabe durch die Orga. Der Plan ändert sich ganz oder gar nicht.
- Orga-Einstellungen: mehrere Namen auf einmal anlegen, Login-Link erzeugen, erneuern und sperren, Tausch sperren (Schalter und Zeitpunkt), Testdaten entfernen, Plan als Datei sichern, Druckansicht, Löschung nach dem Event.
- Bedienung mit Tastatur, größere Tippziele, Dialoge mit Fokusführung.
- Meldungen und der Hinweis „keine Verbindung“ stehen fest am unteren Bildschirmrand und bleiben auch beim Scrollen sichtbar.
- Eigene offene Tauschanfragen sind an der Schicht markiert. Nach einer Anfrage und nach dem Entfernen einer Zuweisung erinnert die App daran, der Person Bescheid zu sagen.
- Schichten nach Mitternacht tragen den Vermerk „Nacht auf Sa“ oder „Nacht auf So“.
- Die Orga sieht nach dem Event eine Erinnerung an das Sperren der Links und an den Löschtermin. Kurzfassung zum Datenschutz im Fuß der App.

### Nach dem Experten-Review ergänzt

- Interne Datenbankfunktionen liegen in einem eigenen Schema, das über die Daten-API nicht erreichbar ist. Die Login-Funktionen prüfen selbst, dass nur die Edge Function sie aufruft.
- Die Login-Funktion läuft ohne JWT-Prüfung des Gateways und kommt damit auch mit publishable-Schlüsseln zurecht. Weitere erlaubte Herkünfte lassen sich per Umgebungsvariable setzen.
- Ein gültiger Link kommt immer durch. Begrenzt werden nur Fehlversuche, damit ein Gerät mit altem Link nicht ein ganzes WLAN aussperrt.
- Höchstens fünf offene Tauschanfragen je Person.
- Der Sperrzeitpunkt lässt sich über die Oberfläche wieder leeren.
- Ein abgelaufenes Zugriffstoken wird einmal erneuert, statt die Person abzumelden. Nach einer eigenen Änderung zählt nur ein Abruf, der danach gestartet ist.
- Die Löschung nach dem Event und „Alle Login-Links sperren“ räumen auch übrig gebliebene Anmeldekonten ab.
- Die Schranke vor der Veröffentlichung erkennt Sicherungsdateien aus der App. Der Testlauf läuft nicht, sobald es echte Helfer gibt.
- Gelöscht werden nur Anmeldekonten, die die Login-Funktion selbst angelegt hat. Bleibt bei der Löschung nach dem Event eines liegen, meldet die App das.
- Feste Formate für Sperrzeitpunkt und Löschtermin. Namen mit mehr als vier Ziffern werden abgelehnt.
- Ist ein Dialog offen, steht eine Meldung unter ihm statt über seinen Knöpfen.

### Entfernt

- Namensauswahl als Helfer-Login und das im Quelltext hinterlegte Orga-Passwort.
- Abruf der öffentlich lesbaren Tabelle. Helfer legt die Orga in der App an.
- Freitext-Nachrichten. Es gibt nur noch Hinweise zu Tauschvorgängen; für alles andere zeigt die App den bevorzugten Kontaktweg.
- Fachdaten im Browser-Speicher, Fremdschrift und Bibliotheken von fremden Servern.
