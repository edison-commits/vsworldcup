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

if command -v sha256sum >/dev/null 2>&1; then
  sha256sum -c "$ARCHIVE.sha256" >/dev/null
elif command -v shasum >/dev/null 2>&1; then
  shasum -a 256 -c "$ARCHIVE.sha256" >/dev/null
else
  fail 'neither sha256sum nor shasum is available for checksum verification'
fi

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
