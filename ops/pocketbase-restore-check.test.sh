#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)
RESTORE_SCRIPT="$ROOT_DIR/ops/pocketbase-restore-check.sh"
TMP_DIR=$(mktemp -d 2>/dev/null || mktemp -d -t pb-restore-test)
cleanup() { rm -rf "$TMP_DIR"; }
trap cleanup EXIT INT TERM

SOURCE="$TMP_DIR/pb_data"
BACKUPS="$TMP_DIR/backups"
RESTORE="$TMP_DIR/restore-proof"
mkdir -p "$SOURCE/storage/assets" "$BACKUPS"
sqlite3 "$SOURCE/data.db" "CREATE TABLE votes (id INTEGER PRIMARY KEY, winner TEXT NOT NULL); INSERT INTO votes (winner) VALUES ('Pizza');"
printf 'image bytes\n' > "$SOURCE/storage/assets/example.txt"
archive="$BACKUPS/pocketbase-test.tar.gz"
tar -czf "$archive" -C "$TMP_DIR" pb_data
archive_digest=$(shasum -a 256 "$archive" | cut -d ' ' -f 1)
printf '%s  %s\n' "$archive_digest" 'obsolete/location/pocketbase-original.tar.gz' > "$archive.sha256"

output=$(ARCHIVE="$archive" RESTORE_DIR="$RESTORE" bash "$RESTORE_SCRIPT")
printf '%s\n' "$output"
grep -q 'integrity=ok' <<< "$output"
grep -q 'restore-check=ok' <<< "$output"
[ -f "$RESTORE/pb_data/data.db" ] || { echo 'expected restored data.db' >&2; exit 1; }
[ -f "$RESTORE/pb_data/storage/assets/example.txt" ] || { echo 'expected restored storage file' >&2; exit 1; }
restored=$(sqlite3 "$RESTORE/pb_data/data.db" "SELECT winner FROM votes WHERE id = 1;")
[ "$restored" = 'Pizza' ] || { echo "unexpected restored row: $restored" >&2; exit 1; }

mismatched_archive="$BACKUPS/pocketbase-mismatched.tar.gz"
cp "$archive" "$mismatched_archive"
printf 'tampered\n' >> "$mismatched_archive"
printf '%s  %s\n' "$archive_digest" 'obsolete/location/pocketbase-original.tar.gz' > "$mismatched_archive.sha256"
if ARCHIVE="$mismatched_archive" RESTORE_DIR="$TMP_DIR/mismatched-restore" bash "$RESTORE_SCRIPT" >/tmp/pb-restore-mismatched.out 2>/tmp/pb-restore-mismatched.err; then
  echo 'expected supplied archive checksum mismatch to fail' >&2
  exit 1
fi
grep -q 'checksum verification failed for supplied ARCHIVE' /tmp/pb-restore-mismatched.err

if ARCHIVE="$archive" RESTORE_DIR="$RESTORE" bash "$RESTORE_SCRIPT" >/tmp/pb-restore-existing.out 2>/tmp/pb-restore-existing.err; then
  echo 'expected existing RESTORE_DIR to fail closed' >&2
  exit 1
fi
grep -q 'RESTORE_DIR already exists' /tmp/pb-restore-existing.err

bad_archive="$BACKUPS/bad.tar.gz"
printf 'not a tarball' > "$bad_archive"
if ARCHIVE="$bad_archive" RESTORE_DIR="$TMP_DIR/bad-restore" bash "$RESTORE_SCRIPT" >/tmp/pb-restore-bad.out 2>/tmp/pb-restore-bad.err; then
  echo 'expected bad archive to fail' >&2
  exit 1
fi
grep -q 'checksum file is required' /tmp/pb-restore-bad.err

echo 'pocketbase-restore-check.test.sh: OK'
