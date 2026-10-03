#!/usr/bin/env node
// Schranke vor der Veröffentlichung. Das Repository ist öffentlich, deshalb gilt:
// keine Personendaten und keine Geheimnisse, auch nicht in der Historie.
//
// Prüft die versionierten Dateien UND die gesamte Historie auf
//   * verbotene Zeichenketten und geheime Schlüssel,
//   * Datendateien (.csv, .xlsx, .pdf, .env),
//   * die Helfernamen, das Orga-Passwort und die Tabellen-Kennung aus dem Altstand.
// Die Werte aus dem Altstand werden zur Laufzeit lokal gelesen und nie ausgegeben:
// gemeldet wird nur, ob und wo es einen Treffer gibt.
//
// Aufruf im Repository:  node tests/prepublish-check.mjs
// Altdatei an anderem Ort: HP_ALTDATEI=/pfad/zur/alten.html node tests/prepublish-check.mjs
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { FORBIDDEN, SECRET_KEY, DATA_FILE } from './forbidden.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const oldFile = process.env.HP_ALTDATEI || path.resolve(root, '..', 'bendito helfer orga', 'bendito-helferplan.html');
const problems = [];

function git(args) {
  const out = spawnSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 });
  if (out.status !== 0) { console.error('git ' + args.join(' ') + ' fehlgeschlagen:\n' + out.stderr); process.exit(2); }
  return out.stdout;
}

// ---------------------------------------------------------------- Werte aus dem Altstand
if (!existsSync(oldFile)) {
  console.error('Altdatei nicht gefunden: ' + oldFile + '\nOhne sie ist die Namensprüfung nicht möglich. Pfad mit HP_ALTDATEI angeben.');
  process.exit(2);
}
const old = readFileSync(oldFile, 'utf8');
const block = (old.match(/var HELPERS0=\[([\s\S]*?)\n\s*\];/) || [])[1] || '';
const names = [...block.matchAll(/name:'([^']+)'/g)].map((m) => m[1].trim()).filter((n) => n.length >= 3);
const skipped = [...block.matchAll(/name:'([^']+)'/g)].length - names.length;
if (names.length < 5) { console.error('Im Altstand wurden nur ' + names.length + ' Namen gefunden. Prüfung abgebrochen.'); process.exit(2); }
const secrets = [];
for (const [id, label] of [[FORBIDDEN[0], 'Orga-Passwort'], [FORBIDDEN[1], 'Tabellen-Kennung']]) {
  const m = old.match(new RegExp('var ' + id + "\\s*=\\s*'([^']{4,})'"));
  if (m) secrets.push({ value: m[1], label });
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const nameRes = names.map((n) => new RegExp('(?<![\\p{L}\\p{N}])' + esc(n) + '(?![\\p{L}\\p{N}])', 'iu'));
// Synthetische Testhelfer heißen immer „Test <Name>“ und zählen nicht als echte Namen.
const maskSynthetic = (line) => line.replace(/Test \p{Lu}\p{L}+( [A-Z]\b)?/gu, 'Test _');

function scan(text, where) {
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    for (const s of FORBIDDEN) if (raw.includes(s)) problems.push(where(i) + ': verbotene Zeichenkette');
    if (SECRET_KEY.test(raw)) problems.push(where(i) + ': geheimer Schlüssel');
    for (const m of raw.matchAll(/eyJ[A-Za-z0-9_-]{10,}\.(eyJ[A-Za-z0-9_-]{10,})\.[A-Za-z0-9_-]+/g)) {
      let role = '?';
      try { role = JSON.parse(Buffer.from(m[1], 'base64url').toString('utf8')).role || '?'; } catch { /* kein lesbares Token */ }
      if (role !== 'anon') problems.push(where(i) + ': Token mit anderen als anon-Rechten');
    }
    for (const sec of secrets) if (raw.includes(sec.value)) problems.push(where(i) + ': ' + sec.label + ' aus dem Altstand');
    const masked = maskSynthetic(raw);
    if (nameRes.some((re) => re.test(masked))) problems.push(where(i) + ': Name aus dem Altstand');
  }
}

// ---------------------------------------------------------------- versionierte Dateien
const tracked = git(['ls-files', '-z']).split('\0').filter(Boolean);
for (const f of tracked) {
  if (DATA_FILE.test(f)) problems.push(f + ': Datendatei im Repository');
  if (/\.(png|jpg|jpeg|gif|ico|woff2?)$/i.test(f)) continue;
  if (f.startsWith('vendor/') && f.endsWith('.js')) continue; // fremde Bibliotheken, per Prüfsumme gesichert
  scan(readFileSync(path.join(root, f), 'utf8'), (i) => f + ':' + (i + 1));
}

// ---------------------------------------------------------------- Historie
const everNamed = new Set(git(['log', '--all', '--name-only', '--pretty=format:']).split('\n').filter(Boolean));
for (const f of everNamed) if (DATA_FILE.test(f)) problems.push('Historie: Datendatei ' + f);
const log = git(['log', '--all', '-p', '--no-color', '--no-ext-diff', '--', '.', ':(exclude)vendor/*.js']);
let commit = '?';
const logLines = log.split('\n');
const perCommit = new Map();
for (const line of logLines) {
  const c = line.match(/^commit ([0-9a-f]{7,40})/);
  if (c) { commit = c[1].slice(0, 7); continue; }
  if (!perCommit.has(commit)) perCommit.set(commit, []);
  perCommit.get(commit).push(line);
}
for (const [c, lines] of perCommit) scan(lines.join('\n'), () => 'Historie, Commit ' + c);

// ---------------------------------------------------------------- Ergebnis
const unique = [...new Set(problems)];
console.log('Versionierte Dateien: ' + tracked.length + ' · Commits: ' + perCommit.size + ' · Namen aus dem Altstand geprüft: ' + names.length +
  (skipped ? ' (' + skipped + ' zu kurz, übersprungen)' : '') + ' · weitere Werte: ' + secrets.map((s) => s.label).join(', '));
if (unique.length) {
  console.log('\nNICHT VERÖFFENTLICHEN. ' + unique.length + ' Treffer:');
  for (const p of unique.slice(0, 60)) console.log('  ' + p);
  process.exit(1);
}
console.log('Schranke grün: keine verbotenen Zeichenketten, keine Datendateien, keine Namen oder Geheimnisse aus dem Altstand.');
