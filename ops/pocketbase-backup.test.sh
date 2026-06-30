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
printf 'fake image bytes\n' > "$PB_FAKE/storage/images/example.txt"

output=$(PB_DATA_DIR="$PB_FAKE" BACKUP_DIR="$BACKUPS" bash "$SCRIPT")
printf '%s\n' "$output"
grep -q 'sqlite-online-backup=data.db' <<< "$output"

archive=$(find "$BACKUPS" -maxdepth 1 -type f -name 'pocketbase-*.tar.gz' | sort | tail -1)
[ -n "$archive" ] || { echo 'expected archive file' >&2; exit 1; }
[ -s "$archive" ] || { echo 'archive is empty' >&2; exit 1; }
[ -f "$archive.sha256" ] || { echo 'expected checksum file' >&2; exit 1; }

if command -v sha256sum >/dev/null 2>&1; then
  sha256sum -c "$archive.sha256" >/dev/null
else
  shasum -a 256 -c "$archive.sha256" >/dev/null
fi

tar -tzf "$archive" | grep -q '^pb_data/data.db$'
tar -tzf "$archive" | grep -q '^pb_data/storage/images/example.txt$'

RESTORE_DIR="$TMP_DIR/restore"
mkdir -p "$RESTORE_DIR"
tar -xzf "$archive" -C "$RESTORE_DIR"
[ -f "$RESTORE_DIR/pb_data/data.db" ] || { echo 'expected restored data.db' >&2; exit 1; }
[ -f "$RESTORE_DIR/pb_data/storage/images/example.txt" ] || { echo 'expected restored storage file' >&2; exit 1; }
restored_integrity=$(sqlite3 "$RESTORE_DIR/pb_data/data.db" 'PRAGMA integrity_check;')
[ "$restored_integrity" = 'ok' ] || { echo "expected restored SQLite integrity ok, got: $restored_integrity" >&2; exit 1; }
restored_value=$(sqlite3 "$RESTORE_DIR/pb_data/data.db" "SELECT value FROM smoke WHERE id = 1;")
[ "$restored_value" = 'fake sqlite row' ] || { echo "expected restored sqlite row, got: $restored_value" >&2; exit 1; }
cmp "$PB_FAKE/storage/images/example.txt" "$RESTORE_DIR/pb_data/storage/images/example.txt"

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
