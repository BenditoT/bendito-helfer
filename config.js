// Öffentliche Angaben der App. Hier steht nie ein Geheimnis: Der anon-Schlüssel
// ist für den Browser gedacht, der service-role-Schlüssel gehört nicht hierher.
// Adresse und Schlüssel setzt tools/set-backend.mjs, zusammen mit der
// Content-Security-Policy in index.html. Solange beides leer ist, zeigt die App
// „Die Datenbank ist noch nicht verbunden.“
window.HP_CONFIG = {
  version: '5.1.0',
  benditoAppUrl: 'https://db.benditotango.de/app/',
  supabaseUrl: 'https://db.benditotango.de',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzkyMTQwMTMxLCJleHAiOjIxMDc1MDAxMzF9.PRh_r-UX8bVxGWfRS6secrs7IYRiD3Avmcj_smdqM2E'
};
