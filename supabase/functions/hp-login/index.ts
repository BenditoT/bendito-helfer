// Bendito Helferplan — Code-Login
//
// Nimmt den Code aus dem persönlichen Link entgegen und gibt, wenn er gilt,
// ein Einmal-Token zurück, das der Browser mit verifyOtp gegen eine echte
// Sitzung einlöst. Kein E-Mail-Versand, kein Passwort.
//
// Regeln:
//   * Unbekannter und widerrufener Code bekommen dieselbe Antwort (401 "invalid").
//   * Höchstens 10 Fehlversuche je Absender in 10 Minuten, danach 429.
//   * Ins Log gelangen weder Codes noch Namen noch Adressen.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const PAGES_ORIGIN = "https://benditot.github.io";
const HELPER_DOMAIN = "helfer.bendito.invalid";

function allowedOrigin(origin: string | null): string {
  if (origin && (origin === PAGES_ORIGIN || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))) {
    return origin;
  }
  return PAGES_ORIGIN;
}

function cors(origin: string | null): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": allowedOrigin(origin),
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "600",
  };
}

function json(status: number, body: unknown, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(origin), "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function hex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(text: string): Promise<string> {
  return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
}

async function hmacHex(key: string, text: string): Promise<string> {
  const k = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(text)));
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
  if (req.method !== "POST") return json(405, { error: "method" }, origin);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json(500, { error: "server" }, origin);

  let code = "";
  try {
    const body = await req.json();
    if (body && typeof body.code === "string") code = body.code;
  } catch (_e) {
    // leerer oder kaputter Rumpf zählt wie ein falscher Code
  }

  // Der Absender wird nur als Schlüssel-Hash gespeichert, nie als Adresse.
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unbekannt";
  const ipHash = (await hmacHex(serviceKey, "hp-login:" + ip)).slice(0, 32);
  const codeHash = /^[0-9a-f]{64}$/.test(code)
    ? await sha256Hex(code)
    : await sha256Hex("ungueltig:" + crypto.randomUUID());

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const look = await admin.rpc("hp_login_lookup", { p_code_hash: codeHash, p_ip_hash: ipHash });
  if (look.error || !look.data) {
    console.error("hp-login: lookup fehlgeschlagen");
    return json(500, { error: "server" }, origin);
  }
  const found = look.data as { ok: boolean; code?: string; helper_id?: string; auth_user_id?: string | null };
  if (!found.ok) {
    return found.code === "RATE_LIMITED"
      ? json(429, { error: "rate_limited" }, origin)
      : json(401, { error: "invalid" }, origin);
  }

  // Auth-Konto des Helfers holen oder beim ersten Login anlegen.
  let email: string | null = null;
  if (found.auth_user_id) {
    const u = await admin.auth.admin.getUserById(found.auth_user_id);
    if (!u.error && u.data?.user?.email) email = u.data.user.email;
  }
  if (!email) {
    const newEmail = `hp-${crypto.randomUUID()}@${HELPER_DOMAIN}`;
    const created = await admin.auth.admin.createUser({
      email: newEmail,
      email_confirm: true,
      app_metadata: { hp: "helper" },
    });
    if (created.error || !created.data?.user) {
      console.error("hp-login: Konto konnte nicht angelegt werden");
      return json(500, { error: "server" }, origin);
    }
    const newId = created.data.user.id;
    const bind = await admin.rpc("hp_login_bind", {
      p_helper: found.helper_id, p_code_hash: codeHash, p_user: newId,
    });
    const bound = (bind.data ?? null) as string | null;
    if (bind.error || !bound) {
      // Code wurde zwischen Prüfung und Bindung widerrufen.
      await admin.auth.admin.deleteUser(newId);
      return json(401, { error: "invalid" }, origin);
    }
    if (bound === newId) {
      email = newEmail;
    } else {
      // Zwei Geräte gleichzeitig: Das zuerst gebundene Konto gilt.
      await admin.auth.admin.deleteUser(newId);
      const u = await admin.auth.admin.getUserById(bound);
      if (u.error || !u.data?.user?.email) {
        console.error("hp-login: gebundenes Konto nicht lesbar");
        return json(500, { error: "server" }, origin);
      }
      email = u.data.user.email;
    }
  }

  const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const tokenHash = link.data?.properties?.hashed_token;
  if (link.error || !tokenHash) {
    console.error("hp-login: Einmal-Token konnte nicht erzeugt werden");
    return json(500, { error: "server" }, origin);
  }
  return json(200, { token_hash: tokenHash, type: "magiclink" }, origin);
});
