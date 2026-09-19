#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)
SCRIPT="$ROOT_DIR/ops/pocketbase-backup.sh"
TMP_DIR=$(mktemp -d 2>/dev/null || mktemp -d -t pb-backup-test)
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT INT TERM

PB_FAKE="$TMP_DIR/pb_data"
BACKUPS="$TMP_DIR/backups"
mkdir -p "$PB_FAKE/storage/images" "$PB_FAKE/backups"
sqlite3 "$PB_FAKE/data.db" "CREATE TABLE smoke (id INTEGER PRIMARY KEY, value TEXT NOT NULL); INSERT INTO smoke (value) VALUES ('fake sqlite row');"
sqlite3 "$PB_FAKE/auxiliary.db" "CREATE TABLE analytics (id INTEGER PRIMARY KEY, value TEXT NOT NULL); INSERT INTO analytics (value) VALUES ('fake auxiliary row');"
printf 'live wal must not be copied\n' > "$PB_FAKE/auxiliary.db-wal"
printf 'live shm must not be copied\n' > "$PB_FAKE/auxiliary.db-shm"
printf 'fake image bytes\n' > "$PB_FAKE/storage/images/example.txt"

output=$(PB_DATA_DIR="$PB_FAKE" BACKUP_DIR="$BACKUPS" bash "$SCRIPT")
printf '%s\n' "$output"
grep -q 'sqlite-online-backup=data.db' <<< "$output"
grep -q 'sqlite-online-backup=auxiliary.db' <<< "$output"

archive=$(find "$BACKUPS" -maxdepth 1 -type f -name 'pocketbase-*.tar.gz' | sort | tail -1)
[ -n "$archive" ] || { echo 'expected archive file' >&2; exit 1; }
[ -s "$archive" ] || { echo 'archive is empty' >&2; exit 1; }
[ -f "$archive.sha256" ] || { echo 'expected checksum file' >&2; exit 1; }

file_mode() {
  if stat -f '%Lp' "$1" >/dev/null 2>&1; then
    stat -f '%Lp' "$1"
  else
    stat -c '%a' "$1"
  fi
}
[ "$(file_mode "$archive")" = '600' ] || { echo 'expected archive mode 600' >&2; exit 1; }
[ "$(file_mode "$archive.sha256")" = '600' ] || { echo 'expected checksum mode 600' >&2; exit 1; }

recorded_archive=$(cut -d ' ' -f 3- "$archive.sha256")
[ "$recorded_archive" = "$(basename "$archive")" ] || {
  echo "expected portable checksum filename, got: $recorded_archive" >&2
  exit 1
}

if command -v sha256sum >/dev/null 2>&1; then
  (cd "$BACKUPS" && sha256sum -c "$(basename "$archive.sha256")" >/dev/null)
else
  (cd "$BACKUPS" && shasum -a 256 -c "$(basename "$archive.sha256")" >/dev/null)
fi

tar -tzf "$archive" | grep -q '^pb_data/data.db$'
tar -tzf "$archive" | grep -q '^pb_data/auxiliary.db$'
tar -tzf "$archive" | grep -q '^pb_data/storage/images/example.txt$'
if tar -tzf "$archive" | grep -Eq '^pb_data/.*\.db-(wal|shm)$'; then
  echo 'expected live SQLite WAL/SHM sidecars to be excluded after online backup' >&2
  exit 1
fi

RESTORE_DIR="$TMP_DIR/restore"
mkdir -p "$RESTORE_DIR"
tar -xzf "$archive" -C "$RESTORE_DIR"
[ -f "$RESTORE_DIR/pb_data/data.db" ] || { echo 'expected restored data.db' >&2; exit 1; }
[ -f "$RESTORE_DIR/pb_data/storage/images/example.txt" ] || { echo 'expected restored storage file' >&2; exit 1; }
restored_integrity=$(sqlite3 "$RESTORE_DIR/pb_data/data.db" 'PRAGMA integrity_check;')
[ "$restored_integrity" = 'ok' ] || { echo "expected restored SQLite integrity ok, got: $restored_integrity" >&2; exit 1; }
restored_value=$(sqlite3 "$RESTORE_DIR/pb_data/data.db" "SELECT value FROM smoke WHERE id = 1;")
[ "$restored_value" = 'fake sqlite row' ] || { echo "expected restored sqlite row, got: $restored_value" >&2; exit 1; }
restored_aux_integrity=$(sqlite3 "$RESTORE_DIR/pb_data/auxiliary.db" 'PRAGMA integrity_check;')
[ "$restored_aux_integrity" = 'ok' ] || { echo "expected restored auxiliary SQLite integrity ok, got: $restored_aux_integrity" >&2; exit 1; }
restored_aux_value=$(sqlite3 "$RESTORE_DIR/pb_data/auxiliary.db" "SELECT value FROM analytics WHERE id = 1;")
[ "$restored_aux_value" = 'fake auxiliary row' ] || { echo "expected restored auxiliary row, got: $restored_aux_value" >&2; exit 1; }
cmp "$PB_FAKE/storage/images/example.txt" "$RESTORE_DIR/pb_data/storage/images/example.txt"

# Keep a real WAL-mode writer open while the helper runs. The staged database
# must retain the committed row while the archive remains sidecar-free.
WAL_SOURCE="$TMP_DIR/wal-case/pb_data"
WAL_BACKUPS="$TMP_DIR/wal-backups"
mkdir -p "$WAL_SOURCE" "$WAL_BACKUPS"
python3 - "$SCRIPT" "$WAL_SOURCE" "$WAL_BACKUPS" <<'PY'
import io
import os
from pathlib import Path
import sqlite3
import subprocess
import sys
import tarfile
import tempfile

script, source_dir, backup_dir = sys.argv[1:]
database = Path(source_dir) / "data.db"
connection = sqlite3.connect(database)
try:
    assert connection.execute("PRAGMA journal_mode=WAL").fetchone()[0].lower() == "wal"
    connection.execute("PRAGMA wal_autocheckpoint=0")
    connection.execute("CREATE TABLE wal_smoke (value TEXT NOT NULL)")
    connection.execute("INSERT INTO wal_smoke VALUES ('committed in wal')")
    connection.commit()
    assert Path(str(database) + "-wal").exists()

    env = os.environ.copy()
    env.update(PB_DATA_DIR=source_dir, BACKUP_DIR=backup_dir)
    subprocess.run(["bash", script], env=env, check=True, capture_output=True, text=True)

    archive = sorted(Path(backup_dir).glob("pocketbase-*.tar.gz"))[-1]
    with tarfile.open(archive, "r:gz") as tar:
        names = tar.getnames()
        assert not any(name.endswith((".db-wal", ".db-shm")) for name in names), names
        member = tar.getmember("pb_data/data.db")
        restored_bytes = tar.extractfile(member).read()
    with tempfile.NamedTemporaryFile(suffix=".db") as restored:
        restored.write(restored_bytes)
        restored.flush()
        check = sqlite3.connect(restored.name)
        try:
            assert check.execute("PRAGMA integrity_check").fetchone() == ("ok",)
            assert check.execute("SELECT value FROM wal_smoke").fetchone() == ("committed in wal",)
        finally:
            check.close()
finally:
    connection.close()
PY

if find "$BACKUPS" -maxdepth 1 \( -type f -o -type d \) -name '*.tmp.*' | grep -q .; then
  echo 'expected no temporary archive/checksum/staging files after successful backup' >&2
  exit 1
fi
if find "$BACKUPS" -maxdepth 1 -type d -name '.pocketbase-backup-staging.*' | grep -q .; then
  echo 'expected no temporary staging directories after successful backup' >&2
  exit 1
fi

if PB_DATA_DIR="$TMP_DIR/missing" BACKUP_DIR="$BACKUPS" bash "$SCRIPT" >/tmp/pocketbase-backup-missing.out 2>/tmp/pocketbase-backup-missing.err; then
  echo 'expected missing PB_DATA_DIR to fail' >&2
  exit 1
fi
grep -q 'PB_DATA_DIR does not exist' /tmp/pocketbase-backup-missing.err

if PB_DATA_DIR="$PB_FAKE" BACKUP_DIR="$BACKUPS" REMOTE_TARGET='example.invalid:/backups/' bash "$SCRIPT" >/tmp/pocketbase-backup-remote.out 2>/tmp/pocketbase-backup-remote.err; then
  echo 'expected remote copy without ENABLE_REMOTE_COPY=1 to fail' >&2
  exit 1
fi
grep -q 'REMOTE_TARGET is set but ENABLE_REMOTE_COPY=1 was not provided' /tmp/pocketbase-backup-remote.err

PRUNE_GUARD_BACKUPS="$TMP_DIR/prune-guard-backups"
mkdir -p "$PRUNE_GUARD_BACKUPS"
old_archive="$PRUNE_GUARD_BACKUPS/pocketbase-old.tar.gz"
printf 'old backup placeholder\n' > "$old_archive"
if ! PB_DATA_DIR="$PB_FAKE" BACKUP_DIR="$PRUNE_GUARD_BACKUPS" RETENTION_DAYS=1 bash "$SCRIPT" >/tmp/pocketbase-backup-prune-guard.out 2>/tmp/pocketbase-backup-prune-guard.err; then
  echo 'expected RETENTION_DAYS without ENABLE_PRUNE=1 to run without pruning' >&2
  cat /tmp/pocketbase-backup-prune-guard.err >&2
  exit 1
fi
grep -q 'RETENTION_DAYS=1 ignored because ENABLE_PRUNE is not 1' /tmp/pocketbase-backup-prune-guard.out
[ -f "$old_archive" ] || { echo 'expected old backup placeholder to remain when pruning is not enabled' >&2; exit 1; }

if PB_DATA_DIR="$PB_FAKE" BACKUP_DIR="$PB_FAKE/generated-backups" bash "$SCRIPT" >/tmp/pocketbase-backup-nested.out 2>/tmp/pocketbase-backup-nested.err; then
  echo 'expected BACKUP_DIR nested inside PB_DATA_DIR to fail' >&2
  exit 1
fi
grep -q 'BACKUP_DIR must not be inside PB_DATA_DIR' /tmp/pocketbase-backup-nested.err

PARENT_BACKUPS="$TMP_DIR/parent-backups"
mkdir -p "$PARENT_BACKUPS/pb_data_inside/storage"
printf 'nested fake sqlite bytes\n' > "$PARENT_BACKUPS/pb_data_inside/data.db"
if PB_DATA_DIR="$PARENT_BACKUPS/pb_data_inside" BACKUP_DIR="$PARENT_BACKUPS" bash "$SCRIPT" >/tmp/pocketbase-backup-source-inside.out 2>/tmp/pocketbase-backup-source-inside.err; then
  echo 'expected PB_DATA_DIR nested inside BACKUP_DIR to fail' >&2
  exit 1
fi
grep -q 'PB_DATA_DIR must not be inside BACKUP_DIR' /tmp/pocketbase-backup-source-inside.err

LOCKED_BACKUPS="$TMP_DIR/locked-backups"
mkdir -p "$LOCKED_BACKUPS/.pocketbase-backup.lock"
if PB_DATA_DIR="$PB_FAKE" BACKUP_DIR="$LOCKED_BACKUPS" bash "$SCRIPT" >/tmp/pocketbase-backup-locked.out 2>/tmp/pocketbase-backup-locked.err; then
  echo 'expected existing lock directory to fail' >&2
  exit 1
fi
grep -q 'another backup appears to be running' /tmp/pocketbase-backup-locked.err

echo 'pocketbase-backup.test.sh: OK'
