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
python3 - "$PB_DATA_DIR" <<'PY'
import os
import stat
import sys

# normpath removes trailing slash and '/.' spellings before lstat, preventing
# those spellings from dereferencing a symlinked source root.
source = os.path.normpath(sys.argv[1])
try:
    mode = os.lstat(source).st_mode
except FileNotFoundError:
    raise SystemExit(0)
if stat.S_ISLNK(mode):
    raise SystemExit("PB_DATA_DIR itself must not be a symbolic link")
PY
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

command -v python3 >/dev/null 2>&1 || fail 'python3 is required to create consistent SQLite backups'
python3 - "$pb_data_resolved" <<'PY'
import os
from pathlib import Path
import stat
import sys

root = Path(sys.argv[1])
for current, directories, files in os.walk(root, followlinks=False):
    for name in directories + files:
        path = Path(current) / name
        mode = path.lstat().st_mode
        if not (stat.S_ISDIR(mode) or stat.S_ISREG(mode)):
            raise SystemExit(f"unsupported source filesystem entry: {path}")
PY

lock_dir="$BACKUP_DIR/.pocketbase-backup.lock"
if ! mkdir "$lock_dir" 2>/dev/null; then
  fail "another backup appears to be running (lock exists: $lock_dir)"
fi
path_identity() {
  python3 -I - "$1" <<'PY'
import os
import sys

path = sys.argv[1]
st = os.lstat(path)
print(f"{st.st_dev}:{st.st_ino}")
PY
}

remove_owned_path() {
  local path=${1:-}
  local expected=${2:-}
  [ -n "$path" ] && [ -n "$expected" ] || return 0
  python3 -I - "$path" "$expected" <<'PY' || true
import os
from pathlib import Path
import secrets
import shutil
import sys

path = Path(sys.argv[1])
expected_dev, expected_ino = sys.argv[2].split(":", 1)
expected = (int(expected_dev), int(expected_ino))
try:
    quarantine = path.with_name(f"{path.name}.retained.{secrets.token_hex(8)}")
    os.rename(path, quarantine)
except FileNotFoundError:
    raise SystemExit(0)

current = os.lstat(quarantine)
if (current.st_dev, current.st_ino) != expected:
    print(
        f"[pocketbase-backup] retained-replacement={quarantine}",
        file=sys.stderr,
    )
    raise SystemExit(0)

if quarantine.is_dir():
    shutil.rmtree(quarantine)
else:
    os.unlink(quarantine)
PY
}

lock_identity=$(path_identity "$lock_dir")
exec 7<"$lock_dir"
cleanup() {
  remove_owned_path "${archive_tmp:-}" "${archive_tmp_identity:-}"
  remove_owned_path "${checksum_tmp:-}" "${checksum_tmp_identity:-}"
  if [ "${staging_owned:-0}" = "1" ]; then
    remove_owned_path "${staging_parent:-}" "${staging_identity:-}"
  fi
  remove_owned_path "$lock_dir" "${lock_identity:-}"
  exec 10<&- 2>/dev/null || true
  exec 9<&- 2>/dev/null || true
  exec 8<&- 2>/dev/null || true
  exec 7<&- 2>/dev/null || true
}
trap cleanup EXIT INT TERM

timestamp=$(date -u '+%Y%m%dT%H%M%SZ')
archive="$BACKUP_DIR/pocketbase-${timestamp}.tar.gz"
checksum="$archive.sha256"
staging_owned=0
archive_tmp=$(mktemp "$BACKUP_DIR/.pocketbase-archive.XXXXXXXX")
checksum_tmp=$(mktemp "$BACKUP_DIR/.pocketbase-checksum.XXXXXXXX")
staging_parent=$(mktemp -d "$BACKUP_DIR/.pocketbase-backup-staging.XXXXXXXX")
# Keep the original inodes open for the full operation. An unlinked object
# with an open descriptor cannot have its inode immediately reused by a
# replacement path, making the later quarantine identity check reliable.
exec 8<>"$archive_tmp"
exec 9<>"$checksum_tmp"
exec 10<"$staging_parent"
archive_tmp_identity=$(path_identity "$archive_tmp")
checksum_tmp_identity=$(path_identity "$checksum_tmp")
staging_identity=$(path_identity "$staging_parent")
staging_owned=1
staging_dir="$staging_parent/pb_data"

log "source=$PB_DATA_DIR"
log "destination=$archive"

command -v rsync >/dev/null 2>&1 || fail 'rsync is required to stage PocketBase storage files'
command -v python3 >/dev/null 2>&1 || fail 'python3 is required to create consistent SQLite backups'
mkdir "$staging_dir"

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
from pathlib import Path

source_path, destination_path = sys.argv[1:]
source_uri = Path(source_path).resolve(strict=True).as_uri() + "?mode=ro"
source = sqlite3.connect(source_uri, uri=True)
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

# Revalidate the private staged snapshot. This closes the source-scan/copy
# race and ensures that backup never publishes a member restore will reject.
python3 - "$staging_dir" <<'PY'
import os
from pathlib import Path
import stat
import sys

root = Path(sys.argv[1])
for current, directories, files in os.walk(root, followlinks=False):
    for name in directories + files:
        path = Path(current) / name
        mode = path.lstat().st_mode
        if not (stat.S_ISDIR(mode) or stat.S_ISREG(mode)):
            raise SystemExit(f"unsupported staged filesystem entry: {path}")
PY

if ! find "$staging_dir" -type f -print -quit | grep -q .; then
  fail 'staged PocketBase snapshot contains no regular files'
fi

tar -czf "$archive_tmp" -C "$staging_parent" pb_data
[ -s "$archive_tmp" ] || fail "archive was not created or is empty: $archive_tmp"
tar -tzf "$archive_tmp" >/dev/null

if command -v sha256sum >/dev/null 2>&1; then
  archive_digest=$(sha256sum "$archive_tmp" | cut -d ' ' -f 1)
elif command -v shasum >/dev/null 2>&1; then
  archive_digest=$(shasum -a 256 "$archive_tmp" | cut -d ' ' -f 1)
else
  fail 'neither sha256sum nor shasum is available for checksum verification'
fi
printf '%s  %s\n' "$archive_digest" "$(basename "$archive")" > "$checksum_tmp"

python3 - "$archive_tmp" "$archive" "$checksum_tmp" "$checksum" "$archive_tmp_identity" "$checksum_tmp_identity" <<'PY'
import os
from pathlib import Path
import secrets
import sys

archive_tmp, archive, checksum_tmp, checksum, archive_identity_raw, checksum_identity_raw = sys.argv[1:]
archive_published = False
checksum_published = False

def parse_identity(raw):
    device, inode = raw.split(":", 1)
    return (int(device), int(inode))

def current_identity(path):
    current = os.lstat(path)
    return (current.st_dev, current.st_ino)

archive_identity = parse_identity(archive_identity_raw)
checksum_identity = parse_identity(checksum_identity_raw)

def unlink_if_owned(path, identity):
    path = Path(path)
    try:
        quarantine = path.with_name(
            f"{path.name}.retained.{secrets.token_hex(8)}"
        )
        os.rename(path, quarantine)
    except FileNotFoundError:
        return
    current = os.lstat(quarantine)
    if (current.st_dev, current.st_ino) == identity:
        os.unlink(quarantine)
    else:
        print(
            f"[pocketbase-backup] retained-replacement={quarantine}",
            file=sys.stderr,
        )

try:
    try:
        os.link(archive_tmp, archive)
        archive_published = True
        if current_identity(archive) != archive_identity:
            raise RuntimeError("published archive identity does not match owned temporary")
    except FileExistsError:
        raise SystemExit(f"backup archive already exists; refusing to overwrite: {archive}")
    try:
        os.link(checksum_tmp, checksum)
        checksum_published = True
        if current_identity(checksum) != checksum_identity:
            raise RuntimeError("published checksum identity does not match owned temporary")
    except FileExistsError:
        raise SystemExit(f"backup checksum already exists; refusing to overwrite: {checksum}")
    if current_identity(archive) != archive_identity:
        raise RuntimeError("published archive identity changed before completion")
    if current_identity(checksum) != checksum_identity:
        raise RuntimeError("published checksum identity changed before completion")
except BaseException:
    if checksum_published:
        unlink_if_owned(checksum, checksum_identity)
    if archive_published:
        unlink_if_owned(archive, archive_identity)
    raise
else:
    unlink_if_owned(archive_tmp, archive_identity)
    unlink_if_owned(checksum_tmp, checksum_identity)
PY
archive_tmp=''
checksum_tmp=''

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
