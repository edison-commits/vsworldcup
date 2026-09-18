#!/usr/bin/env bash
set -euo pipefail

log() { printf '[pocketbase-restore-check] %s\n' "$*"; }
fail() { printf '[pocketbase-restore-check] ERROR: %s\n' "$*" >&2; exit 1; }

ARCHIVE=${ARCHIVE:-}
RESTORE_DIR=${RESTORE_DIR:-}

[ -n "$ARCHIVE" ] || fail 'ARCHIVE is required'
[ -n "$RESTORE_DIR" ] || fail 'RESTORE_DIR is required'
[ -f "$ARCHIVE" ] || fail "ARCHIVE does not exist: $ARCHIVE"
[ -f "$ARCHIVE.sha256" ] || fail "checksum file is required: $ARCHIVE.sha256"
[ ! -e "$RESTORE_DIR" ] || fail "RESTORE_DIR already exists; choose an empty proof directory: $RESTORE_DIR"

expected_digest=$(awk 'NR == 1 { print $1; exit }' "$ARCHIVE.sha256" | tr '[:upper:]' '[:lower:]')
[[ "$expected_digest" =~ ^[[:xdigit:]]{64}$ ]] || fail "checksum file does not contain a SHA-256 digest: $ARCHIVE.sha256"

if command -v sha256sum >/dev/null 2>&1; then
  actual_digest=$(sha256sum "$ARCHIVE" | cut -d ' ' -f 1)
elif command -v shasum >/dev/null 2>&1; then
  actual_digest=$(shasum -a 256 "$ARCHIVE" | cut -d ' ' -f 1)
else
  fail 'neither sha256sum nor shasum is available for checksum verification'
fi
[ "$actual_digest" = "$expected_digest" ] || fail "checksum verification failed for supplied ARCHIVE: $ARCHIVE"

tar -tzf "$ARCHIVE" >/dev/null
mkdir -p "$RESTORE_DIR"
tar -xzf "$ARCHIVE" -C "$RESTORE_DIR"

restored_db=$(find "$RESTORE_DIR" -maxdepth 3 -type f -name data.db | head -1)
if [ -n "$restored_db" ]; then
  command -v sqlite3 >/dev/null 2>&1 || fail 'sqlite3 is required to verify restored data.db'
  integrity=$(sqlite3 "$restored_db" 'PRAGMA integrity_check;')
  [ "$integrity" = 'ok' ] || fail "restored SQLite integrity_check failed: $integrity"
  log 'integrity=ok'
else
  log 'integrity=skipped no-data.db'
fi

file_count=$(find "$RESTORE_DIR" -type f | wc -l | tr -d ' ')
[ "$file_count" -gt 0 ] || fail 'restore produced no files'
log "restored_files=$file_count"
log 'restore-check=ok'
