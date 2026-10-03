// SQL-Tests gegen eine lokale Postgres mit Supabase-Nachbau.
// Vorbereitung: tests/local/db-reset.sh  (legt die Datenbank hp_test an)
// Aufruf:       node --test tests/sql.test.mjs
// Ohne erreichbare Datenbank werden die Tests übersprungen, nicht bestanden.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DB = process.env.HP_PGDATABASE || 'hp_test';

function psql(args, input) {
  return spawnSync('psql', ['-X', '-v', 'ON_ERROR_STOP=1', '-d', DB, ...args], { cwd: root, encoding: 'utf8', input });
}

const probe = psql(['-Atc', "select count(*) from public.hp_shifts"]);
const available = probe.status === 0;
const skip = available ? false : 'keine lokale Testdatenbank (tests/local/db-reset.sh)';

function runSuite(file) {
  const out = psql(['-f', file]);
  const text = out.stderr + out.stdout;
  const m = text.match(/HP_TEST_RESULTS (\[.*\])/);
  assert.ok(m, 'kein Ergebnis in der Ausgabe:\n' + text.slice(0, 2000));
  return JSON.parse(m[1]);
}

for (const [name, file, expected] of [
  ['Tauschtests', 'supabase/tests/t_swaps.sql', ['T1', 'T2', 'T3', 'T4', 'T5', 'T5b', 'T6', 'T6b', 'T7', 'T8', 'T9', 'T10', 'T10b']],
  ['Rechtetests', 'supabase/tests/t_rights.sql', Array.from({ length: 17 }, (_, i) => 'R' + (i + 1))],
]) {
  test(name, { skip }, async (t) => {
    const results = runSuite(file);
    assert.deepEqual(results.map((r) => r.t), expected, 'Fälle fehlen oder sind zu viel');
    for (const r of results) {
      await t.test(r.t, () => assert.ok(r.ok, r.err || 'rot'));
    }
  });
}

test('Tests hinterlassen keine Daten', { skip }, () => {
  const out = psql(['-Atc',
    "select (select count(*) from public.hp_helpers) || '|' || (select count(*) from public.hp_swaps) || '|' || " +
    "(select count(*) from public.hp_shifts where id like 'z%') || '|' || (select count(*) from auth.users)"]);
  assert.equal(out.stdout.trim(), '0|0|0|0');
});

// Zwei Sitzungen nehmen denselben Tausch gleichzeitig an. Die erste hält ihre
// Transaktion offen; die zweite muss warten und darf danach nichts mehr ändern.
test('T3c gleichzeitige Annahme in zwei Sitzungen', { skip }, async () => {
  const setup = psql(['-At'], `
    insert into auth.users (id, email) values
      ('00000000-0000-4000-8000-0000000000a1', 'hp-c-a@helfer.bendito.invalid'),
      ('00000000-0000-4000-8000-0000000000b1', 'hp-c-b@helfer.bendito.invalid');
    insert into public.hp_helpers (id, display_name, is_test, auth_user_id) values
      ('00000000-0000-4000-8000-00000000000a', 'Test Anna C', true, '00000000-0000-4000-8000-0000000000a1'),
      ('00000000-0000-4000-8000-00000000000b', 'Test Ben C', true, '00000000-0000-4000-8000-0000000000b1');
    insert into public.hp_shifts (id, day, type_key, start_time, duration_min, capacity, sort) values
      ('zc1', 'fri', 'bar', '17:30', 90, 1, 9201), ('zc2', 'fri', 'bar', '19:00', 90, 1, 9202);
    insert into public.hp_assignments (shift_id, helper_id) values
      ('zc1', '00000000-0000-4000-8000-00000000000a'), ('zc2', '00000000-0000-4000-8000-00000000000b');
    update public.hp_settings set value = 'null'::jsonb where key = 'swaps_lock_at';
    select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1"}', false);
    select public.hp_swap_request('zc1', 'zc2', '') ->> 'id';
  `);
  try {
    assert.equal(setup.status, 0, setup.stderr);
    const id = setup.stdout.trim().split('\n').pop();
    const claimB = `select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b1"}', false);`;
    const run = (sql) => new Promise((resolve) => {
      const p = spawn('psql', ['-X', '-At', '-d', DB], { cwd: root });
      let out = '';
      p.stdout.on('data', (d) => (out += d));
      p.stderr.on('data', (d) => (out += d));
      p.on('close', () => resolve(out));
      p.stdin.end(sql);
    });
    const first = run(`${claimB} begin; select 'A:' || public.hp_swap_accept(${id})::text; select pg_sleep(1.5); commit;`);
    await new Promise((r) => setTimeout(r, 400));
    const started = Date.now();
    const second = await run(`${claimB} select 'B:' || public.hp_swap_accept(${id})::text;`);
    const waited = Date.now() - started;
    const firstOut = await first;
    assert.match(firstOut, /A:\{"ok": true/, 'erste Sitzung: ' + firstOut);
    assert.match(second, /B:\{"ok": false, "code": "SWAP_STALE"\}/, 'zweite Sitzung: ' + second);
    assert.ok(waited > 700, 'zweite Sitzung hat nicht gewartet (' + waited + ' ms)');
    const state = psql(['-Atc', "select string_agg(shift_id || ':' || right(helper_id::text, 1), ',' order by shift_id) from public.hp_assignments where shift_id like 'zc%'"]);
    assert.equal(state.stdout.trim(), 'zc1:b,zc2:a');
    const notes = psql(['-Atc', "select count(*) from public.hp_notifications where kind = 'swap_accepted'"]);
    assert.equal(notes.stdout.trim(), '2');
  } finally {
    psql(['-At'], `
      delete from public.hp_helpers where id in ('00000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-00000000000b');
      delete from public.hp_shifts where id in ('zc1', 'zc2');
      delete from auth.users where email in ('hp-c-a@helfer.bendito.invalid', 'hp-c-b@helfer.bendito.invalid');
      delete from public.hp_audit where true;
      update public.hp_settings set value = '"2026-10-29T20:00:00+01:00"'::jsonb where key = 'swaps_lock_at';
    `);
  }
});
