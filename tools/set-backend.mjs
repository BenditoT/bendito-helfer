#!/usr/bin/env node
// Trägt das Supabase-Projekt in config.js und in die Content-Security-Policy
// von index.html ein. Beide müssen zusammenpassen, deshalb nur über dieses Skript.
//
//   node tools/set-backend.mjs https://<projekt>.supabase.co <anon-Schlüssel>
//   node tools/set-backend.mjs --leer        (Verbindung wieder entfernen)
//
// Nimmt nur den anon- oder publishable-Schlüssel an. Ein Schlüssel mit
// Dienstrechten wird abgelehnt, weil er nie in den Browser gehört.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [a, b] = process.argv.slice(2);
let url = '', key = '';

if (a !== '--leer') {
  url = String(a || '').replace(/\/+$/, '');
  key = String(b || '');
  if (!/^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(url)) {
    console.error('Adresse erwartet in der Form https://<20 Zeichen>.supabase.co');
    process.exit(1);
  }
  let ok = /^sb_publishable_[A-Za-z0-9_-]+$/.test(key);
  if (!ok && /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(key)) {
    try { ok = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString('utf8')).role === 'anon'; } catch { ok = false; }
  }
  if (!ok) {
    console.error('Abgelehnt: Das ist kein anon- oder publishable-Schlüssel.');
    process.exit(1);
  }
}

const cfgPath = path.join(root, 'config.js');
let cfg = readFileSync(cfgPath, 'utf8');
cfg = cfg.replace(/supabaseUrl:\s*'[^']*'/, `supabaseUrl: '${url}'`).replace(/supabaseAnonKey:\s*'[^']*'/, `supabaseAnonKey: '${key}'`);
writeFileSync(cfgPath, cfg);

const htmlPath = path.join(root, 'index.html');
const html = readFileSync(htmlPath, 'utf8');
const next = html.replace(/(<meta http-equiv="Content-Security-Policy" content="[^"]*?)connect-src [^;"]+/, `$1connect-src ${url || "'none'"}`);
if (next === html && !html.includes(`connect-src ${url || "'none'"}`)) {
  console.error('Content-Security-Policy in index.html nicht gefunden.');
  process.exit(1);
}
writeFileSync(htmlPath, next);
console.log(url ? `Verbunden mit ${url}` : 'Verbindung entfernt');
