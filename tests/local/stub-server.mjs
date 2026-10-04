// Lokaler Nachbau der Supabase-Schnittstellen, nur für Tests.
//
// Liefert die App aus (mit lokaler config.js und angepasster CSP) und bildet auf
// derselben Adresse nach, was die App und die Edge Function von Supabase
// brauchen: /rest/v1/rpc (gegen die lokale Postgres), /auth/v1 (Sitzungen,
// Einmal-Token, Admin-Aufrufe) und /functions/v1/hp-login (die echte
// Funktionsdatei, ausgeführt mit Deno).
//
// Kein Paket nötig: node:http, psql und deno.
// Aufruf: node tests/local/stub-server.mjs   (PGHOST/PGPORT/PGUSER wie üblich)
import http from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import crypto from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PORT = Number(process.env.HP_STUB_PORT || 4173);
const FN_PORT = Number(process.env.HP_STUB_FN_PORT || 4174);
const DB = process.env.HP_PGDATABASE || 'hp_e2e';
const ANON = 'local-anon-key';
const SERVICE = 'local-service-key';
const ORIGIN = `http://127.0.0.1:${PORT}`;

const tokens = new Map();   // access_token → { userId, exp }
const refresh = new Map();  // refresh_token → userId
const otps = new Map();     // hashed_token → userId
let accessTtl = 3600;

function psql(script, vars = {}) {
  const args = ['-X', '-q', '-At', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose', '-d', DB];
  for (const [k, v] of Object.entries(vars)) args.push('-v', `${k}=${v}`);
  const out = spawnSync('psql', args, { input: script, encoding: 'utf8' });
  if (out.status !== 0) {
    const m = (out.stderr || '').match(/ERROR:\s+([0-9A-Z]{5}):\s+(.*)/);
    const err = new Error(m ? m[2] : (out.stderr || 'psql fehlgeschlagen').trim());
    err.sqlstate = m ? m[1] : 'XX000';
    throw err;
  }
  return out.stdout.trim();
}

// Signaturen aller hp_-Funktionen, damit benannte Argumente typgerecht übergeben werden.
function loadFunctions() {
  const rows = psql(`select p.proname || '|' || coalesce(array_to_string(p.proargnames, ','), '') || '|' ||
      coalesce(array_to_string(array(select format_type(t, null) from unnest(p.proargtypes) t), ','), '')
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'hp\\_%';`);
  const map = new Map();
  for (const line of rows.split('\n').filter(Boolean)) {
    const [name, names, types] = line.split('|');
    const n = names ? names.split(',') : [];
    const t = types ? types.split(',') : [];
    map.set(name, Object.fromEntries(n.map((x, i) => [x, t[i]])));
  }
  return map;
}
const fns = loadFunctions();

function argExpr(key, type) {
  const j = `(:'args'::jsonb -> '${key}')`;
  const txt = `(:'args'::jsonb ->> '${key}')`;
  switch (type) {
    case 'text': return txt;
    case 'uuid': return `${txt}::uuid`;
    case 'boolean': return `${txt}::boolean`;
    case 'integer': return `${txt}::integer`;
    case 'bigint': return `${txt}::bigint`;
    // Wie die Daten-API: Ein JSON-null wird zu SQL-NULL, auch bei jsonb-Argumenten.
    case 'jsonb': return `nullif(${j}, 'null'::jsonb)`;
    case 'text[]': return `(case when jsonb_typeof${j} = 'array' then array(select jsonb_array_elements_text${j}) end)`;
    case 'bigint[]': return `(case when jsonb_typeof${j} = 'array' then array(select x::bigint from jsonb_array_elements_text${j} x) end)`;
    default: throw new Error('Typ nicht unterstützt: ' + type);
  }
}

function callRpc(name, body, role, sub) {
  const sig = fns.get(name);
  if (!sig) { const e = new Error('Funktion nicht gefunden'); e.http = 404; throw e; }
  const parts = [];
  for (const key of Object.keys(body || {})) {
    if (!/^[a-z_]+$/.test(key) || !(key in sig)) { const e = new Error('unbekanntes Argument ' + key); e.http = 404; throw e; }
    parts.push(`${key} => ${argExpr(key, sig[key])}`);
  }
  const claims = JSON.stringify(sub ? { sub, role } : { role });
  const script = `begin;
set local role ${role};
\\o /dev/null
select set_config('request.jwt.claims', :'claims', true);
\\o
select coalesce(to_jsonb(public.${name}(${parts.join(', ')}))::text, 'null');
commit;
`;
  return psql(script, { claims, args: JSON.stringify(body || {}) });
}

function b64url(obj) { return Buffer.from(JSON.stringify(obj)).toString('base64url'); }

function userRow(where, value) {
  const out = psql(`select row_to_json(u)::text from (select id, email, created_at from auth.users where ${where} = :'v') u;`, { v: value });
  return out ? JSON.parse(out) : null;
}
function userJson(u) {
  return { id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email, email_confirmed_at: u.created_at,
    app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {}, identities: [], created_at: u.created_at, updated_at: u.created_at };
}
function newSession(u) {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + accessTtl;
  const access = [b64url({ alg: 'HS256', typ: 'JWT' }),
    b64url({ sub: u.id, role: 'authenticated', aud: 'authenticated', email: u.email, iat: now, exp, session_id: crypto.randomUUID() }),
    crypto.randomBytes(16).toString('base64url')].join('.');
  const rt = crypto.randomBytes(12).toString('base64url');
  tokens.set(access, { userId: u.id, exp });
  refresh.set(rt, u.id);
  return { access_token: access, token_type: 'bearer', expires_in: accessTtl, expires_at: exp, refresh_token: rt, user: userJson(u) };
}

function bearer(req) { return (req.headers.authorization || '').replace(/^Bearer\s+/i, ''); }
function send(res, status, body, headers = {}) {
  const data = body === undefined ? '' : (typeof body === 'string' ? body : JSON.stringify(body));
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers });
  res.end(data);
}
async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const text = Buffer.concat(chunks).toString('utf8');
  if (!text) return {};
  try { return JSON.parse(text); } catch { return {}; }
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8' };
const STATIC = /^\/(index\.html|app\.js|styles\.css|config\.js|assets\/[a-z0-9.-]+|vendor\/[a-zA-Z0-9.-]+)$/;

async function serveStatic(res, pathname) {
  if (pathname === '/') pathname = '/index.html';
  if (!STATIC.test(pathname)) return send(res, 404, 'nicht gefunden', { 'Content-Type': 'text/plain' });
  const type = TYPES[path.extname(pathname)] || 'application/octet-stream';
  if (pathname === '/config.js') {
    const real = await readFile(path.join(root, 'config.js'), 'utf8');
    const version = (real.match(/version:\s*'([^']+)'/) || [])[1] || '';
    return send(res, 200, `window.HP_CONFIG = { version: '${version}', supabaseUrl: '${ORIGIN}', supabaseAnonKey: '${ANON}' };\n`, { 'Content-Type': type });
  }
  try {
    let data = await readFile(path.join(root, pathname));
    if (pathname === '/index.html') {
      // Dieselbe Policy wie ausgeliefert, nur das Verbindungsziel zeigt auf den Nachbau.
      const html = data.toString('utf8');
      const patched = html.replace(/(<meta http-equiv="Content-Security-Policy" content="[^"]*?)connect-src [^;"]+/, "$1connect-src 'self'");
      if (patched === html) return send(res, 500, 'CSP in index.html nicht gefunden', { 'Content-Type': 'text/plain' });
      data = Buffer.from(patched);
    }
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
    res.end(data);
  } catch {
    send(res, 404, 'nicht gefunden', { 'Content-Type': 'text/plain' });
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, ORIGIN);
  const p = url.pathname;
  try {
    // ---------------------------------------------------------------- Testhilfen
    if (p === '/__stub/expire-access-tokens' && req.method === 'POST') {
      for (const t of tokens.values()) t.exp = 0;
      return send(res, 200, { ok: true });
    }
    if (p === '/__stub/requests' && req.method === 'GET') return send(res, 200, { ok: true });

    // ---------------------------------------------------------------- PostgREST
    if (p.startsWith('/rest/v1/rpc/') && req.method === 'POST') {
      const name = p.slice('/rest/v1/rpc/'.length);
      const body = await readBody(req);
      const tok = bearer(req);
      let role = null, sub = null;
      if (tok === ANON) role = 'anon';
      else if (tok === SERVICE) role = 'service_role';
      else {
        const t = tokens.get(tok);
        if (!t || t.exp < Date.now() / 1000) return send(res, 401, { code: 'PGRST301', message: 'JWT expired' });
        role = 'authenticated'; sub = t.userId;
      }
      try {
        return send(res, 200, callRpc(name, body, role, sub));
      } catch (e) {
        if (e.http) return send(res, e.http, { code: 'PGRST202', message: e.message });
        const denied = e.sqlstate === '42501';
        return send(res, denied ? (role === 'anon' ? 401 : 403) : 400, { code: e.sqlstate, message: e.message, details: null, hint: null });
      }
    }
    if (p.startsWith('/rest/v1/')) {
      // Tabellen sind für Clients gesperrt; der Nachbau bietet sie gar nicht erst an.
      return send(res, 404, { code: 'PGRST205', message: 'not available in stub' });
    }

    // ---------------------------------------------------------------- Auth (Client)
    if (p === '/auth/v1/token' && req.method === 'POST') {
      const body = await readBody(req);
      const grant = url.searchParams.get('grant_type');
      if (grant === 'password') {
        const ok = psql(`select count(*) from auth.users where email = :'e' and encrypted_password = :'p';`, { e: String(body.email || ''), p: 'plain:' + String(body.password || '') });
        if (ok !== '1') return send(res, 400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
        return send(res, 200, newSession(userRow('email', String(body.email))));
      }
      if (grant === 'refresh_token') {
        const uid = refresh.get(String(body.refresh_token || ''));
        const u = uid ? userRow('id', uid) : null;
        if (!u) return send(res, 400, { code: 400, error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token: Refresh Token Not Found' });
        refresh.delete(String(body.refresh_token));
        return send(res, 200, newSession(u));
      }
      return send(res, 400, { code: 400, msg: 'unsupported grant' });
    }
    if (p === '/auth/v1/verify' && req.method === 'POST') {
      const body = await readBody(req);
      const uid = otps.get(String(body.token_hash || ''));
      const u = uid ? userRow('id', uid) : null;
      if (!u) return send(res, 403, { code: 403, error_code: 'otp_expired', msg: 'Token has expired or is invalid' });
      otps.delete(String(body.token_hash));
      return send(res, 200, newSession(u));
    }
    if (p === '/auth/v1/user') {
      const t = tokens.get(bearer(req));
      const u = t && t.exp >= Date.now() / 1000 ? userRow('id', t.userId) : null;
      if (!u) return send(res, 401, { code: 401, msg: 'invalid JWT' });
      if (req.method === 'PUT') {
        const body = await readBody(req);
        if (typeof body.password === 'string') {
          psql(`update auth.users set encrypted_password = :'p' where id = :'i';`, { p: 'plain:' + body.password, i: u.id });
        }
      }
      return send(res, 200, userJson(u));
    }
    if (p === '/auth/v1/logout' && req.method === 'POST') {
      tokens.delete(bearer(req));
      res.writeHead(204); return res.end();
    }

    // ---------------------------------------------------------------- Auth (Admin, nur service_role)
    if (p.startsWith('/auth/v1/admin/')) {
      if (bearer(req) !== SERVICE) return send(res, 401, { code: 401, msg: 'not admin' });
      if (p === '/auth/v1/admin/users' && req.method === 'POST') {
        const body = await readBody(req);
        const id = crypto.randomUUID();
        const meta = JSON.stringify({ provider: 'email', providers: ['email'], ...(body.app_metadata || {}) });
        psql(`insert into auth.users (id, email, raw_app_meta_data, created_at) values (:'i', :'e', :'m'::jsonb, now());`, { i: id, e: String(body.email), m: meta });
        return send(res, 200, userJson(userRow('id', id)));
      }
      const m = p.match(/^\/auth\/v1\/admin\/users\/([0-9a-f-]{36})$/);
      if (m && req.method === 'GET') {
        const u = userRow('id', m[1]);
        return u ? send(res, 200, userJson(u)) : send(res, 404, { code: 404, error_code: 'user_not_found', msg: 'User not found' });
      }
      if (m && req.method === 'DELETE') {
        psql(`delete from auth.users where id = :'i';`, { i: m[1] });
        return send(res, 200, {});
      }
      if (p === '/auth/v1/admin/generate_link' && req.method === 'POST') {
        const body = await readBody(req);
        const u = userRow('email', String(body.email || ''));
        if (!u) return send(res, 404, { code: 404, error_code: 'user_not_found', msg: 'User not found' });
        const hashed = crypto.randomBytes(28).toString('hex');
        otps.set(hashed, u.id);
        return send(res, 200, { ...userJson(u), action_link: '', email_otp: '000000', hashed_token: hashed, redirect_to: '', verification_type: 'magiclink' });
      }
      return send(res, 404, { code: 404, msg: 'not found' });
    }

    // ---------------------------------------------------------------- Edge Function (echte Datei, mit Deno)
    if (p === '/functions/v1/hp-login') {
      const body = req.method === 'POST' ? JSON.stringify(await readBody(req)) : undefined;
      const fwd = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
      const r = await fetch(`http://127.0.0.1:${FN_PORT}/`, {
        method: req.method,
        headers: { 'content-type': 'application/json', 'x-forwarded-for': String(fwd), origin: req.headers.origin || ORIGIN },
        body,
      });
      const text = await r.text();
      res.writeHead(r.status, { 'Content-Type': r.headers.get('content-type') || 'application/json', 'Cache-Control': 'no-store' });
      return res.end(text);
    }

    if (req.method === 'GET') return serveStatic(res, p);
    send(res, 405, { message: 'method' });
  } catch (e) {
    send(res, 500, { message: 'stub: ' + e.message });
  }
});

// Die echte Funktionsdatei, mit denselben Umgebungsvariablen wie bei Supabase.
const deno = spawn('deno', ['run', '--allow-net=127.0.0.1', '--allow-env', path.join(root, 'supabase/functions/hp-login/index.ts')], {
  env: { ...process.env, SUPABASE_URL: ORIGIN, SUPABASE_SERVICE_ROLE_KEY: SERVICE, DENO_SERVE_ADDRESS: `tcp:127.0.0.1:${FN_PORT}`, NO_COLOR: '1' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
deno.stdout.on('data', (d) => process.stdout.write('[fn] ' + d));
deno.stderr.on('data', (d) => process.stderr.write('[fn] ' + d));
deno.on('exit', (c) => { if (c) console.error('Deno beendet mit Code', c); });

server.listen(PORT, '127.0.0.1', () => console.log(`Nachbau läuft auf ${ORIGIN} (Datenbank ${DB}, ${fns.size} Funktionen)`));
function stop() { try { deno.kill(); } catch {} server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 500).unref(); }
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
