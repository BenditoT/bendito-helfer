// Öffentliche Angaben der App. Hier steht nie ein Geheimnis: Der anon-Schlüssel
// ist für den Browser gedacht, der service-role-Schlüssel gehört nicht hierher.
// Adresse und Schlüssel setzt tools/set-backend.mjs, zusammen mit der
// Content-Security-Policy in index.html. Solange beides leer ist, zeigt die App
// „Die Datenbank ist noch nicht verbunden.“
window.HP_CONFIG = {
  version: '5.0.0',
  supabaseUrl: 'https://pumbaojykazurlncntae.supabase.co',
  supabaseAnonKey: 'sb_publishable_Rfc4THqxTClo3UMIk5c8Eg_FkDKpjh9'
};
