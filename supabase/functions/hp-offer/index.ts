// Bendito Helferplan — Mithilfe-Abfrage
//
// Nimmt die Rückmeldung aus dem Formular entgegen und legt sie über die
// Datenbankfunktion ab. Der Browser hat dafür kein Schreibrecht auf die
// Tabelle. Ins Log gelangen weder Namen noch Adressen noch der Inhalt.
//
// Bereitstellen mit verify_jwt = false (siehe supabase/config.toml): das
// Formular ist offen, der Schutz ist die Prüfung in der Datenbank und die
// Obergrenze je Absender. Mit eingeschalteter JWT-Prüfung würde das Gateway
// den öffentlichen Schlüssel abweisen, bevor die Funktion läuft.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const PAGES_ORIGIN = "https://benditot.github.io";

function allowedOrigins(): string[] {
  const extra = (Deno.env.get("HP_ALLOWED_ORIGINS") ?? "")
    .split(",").map((o) => o.trim().replace(/\/+$/, "")).filter((o) => /^https:\/\/[a-z0-9.-]+(:\d+)?$/.test(o));
  return [PAGES_ORIGIN, ...extra];
}

function allowedOrigin(origin: string | null): string {
  if (origin && (allowedOrigins().includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))) {
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

async function hmacHex(key: string, text: string): Promise<string> {
  const k = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(text)));
}

function field(body: Record<string, unknown>, key: string, max: number): string {
  const value = body[key];
  return typeof value === "string" ? value.slice(0, max) : "";
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
  if (req.method !== "POST") return json(405, { error: "method" }, origin);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json(500, { error: "server" }, origin);

  let body: Record<string, unknown> = {};
  try {
    const text = await req.text();
    if (text.length > 8000) return json(400, { ok: false, code: "INVALID_INPUT" }, origin);
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return json(400, { ok: false, code: "INVALID_INPUT" }, origin);
    }
    body = parsed as Record<string, unknown>;
  } catch (_e) {
    return json(400, { ok: false, code: "INVALID_INPUT" }, origin);
  }

  const ip = (req.headers.get("cf-connecting-ip") ?? req.headers.get("x-real-ip")
    ?? (req.headers.get("x-forwarded-for") ?? "").split(",")[0]).trim() || "unbekannt";
  const ipHash = (await hmacHex(serviceKey, "hp-offer:" + ip)).slice(0, 32);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const saved = await admin.rpc("hp_submit_help_offer", {
    p_name: field(body, "name", 100),
    p_email: field(body, "email", 140),
    p_phone: field(body, "phone", 50),
    p_arrive: field(body, "arrive", 20),
    p_stay: field(body, "stay", 20),
    p_milonga: field(body, "milonga", 20),
    p_dinner: field(body, "dinner", 20),
    p_note: field(body, "note", 500),
    p_company: field(body, "company", 200),
    p_ip_hash: ipHash,
  });
  if (saved.error || !saved.data) {
    console.error("hp-offer: speichern fehlgeschlagen");
    return json(500, { error: "server" }, origin);
  }
  const data = saved.data as { ok?: boolean; code?: string };
  if (data.ok === true) return json(200, { ok: true }, origin);
  if (data.code === "RATE") return json(429, { ok: false, code: "RATE" }, origin);
  return json(400, { ok: false, code: "INVALID_INPUT" }, origin);
});
