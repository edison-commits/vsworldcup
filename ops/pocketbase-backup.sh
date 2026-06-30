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
pb_data_resolved=$(cd "$PB_DATA_DIR" && pwd -P)
backup_dir_resolved=$(cd "$BACKUP_DIR" && pwd -P)

case "$pb_data_resolved/" in
  "$backup_dir_resolved"/*) fail "PB_DATA_DIR must not be inside BACKUP_DIR: $pb_data_resolved" ;;
esac

case "$backup_dir_resolved/" in
  "$pb_data_resolved"/*) fail "BACKUP_DIR must not be inside PB_DATA_DIR: $backup_dir_resolved" ;;
esac

lock_dir="$BACKUP_DIR/.pocketbase-backup.lock"
if ! mkdir "$lock_dir" 2>/dev/null; then
  fail "another backup appears to be running (lock exists: $lock_dir)"
fi
cleanup() {
  rm -f "${archive_tmp:-}" "${checksum_tmp:-}"
  rm -rf "${staging_parent:-}" "$lock_dir"
}
trap cleanup EXIT INT TERM

timestamp=$(date -u '+%Y%m%dT%H%M%SZ')
source_base=$(basename "$pb_data_resolved")
archive="$BACKUP_DIR/pocketbase-${timestamp}.tar.gz"
checksum="$archive.sha256"
archive_tmp="$archive.tmp.$$"
checksum_tmp="$checksum.tmp.$$"
staging_parent="$BACKUP_DIR/.pocketbase-backup-staging.$$"
staging_dir="$staging_parent/$source_base"

log "source=$PB_DATA_DIR"
log "destination=$archive"

command -v rsync >/dev/null 2>&1 || fail 'rsync is required to stage PocketBase storage files'
mkdir -p "$staging_dir"

if [ -f "$pb_data_resolved/data.db" ]; then
  command -v sqlite3 >/dev/null 2>&1 || fail 'sqlite3 is required to create a consistent data.db backup'
  log 'sqlite-online-backup=data.db'
  sqlite3 "$pb_data_resolved/data.db" ".backup '$staging_dir/data.db'"
  integrity=$(sqlite3 "$staging_dir/data.db" 'PRAGMA integrity_check;')
  [ "$integrity" = 'ok' ] || fail "staged SQLite integrity_check failed: $integrity"
  rsync -a --exclude '/data.db' -- "$pb_data_resolved/" "$staging_dir/"
else
  rsync -a -- "$pb_data_resolved/" "$staging_dir/"
fi

tar -czf "$archive_tmp" -C "$staging_parent" "$source_base"
[ -s "$archive_tmp" ] || fail "archive was not created or is empty: $archive_tmp"
tar -tzf "$archive_tmp" >/dev/null
mv "$archive_tmp" "$archive"

if command -v sha256sum >/dev/null 2>&1; then
  sha256sum "$archive" > "$checksum_tmp"
  sha256sum -c "$checksum_tmp" >/dev/null
elif command -v shasum >/dev/null 2>&1; then
  shasum -a 256 "$archive" > "$checksum_tmp"
  shasum -a 256 -c "$checksum_tmp" >/dev/null
else
  fail 'neither sha256sum nor shasum is available for checksum verification'
fi
mv "$checksum_tmp" "$checksum"

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
