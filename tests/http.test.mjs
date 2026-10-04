// HTTP-Tests gegen den lokalen Nachbau: die Login-Funktion mit ihren Fehlerwegen,
// die Begrenzung der Fehlversuche, abgelaufene Token und der leere Wert bei den
// Einstellungen – jeweils so, wie der Browser sie aufruft.
//
// Startet einen eigenen Nachbau auf eigenen Ports mit eigener Datenbank
// (hp_http), damit die anderen Tests unberührt bleiben.
// Aufruf: node --test tests/http.test.mjs      (PGHOST/PGPORT/PGUSER wie üblich)
// Ohne lokale Postgres oder ohne Deno werden die Tests übersprungen.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 4183, FN_PORT = 4184, DB = 'hp_http';
const BASE = `http://127.0.0.1:${PORT}`;
const FN = `http://127.0.0.1:${FN_PORT}/`;
const PAGES = 'https://benditot.github.io';
const EXTRA = 'https://helfer.example.org';
const ANON = 'local-anon-key';

const hasDb = spawnSync('psql', ['-X', '-d', 'postgres', '-Atc', 'select 1'], { encoding: 'utf8' }).status === 0;
const hasDeno = spawnSync('deno', ['--version'], { encoding: 'utf8' }).status === 0;
const skip = hasDb && hasDeno ? false : 'keine lokale Postgres oder kein Deno';

let stub = null;
let adminToken = '';

async function up(url, init) {
  for (let i = 0; i < 80; i++) {
    try { await fetch(url, init); return true; } catch { await new Promise((r) => setTimeout(r, 250)); }
  }
  return false;
}
const json = (r) => r.json().catch(() => null);
function login(body, ip, raw) {
  return fetch(BASE + '/functions/v1/hp-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip || 'http-test-standard' },
    body: raw !== undefined ? raw : JSON.stringify(body),
  });
}
function rpc(name, body, token) {
  return fetch(BASE + '/rest/v1/rpc/' + name, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: ANON, Authorization: 'Bearer ' + token },
    body: JSON.stringify(body || {}),
  });
}
async function password() {
  const r = await fetch(BASE + '/auth/v1/token?grant_type=password', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'orga@test.invalid', password: 'lokal-orga-passwort' }),
  });
  assert.equal(r.status, 200);
  return r.json();
}
async function verify(tokenHash) {
  return fetch(BASE + '/auth/v1/verify', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token_hash: tokenHash, type: 'magiclink' }),
  });
}
async function newHelperWithCode(name) {
  const made = await json(await rpc('hp_admin_upsert_helper', {
    p_id: null, p_name: name, p_color: '#112233', p_contact: '', p_setup: false, p_target: null, p_is_test: true,
  }, adminToken));
  assert.equal(made.ok, true, JSON.stringify(made));
  const code = await json(await rpc('hp_admin_new_login_code', { p_helper: made.id }, adminToken));
  assert.match(code.code, /^[0-9a-f]{64}$/);
  return { id: made.id, code: code.code };
}

before(async () => {
  if (skip) return;
  const prep = spawnSync('bash', ['tests/local/e2e-prepare.sh', DB], { cwd: root, encoding: 'utf8' });
  assert.equal(prep.status, 0, prep.stderr);
  stub = spawn(process.execPath, ['tests/local/stub-server.mjs'], {
    cwd: root,
    env: { ...process.env, HP_STUB_PORT: String(PORT), HP_STUB_FN_PORT: String(FN_PORT), HP_PGDATABASE: DB, HP_ALLOWED_ORIGINS: EXTRA + ', http://unsicher.example.org, kaputt' },
    stdio: 'ignore',
  });
  assert.ok(await up(BASE + '/'), 'Nachbau startet nicht');
  assert.ok(await up(FN, { method: 'OPTIONS' }), 'Login-Funktion startet nicht');
  adminToken = (await password()).access_token;
});

after(() => { if (stub) stub.kill(); });

test('Login-Funktion: falsche Methode, kaputter Rumpf, unbekannter Code', { skip }, async () => {
  const get = await fetch(BASE + '/functions/v1/hp-login');
  assert.equal(get.status, 405);
  for (const [what, r] of [
    ['kaputter Rumpf', await login(null, 'http-a', 'kein json')],
    ['leerer Rumpf', await login(null, 'http-a', '')],
    ['Code ist kein Text', await login({ code: 12345 }, 'http-a')],
    ['falsches Format', await login({ code: 'zzz' }, 'http-a')],
    ['unbekannter Code', await login({ code: 'ab'.repeat(32) }, 'http-a')],
  ]) {
    assert.equal(r.status, 401, what);
    assert.deepEqual(await json(r), { error: 'invalid' }, what);
  }
});

test('Login-Funktion: erlaubte Herkünfte', { skip }, async () => {
  const acao = async (origin) => (await fetch(FN, { method: 'OPTIONS', headers: { origin } })).headers.get('access-control-allow-origin');
  assert.equal(await acao(PAGES), PAGES);
  assert.equal(await acao(EXTRA), EXTRA, 'Herkunft aus HP_ALLOWED_ORIGINS');
  assert.equal(await acao('http://127.0.0.1:4173'), 'http://127.0.0.1:4173');
  // Fremde Herkunft, unverschlüsselte Herkunft aus der Liste, kaputter Eintrag: nie zurückgespiegelt.
  for (const o of ['https://fremd.example.org', 'http://unsicher.example.org', 'kaputt', 'https://benditot.github.io.fremd.example.org',
    'http://localhost.fremd.example.org', 'http://127.0.0.1:4173.fremd.example.org', 'http://127.0.0.1.fremd.example.org:80', 'https://127.0.0.1']) {
    assert.equal(await acao(o), PAGES, o);
  }
  const pre = await fetch(FN, { method: 'OPTIONS', headers: { origin: PAGES } });
  assert.equal(pre.status, 204);
  assert.match(pre.headers.get('access-control-allow-methods'), /POST/);
});

test('Gültiger Code gibt eine Sitzung; zweites Gerät bekommt dasselbe Konto; Widerruf sperrt sofort', { skip }, async () => {
  const h = await newHelperWithCode('Test Dora H');
  const first = await login({ code: h.code }, 'http-b');
  assert.equal(first.status, 200);
  const body = await json(first);
  assert.deepEqual(Object.keys(body).sort(), ['token_hash', 'type']);
  const v1 = await verify(body.token_hash);
  assert.equal(v1.status, 200);
  const s1 = await v1.json();
  // Das Einmal-Token gilt genau einmal.
  assert.equal((await verify(body.token_hash)).status, 403);
  const state = await json(await rpc('hp_state', {}, s1.access_token));
  assert.equal(state.ctx.role, 'helper');
  assert.equal(state.ctx.helper_id, h.id);
  assert.ok(!JSON.stringify(state).includes(h.code), 'Code im Abruf');

  const second = await json(await login({ code: h.code }, 'http-c'));
  const s2 = await (await verify(second.token_hash)).json();
  assert.equal(s2.user.id, s1.user.id, 'zweites Gerät hat ein anderes Konto');

  // Helfer kommt weder an Orga- noch an Login-Funktionen.
  assert.equal((await rpc('hp_admin_purge', { p_confirm: 'LOESCHEN' }, s1.access_token)).status, 403);
  assert.equal((await rpc('hp_login_lookup', { p_code_hash: 'x', p_ip_hash: 'y' }, s1.access_token)).status, 403);

  const revoked = await json(await rpc('hp_admin_revoke_login', { p_helper: h.id }, adminToken));
  assert.equal(revoked.ok, true);
  const after = await login({ code: h.code }, 'http-b');
  assert.equal(after.status, 401);
  assert.equal((await rpc('hp_state', {}, s1.access_token)).status, 403, 'alte Sitzung hat noch Zugriff');
  assert.equal((await rpc('hp_state', {}, s2.access_token)).status, 403, 'zweites Gerät hat noch Zugriff');
});

test('Fehlversuche: nach zehn ist Schluss, ein gültiger Link geht trotzdem', { skip }, async () => {
  const h = await newHelperWithCode('Test Emil H');
  for (let i = 0; i < 10; i++) {
    const r = await login({ code: String(i).repeat(64).slice(0, 64).replace(/[^0-9a-f]/g, 'a') }, 'http-wlan');
    assert.equal(r.status, 401, 'Versuch ' + (i + 1));
  }
  const eleventh = await login({ code: 'cd'.repeat(32) }, 'http-wlan');
  assert.equal(eleventh.status, 429);
  assert.deepEqual(await json(eleventh), { error: 'rate_limited' });
  // Gleicher Absender (gemeinsames WLAN), gültiger Link: kommt durch.
  const valid = await login({ code: h.code }, 'http-wlan');
  assert.equal(valid.status, 200);
  // Anderer Absender ist nicht betroffen.
  assert.equal((await login({ code: 'ef'.repeat(32) }, 'http-woanders')).status, 401);
});

test('Einstellungen: leerer Wert kommt als SQL-NULL an und wird richtig behandelt', { skip }, async () => {
  const set = async (key, value) => json(await rpc('hp_admin_set_setting', { p_key: key, p_value: value }, adminToken));
  assert.deepEqual(await set('swaps_lock_at', '2031-01-01T09:00:00.000Z'), { ok: true });
  assert.deepEqual(await set('swaps_lock_at', null), { ok: true });
  const state = await json(await rpc('hp_state', {}, adminToken));
  assert.equal(state.settings.swaps_lock_at, null);
  assert.equal(state.settings.locked, false);
  for (const key of ['target_shifts', 'target_hours', 'swaps_locked', 'event_end', 'purge_after']) {
    assert.equal((await set(key, null)).code, 'INVALID_INPUT', key);
  }
});

test('Ohne Anmeldung kein Zugriff; abgelaufenes Token wird abgewiesen und lässt sich erneuern', { skip }, async () => {
  assert.equal((await rpc('hp_state', {}, ANON)).status, 401);
  assert.equal((await rpc('hp_my_context', {}, ANON)).status, 401);
  assert.equal((await rpc('hp_login_lookup', { p_code_hash: 'x', p_ip_hash: 'y' }, ANON)).status, 401);
  assert.equal((await rpc('hp_state', {}, 'frei-erfunden')).status, 401);

  const session = await password();
  assert.equal((await rpc('hp_state', {}, session.access_token)).status, 200);
  await fetch(BASE + '/__stub/expire-access-tokens', { method: 'POST' });
  assert.equal((await rpc('hp_state', {}, session.access_token)).status, 401);
  const renewed = await fetch(BASE + '/auth/v1/token?grant_type=refresh_token', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: session.refresh_token }),
  });
  assert.equal(renewed.status, 200);
  const next = await renewed.json();
  assert.equal((await rpc('hp_state', {}, next.access_token)).status, 200);
  adminToken = next.access_token;
});
