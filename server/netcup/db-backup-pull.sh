#!/bin/bash
# Holt die neueste Bendito-Sicherung auf diesen Mac. Nicht ins Projekt und nicht ins Git.
set -euo pipefail
dest="${HOME}/Backups/bendito-db"
mkdir -p "$dest"
chmod 700 "$dest"
tmp=$(mktemp "${dest}/.pull.XXXXXX")
cleanup() { rm -f -- "$tmp"; }
trap cleanup EXIT
scp -o BatchMode=yes netcup-supabase-admin:bendito-backups/latest.dump "$tmp"
install -m 600 "$tmp" "${dest}/bendito-$(date +%F).dump"
trap - EXIT
rm -f -- "$tmp"
# Neueste 30 behalten. macOS-bash 3.2 hat kein mapfile.
# Die Namen sind bendito-JJJJ-MM-TT.dump, die Sortierung folgt dem Datum.
count=$(find "$dest" -maxdepth 1 -type f -name 'bendito-*.dump' | wc -l | tr -d ' ')
if [ "$count" -gt 30 ]; then
  find "$dest" -maxdepth 1 -type f -name 'bendito-*.dump' | sort -r | awk 'NR>30' | while IFS= read -r f; do
    rm -f -- "$f"
  done
fi
