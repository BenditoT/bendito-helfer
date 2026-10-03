// Zeichenketten, die im Ordner und in der Historie nicht vorkommen dürfen.
// Zerlegt geschrieben, damit diese Datei sich nicht selbst trifft.
export const FORBIDDEN = [
  ['ADMIN', '_PW'], ['SHEET', '_ID'], ['docs.', 'google.com'], ['fonts.', 'googleapis.com'], ['cdn', 'js'],
  ['bendito-helferplan', '-v4'],
].map((p) => p.join(''));

// Echte Schlüssel mit Dienstrechten (neues Format). Die Bibliothek in vendor/
// kennt nur das Präfix; ein echter Schlüssel ist deutlich länger.
export const SECRET_KEY = new RegExp('sb_' + 'secret_[A-Za-z0-9_-]{16,}');

// Dateiarten, die nie ins Repository gehören.
export const DATA_FILE = /\.(csv|xlsx|xls|pdf|env|jsx)$/i;
