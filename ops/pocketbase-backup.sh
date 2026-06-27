#!/usr/bin/env bash
set -euo pipefail

log() {
  printf '[pocketbase-backup] %s\n' "$*"
}

fail() {
  printf '[pocketbase-backup] ERROR: %s\n' "$*" >&2
  exit 1
}

PB_DATA_DIR=${PB_DATA_DIR:-}
BACKUP_DIR=${BACKUP_DIR:-}
RETENTION_DAYS=${RETENTION_DAYS:-}
ENABLE_PRUNE=${ENABLE_PRUNE:-0}
REMOTE_TARGET=${REMOTE_TARGET:-}
ENABLE_REMOTE_COPY=${ENABLE_REMOTE_COPY:-0}

[ -n "$PB_DATA_DIR" ] || fail 'PB_DATA_DIR is required'
[ -n "$BACKUP_DIR" ] || fail 'BACKUP_DIR is required'
[ -d "$PB_DATA_DIR" ] || fail "PB_DATA_DIR does not exist or is not a directory: $PB_DATA_DIR"

if [ ! -f "$PB_DATA_DIR/data.db" ] && [ ! -d "$PB_DATA_DIR/storage" ] && [ ! -d "$PB_DATA_DIR/backups" ]; then
  fail "PB_DATA_DIR does not look like PocketBase data (expected data.db, storage/, or backups/): $PB_DATA_DIR"
fi

if [ -n "$REMOTE_TARGET" ] && [ "$ENABLE_REMOTE_COPY" != "1" ]; then
  fail 'REMOTE_TARGET is set but ENABLE_REMOTE_COPY=1 was not provided; remote copies require explicit approval'
fi

if [ -n "$RETENTION_DAYS" ] && [ "$ENABLE_PRUNE" != "1" ]; then
  log "RETENTION_DAYS=$RETENTION_DAYS ignored because ENABLE_PRUNE is not 1"
fi

mkdir -p "$BACKUP_DIR"
lock_dir="$BACKUP_DIR/.pocketbase-backup.lock"
if ! mkdir "$lock_dir" 2>/dev/null; then
  fail "another backup appears to be running (lock exists: $lock_dir)"
fi
cleanup() {
  rm -rf "$lock_dir"
}
trap cleanup EXIT INT TERM

timestamp=$(date -u '+%Y%m%dT%H%M%SZ')
source_parent=$(cd "$(dirname "$PB_DATA_DIR")" && pwd -P)
source_base=$(basename "$PB_DATA_DIR")
archive="$BACKUP_DIR/pocketbase-${timestamp}.tar.gz"
checksum="$archive.sha256"

log "source=$PB_DATA_DIR"
log "destination=$archive"

tar -czf "$archive" -C "$source_parent" "$source_base"
[ -s "$archive" ] || fail "archive was not created or is empty: $archive"

if command -v sha256sum >/dev/null 2>&1; then
  sha256sum "$archive" > "$checksum"
  sha256sum -c "$checksum" >/dev/null
elif command -v shasum >/dev/null 2>&1; then
  shasum -a 256 "$archive" > "$checksum"
  shasum -a 256 -c "$checksum" >/dev/null
else
  fail 'neither sha256sum nor shasum is available for checksum verification'
fi

tar -tzf "$archive" >/dev/null

if [ -n "$REMOTE_TARGET" ]; then
  command -v rsync >/dev/null 2>&1 || fail 'REMOTE_TARGET requested but rsync is not available'
  log "remote-copy-target=$REMOTE_TARGET"
  rsync -av -- "$archive" "$checksum" "$REMOTE_TARGET"
fi

if [ -n "$RETENTION_DAYS" ] && [ "$ENABLE_PRUNE" = "1" ]; then
  case "$RETENTION_DAYS" in
    ''|*[!0-9]*) fail "RETENTION_DAYS must be a positive integer when pruning is enabled: $RETENTION_DAYS" ;;
  esac
  [ "$RETENTION_DAYS" -gt 0 ] || fail 'RETENTION_DAYS must be greater than zero when pruning is enabled'
  log "prune-enabled retention_days=$RETENTION_DAYS"
  find "$BACKUP_DIR" -maxdepth 1 -type f \( -name 'pocketbase-*.tar.gz' -o -name 'pocketbase-*.tar.gz.sha256' \) -mtime +"$RETENTION_DAYS" -print -delete
fi

size_bytes=$(wc -c < "$archive" | tr -d ' ')
log "verified archive=$archive size_bytes=$size_bytes checksum=$checksum"
