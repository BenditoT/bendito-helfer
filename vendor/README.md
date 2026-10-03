# vendor

Fest versionierte Bibliotheken, unverändert aus den npm-Paketen übernommen. Die App lädt zur Laufzeit keinen Code von Dritten.

| Datei | Paket | Version | Pfad im Paket | Lizenz |
|---|---|---|---|---|
| `preact.umd.js` | preact | 10.19.3 | `dist/preact.umd.js` | MIT |
| `hooks.umd.js` | preact | 10.19.3 | `hooks/dist/hooks.umd.js` | MIT |
| `htm.umd.js` | htm | 3.1.1 | `dist/htm.umd.js` | Apache-2.0 |
| `supabase.js` | @supabase/supabase-js | 2.117.2 | `dist/umd/supabase.js` | MIT |

Die SHA-256-Summen stehen in `CHECKSUMS.txt` und werden von `tests/static.test.mjs` geprüft.

Aktualisieren: Paket mit `npm pack <name>@<version>` holen, Datei ersetzen, `sha256sum` neu schreiben, Tabelle anpassen, Tests laufen lassen.
