#!/usr/bin/env bash
set -euo pipefail
umask 077

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
command -v python3 >/dev/null 2>&1 || fail 'python3 is required to create consistent SQLite backups'
mkdir -p "$staging_dir"

while IFS= read -r -d '' source_db; do
  db_name=$(basename "$source_db")
  staged_db="$staging_dir/$db_name"
  if [ ! -s "$source_db" ]; then
    cp -a -- "$source_db" "$staged_db"
    log "sqlite-empty-file-copy=$db_name"
    continue
  fi

  log "sqlite-online-backup=$db_name"
  python3 - "$source_db" "$staged_db" <<'PY'
import sqlite3
import sys

source_path, destination_path = sys.argv[1:]
source = sqlite3.connect(f"file:{source_path}?mode=ro", uri=True)
destination = sqlite3.connect(destination_path)
try:
    source.backup(destination)
    result = destination.execute("PRAGMA integrity_check").fetchone()
    if result != ("ok",):
        raise SystemExit(f"staged SQLite integrity_check failed for {source_path}: {result}")
    destination.execute("PRAGMA wal_checkpoint(TRUNCATE)")
    journal_mode = destination.execute("PRAGMA journal_mode=DELETE").fetchone()
    if not journal_mode or journal_mode[0].lower() != "delete":
        raise SystemExit(
            f"could not normalize staged SQLite journal mode for {source_path}: {journal_mode}"
        )
finally:
    destination.close()
    source.close()

for suffix in ("-wal", "-shm"):
    sidecar = destination_path + suffix
    try:
        import os
        os.unlink(sidecar)
    except FileNotFoundError:
        pass
PY
done < <(find "$pb_data_resolved" -maxdepth 1 -type f -name '*.db' -print0)

if find "$staging_dir" -maxdepth 1 -type f \( -name '*.db-wal' -o -name '*.db-shm' \) -print -quit | grep -q .; then
  fail 'staged SQLite WAL/SHM sidecars remain after journal normalization'
fi

# SQLite online backup folds committed WAL content into each staged database.
# Copying live WAL/SHM sidecars afterward could make the snapshot inconsistent.
rsync -a \
  --exclude '/*.db' \
  --exclude '/*.db-wal' \
  --exclude '/*.db-shm' \
  -- "$pb_data_resolved/" "$staging_dir/"

tar -czf "$archive_tmp" -C "$staging_parent" "$source_base"
[ -s "$archive_tmp" ] || fail "archive was not created or is empty: $archive_tmp"
tar -tzf "$archive_tmp" >/dev/null
mv "$archive_tmp" "$archive"

if command -v sha256sum >/dev/null 2>&1; then
  archive_digest=$(sha256sum "$archive" | cut -d ' ' -f 1)
elif command -v shasum >/dev/null 2>&1; then
  archive_digest=$(shasum -a 256 "$archive" | cut -d ' ' -f 1)
else
  fail 'neither sha256sum nor shasum is available for checksum verification'
fi
printf '%s  %s\n' "$archive_digest" "$(basename "$archive")" > "$checksum_tmp"
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
