#!/bin/bash
# Legt ein Orga-Konto auf der netcup-Datenbank an.
# E-Mail und Passwort werden nur abgefragt und über die Standardeingabe geschickt.
# Sie stehen nicht in der Befehlszeile.
set -euo pipefail

printf 'E-Mail: '
read -r email
printf 'Passwort: '
read -s password
printf '\n'

printf '%s\n%s\n' "$email" "$password" | python3 -c '
import json, sys
email = sys.stdin.readline().rstrip("\n")
password = sys.stdin.readline().rstrip("\n")
json.dump({"email": email, "password": password}, sys.stdout)
' | ssh -o BatchMode=yes netcup-supabase-admin 'sudo -n python3 /home/nk/bendito-paket/create_admin.py'
