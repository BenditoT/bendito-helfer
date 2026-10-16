// Statische Prüfungen. Nur Node-Bordmittel, kein Paket.
// Aufruf: node --test tests/static.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(path.join(root, p), 'utf8');

import { FORBIDDEN, SECRET_KEY, DATA_FILE, EXPORT_MARK } from './forbidden.mjs';

function walk(dir, out = []) {
  for (const name of readdirSync(path.join(root, dir))) {
    if (['.git', 'node_modules', 'test-results', 'playwright-report'].includes(name)) continue;
    const rel = path.join(dir, name);
    if (statSync(path.join(root, rel)).isDirectory()) walk(rel, out); else out.push(rel);
  }
  return out;
}
const files = walk('.');
const textFiles = files.filter((f) => !/\.(png|jpg|ico)$/.test(f));

test('keine verbotenen Zeichenketten im Ordner', () => {
  const hits = [];
  for (const f of textFiles) {
    const body = read(f);
    for (const s of FORBIDDEN) if (body.includes(s)) hits.push(f + ' enthält ' + s.slice(0, 4) + '…');
  }
  assert.deepEqual(hits, []);
});

test('keine Datendateien und keine Altstände im Ordner', () => {
  const bad = files.filter((f) => DATA_FILE.test(f) || /helferplan\.html$/.test(f));
  assert.deepEqual(bad, []);
});

test('keine Sicherung aus der App im Ordner, auch nicht umbenannt', () => {
  const bad = textFiles.filter((f) => /\.(json|txt)$/i.test(f) && EXPORT_MARK.test(read(f)));
  assert.deepEqual(bad, []);
  assert.ok(DATA_FILE.test('bendito-helferplan-2026-11-02.json'), 'Dateiname der Sicherung wird nicht erkannt');
  assert.ok(DATA_FILE.test('docs/bendito-helferplan-2026-11-02 (1).json'), 'Kopie der Sicherung wird nicht erkannt');
});

test('kein Schlüssel mit Dienstrechten in irgendeiner Datei', () => {
  const hits = [];
  for (const f of textFiles) {
    for (const m of read(f).matchAll(/eyJ[A-Za-z0-9_-]{10,}\.(eyJ[A-Za-z0-9_-]{10,})\.[A-Za-z0-9_-]+/g)) {
      let role = '';
      try { role = JSON.parse(Buffer.from(m[1], 'base64url').toString('utf8')).role || ''; } catch { role = '?'; }
      if (role !== 'anon') hits.push(f + ': Token mit Rolle „' + role + '“');
    }
    if (SECRET_KEY.test(read(f))) hits.push(f + ': geheimer Schlüssel');
  }
  assert.deepEqual(hits, []);
});

test('index.html: Content-Security-Policy, keine Inline-Skripte, nur eigene Dateien', () => {
  const html = read('index.html');
  const m = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/);
  assert.ok(m, 'CSP fehlt');
  const csp = Object.fromEntries(m[1].split(';').map((d) => d.trim().split(/\s+/)).map(([k, ...v]) => [k, v.join(' ')]));
  assert.equal(csp['default-src'], "'none'");
  assert.equal(csp['script-src'], "'self'");
  assert.equal(csp['style-src'], "'self'");
  assert.equal(csp['img-src'], "'self' data:");
  assert.equal(csp['base-uri'], "'none'");
  assert.equal(csp['form-action'], "'none'");
  assert.ok(!/unsafe-inline|unsafe-eval|\*/.test(m[1]), 'CSP ist aufgeweicht');
  assert.match(html, /<meta name="robots" content="noindex/);
  assert.ok(!/<script(?![^>]*\bsrc=)[^>]*>/.test(html), 'Inline-Skript gefunden');
  assert.ok(!/<style[\s>]/.test(html) && !/\sstyle="/.test(html), 'Inline-Stil gefunden');
  assert.ok(!/\son[a-z]+="/.test(html), 'Inline-Ereignis gefunden');
  for (const s of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    assert.ok(!/^(https?:)?\/\//.test(s[1]), 'fremde Adresse: ' + s[1]);
  }
});

test('config.js und CSP zeigen auf dasselbe Projekt; nur der anon-Schlüssel', () => {
  const cfg = read('config.js');
  const url = (cfg.match(/supabaseUrl:\s*'([^']*)'/) || [])[1];
  const key = (cfg.match(/supabaseAnonKey:\s*'([^']*)'/) || [])[1];
  const connect = (read('index.html').match(/connect-src ([^;"]+)/) || [])[1];
  assert.notEqual(url, undefined);
  if (url === '') {
    assert.equal(key, '');
    assert.equal(connect.trim(), "'none'");
  } else {
    const hosted = /^https:\/\/[a-z0-9]{20}\.supabase\.co$/;
    const ownHost = /^https:\/\/[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;
    assert.ok(hosted.test(url) || ownHost.test(url), 'Adresse ist kein erlaubter Hostname');
    assert.equal(connect.trim(), url);
    if (key.startsWith('eyJ')) {
      assert.equal(JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString('utf8')).role, 'anon');
    } else {
      assert.match(key, /^sb_publishable_/);
    }
  }
});

test('vendor: Prüfsummen stimmen, keine weiteren Dateien', () => {
  const lines = read('vendor/CHECKSUMS.txt').trim().split('\n').map((l) => l.trim().split(/\s+/));
  assert.equal(lines.length, 4);
  for (const [sum, name] of lines) {
    const actual = createHash('sha256').update(readFileSync(path.join(root, 'vendor', name))).digest('hex');
    assert.equal(actual, sum, name);
  }
  const listed = lines.map((l) => l[1]).sort();
  const present = readdirSync(path.join(root, 'vendor')).filter((f) => f.endsWith('.js')).sort();
  assert.deepEqual(present, listed);
});

test('app.js: gültige Syntax, kein eval, kein new Function', () => {
  const out = spawnSync(process.execPath, ['--check', path.join(root, 'app.js')], { encoding: 'utf8' });
  assert.equal(out.status, 0, out.stderr);
  const js = read('app.js');
  assert.ok(!/\beval\s*\(/.test(js), 'eval gefunden');
  assert.ok(!/new\s+Function\s*\(/.test(js), 'new Function gefunden');
  assert.ok(!/document\.write|innerHTML\s*=|insertAdjacentHTML|outerHTML\s*=/.test(js), 'direkte HTML-Zuweisung gefunden');
});

test('app.js: dangerouslySetInnerHTML nur an den zwei bekannten Stellen mit festen Texten', () => {
  const js = read('app.js');
  const uses = [...js.matchAll(/dangerouslySetInnerHTML=\$\{\{__html:\s*([^}]+)\}\}/g)].map((m) => m[1].trim());
  assert.deepEqual(uses.sort(), ["gst(dlg.key).info || 'Keine weiteren Infos verfügbar.'", 'ht.body']);
  assert.equal((js.match(/dangerouslySetInnerHTML/g) || []).length, 3, 'eine dritte Stelle oder der Kommentar fehlt');
  // ST und HOWTOS sind Konstanten und werden nirgends verändert.
  assert.ok(!/\bST\[[^\]]+\]\s*=|\bST\.\w+\s*=|HOWTOS\.(push|splice|unshift)|HOWTOS\[[^\]]+\]\s*=/.test(js), 'ST oder HOWTOS wird verändert');
});

test('app.js: im Browser bleiben nur Sitzung und Anzeige-Vorlieben', () => {
  const js = read('app.js');
  const keys = [...js.matchAll(/localStorage\.(?:setItem|getItem)\(\s*'([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(keys)], ['hp-prefs']);
  assert.ok(!/sessionStorage|indexedDB|document\.cookie/.test(js), 'weiterer Speicher im Browser');
  assert.match(js, /storageKey: 'hp-auth'/);
  // Kein Abruf an fremde Adressen: fetch nur zur Edge Function des eigenen Projekts.
  const fetches = [...js.matchAll(/fetch\(([^,)]+)/g)].map((m) => m[1].trim());
  assert.deepEqual(fetches, ["CFG.supabaseUrl + '/functions/v1/hp-login'"]);
  assert.ok(!/https?:\/\/[a-z0-9]/i.test(js), 'feste Adresse im Code');
});

test('Version steht überall gleich', () => {
  const v = (read('config.js').match(/version:\s*'([^']+)'/) || [])[1];
  assert.match(v, /^\d+\.\d+\.\d+$/);
  const html = read('index.html');
  for (const m of html.matchAll(/\?v=([0-9.]+)/g)) assert.equal(m[1], v);
  assert.match(read('CHANGELOG.md'), new RegExp('^## ' + v.replace(/\./g, '\\.'), 'm'));
});

test('.gitignore hält Datendateien fern', () => {
  const gi = read('.gitignore').split('\n').map((l) => l.trim());
  for (const p of ['*.csv', '*.xlsx', '*.pdf', '*.env', '.DS_Store', 'node_modules/', 'test-results/', 'bendito-helferplan-*.json']) assert.ok(gi.includes(p), p);
});

test('Migrationen: jede Funktion mit leerem search_path, keine offene Policy', () => {
  const dir = 'supabase/migrations';
  let fns = 0;
  for (const f of readdirSync(path.join(root, dir)).sort()) {
    const sql = read(path.join(dir, f));
    assert.ok(!/using\s*\(\s*true\s*\)/i.test(sql), f + ': offene Policy');
    assert.ok(!/grant\s+[^;]*\bto\s+(public|anon)\b/i.test(sql), f + ': Recht für anon oder public');
    for (const m of sql.matchAll(/create or replace function (public\.hp_\w+|hp_private\.\w+)\s*\(([\s\S]*?)\n\$\$;/g)) {
      fns += 1;
      assert.match(m[0], /set search_path = ''/, f + ': ' + m[1] + ' ohne festen search_path');
    }
    // Jede Funktion gehört in eines der beiden Schemata, nie in ein anderes.
    for (const m of sql.matchAll(/create (?:or replace )?function\s+([\w.]+)/g)) {
      assert.match(m[1], /^(public\.hp_\w+|hp_private\.\w+)$/, f + ': Funktion an unerwartetem Ort: ' + m[1]);
    }
  }
  assert.ok(fns >= 35, 'nur ' + fns + ' Funktionen gefunden');
});

test('Edge Function: keine Geheimnisse im Quelltext, keine Codes im Log', () => {
  const ts = read('supabase/functions/hp-login/index.ts');
  assert.ok(!/eyJ[A-Za-z0-9_-]{20,}/.test(ts), 'Token im Quelltext');
  for (const m of ts.matchAll(/console\.(log|error|warn)\(([^)]*)\)/g)) {
    assert.match(m[2], /^"[^"$]*"$/, 'Log mit Variable: ' + m[0]);
  }
  assert.match(ts, /Deno\.env\.get\("SUPABASE_SERVICE_ROLE_KEY"\)/);
  // Die Funktion ist der Login selbst: ohne JWT-Prüfung des Gateways bereitstellen.
  assert.match(read('supabase/config.toml'), /\[functions\.hp-login\]\s*\nverify_jwt = false/);
});

test('app.js: abgelaufenes Token wird einmal erneuert, überholte Abrufe werden verworfen', () => {
  const js = read('app.js');
  assert.match(js, /e\.status !== 401/);
  assert.equal((js.match(/refreshSession\(\)/g) || []).length, 1);
  assert.match(js, /seq !== live\.current\.seq/);
  assert.match(js, /refresh\(true\)/);
});

test('Testdaten sind synthetisch', () => {
  const seed = read('supabase/tests/seed_test_helpers.sql');
  const names = [...seed.matchAll(/\('([^']+)', '#/g)].map((m) => m[1]);
  assert.deepEqual(names, ['Test Anna', 'Test Ben', 'Test Cleo']);
});
