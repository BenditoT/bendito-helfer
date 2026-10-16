#!/usr/bin/env python3
# Legt ein Orga-Konto an. Liest E-Mail und Passwort nur von stdin.
# Den Dienstschlüssel liest das Skript selbst. Nichts davon wird ausgegeben.
import json
import re
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

UUID = re.compile(r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}")


def fail():
    print("Orga-Konto nicht angelegt", file=sys.stderr)
    raise SystemExit(1)


def service_key():
    for line in Path("/opt/bendito/supabase/docker/.env").read_text().splitlines():
        if line.startswith("SERVICE_ROLE_KEY="):
            return line.split("=", 1)[1]
    return ""


def api(method, path, key, body=None):
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(
        "http://127.0.0.1:8100" + path,
        data=data,
        headers={
            "Authorization": "Bearer " + key,
            "apikey": key,
            "Content-Type": "application/json",
        },
        method=method,
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read().decode()
            return resp.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError:
        fail()


def main():
    try:
        data = json.load(sys.stdin)
    except Exception:
        fail()
    email = data.get("email") if isinstance(data, dict) else None
    password = data.get("password") if isinstance(data, dict) else None
    if not isinstance(email, str) or not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        fail()
    if not isinstance(password, str) or password == "":
        fail()
    key = service_key()
    if not key:
        fail()
    _status, doc = api("POST", "/auth/v1/admin/users", key, {
        "email": email,
        "password": password,
        "email_confirm": True,
    })
    user_id = doc.get("id") or (doc.get("user") or {}).get("id")
    if not isinstance(user_id, str) or not UUID.fullmatch(user_id):
        fail()
    inserted = subprocess.run(
        [
            "docker", "exec", "-i", "bendito-db", "psql",
            "-U", "postgres", "-d", "postgres", "-q",
            "-v", "ON_ERROR_STOP=1", "-v", "uid=" + user_id,
        ],
        input="INSERT INTO public.hp_admins (user_id) VALUES (:'uid'::uuid);\n",
        text=True,
        capture_output=True,
    )
    if inserted.returncode != 0:
        try:
            api("DELETE", "/auth/v1/admin/users/" + user_id, key)
        except SystemExit:
            pass
        fail()
    print("Orga-Konto angelegt")


if __name__ == "__main__":
    main()
