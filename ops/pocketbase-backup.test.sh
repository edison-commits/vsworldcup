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
printf 'fake sqlite bytes\n' > "$PB_FAKE/data.db"
printf 'fake image bytes\n' > "$PB_FAKE/storage/images/example.txt"

output=$(PB_DATA_DIR="$PB_FAKE" BACKUP_DIR="$BACKUPS" bash "$SCRIPT")
printf '%s\n' "$output"

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

echo 'pocketbase-backup.test.sh: OK'
