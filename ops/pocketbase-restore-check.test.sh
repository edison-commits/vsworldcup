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
sqlite3 "$SOURCE/auxiliary.db" "CREATE TABLE events (id INTEGER PRIMARY KEY, path TEXT NOT NULL); INSERT INTO events (path) VALUES ('/t/fast-food');"
printf 'image bytes\n' > "$SOURCE/storage/assets/example.txt"
archive="$BACKUPS/pocketbase-test.tar.gz"
tar -czf "$archive" -C "$TMP_DIR" pb_data
archive_digest=$(shasum -a 256 "$archive" | cut -d ' ' -f 1)
printf '%s  %s\n' "$archive_digest" 'obsolete/location/pocketbase-original.tar.gz' > "$archive.sha256"

output=$(ARCHIVE="$archive" RESTORE_DIR="$RESTORE" bash "$RESTORE_SCRIPT")
printf '%s\n' "$output"
grep -q 'integrity=ok' <<< "$output"
grep -q 'sqlite_databases=2' <<< "$output"
grep -q 'restore-check=ok' <<< "$output"
[ -f "$RESTORE/pb_data/data.db" ] || { echo 'expected restored data.db' >&2; exit 1; }
[ -f "$RESTORE/pb_data/storage/assets/example.txt" ] || { echo 'expected restored storage file' >&2; exit 1; }
restored=$(sqlite3 "$RESTORE/pb_data/data.db" "SELECT winner FROM votes WHERE id = 1;")
[ "$restored" = 'Pizza' ] || { echo "unexpected restored row: $restored" >&2; exit 1; }
restored_aux=$(sqlite3 "$RESTORE/pb_data/auxiliary.db" "SELECT path FROM events WHERE id = 1;")
[ "$restored_aux" = '/t/fast-food' ] || { echo "unexpected restored auxiliary row: $restored_aux" >&2; exit 1; }

mismatched_archive="$BACKUPS/pocketbase-mismatched.tar.gz"
cp "$archive" "$mismatched_archive"
printf 'tampered\n' >> "$mismatched_archive"
printf '%s  %s\n' "$archive_digest" 'obsolete/location/pocketbase-original.tar.gz' > "$mismatched_archive.sha256"
if ARCHIVE="$mismatched_archive" RESTORE_DIR="$TMP_DIR/mismatched-restore" bash "$RESTORE_SCRIPT" >"$TMP_DIR/mismatched.out" 2>"$TMP_DIR/mismatched.err"; then
  echo 'expected supplied archive checksum mismatch to fail' >&2
  exit 1
fi
grep -q 'checksum verification failed for supplied ARCHIVE' "$TMP_DIR/mismatched.err"

if ARCHIVE="$archive" RESTORE_DIR="$RESTORE" bash "$RESTORE_SCRIPT" >"$TMP_DIR/existing.out" 2>"$TMP_DIR/existing.err"; then
  echo 'expected existing RESTORE_DIR to fail closed' >&2
  exit 1
fi
grep -q 'RESTORE_DIR already exists' "$TMP_DIR/existing.err"

unsafe_archive="$BACKUPS/unsafe-path.tar.gz"
symlink_archive="$BACKUPS/unsafe-symlink.tar.gz"
python3 - "$unsafe_archive" "$symlink_archive" <<'PY'
import io
import sys
import tarfile

unsafe_path, symlink_path = sys.argv[1:]
with tarfile.open(unsafe_path, "w:gz") as archive:
    root = tarfile.TarInfo("pb_data")
    root.type = tarfile.DIRTYPE
    archive.addfile(root)
    member = tarfile.TarInfo("pb_data/../../escape")
    payload = b"escape"
    member.size = len(payload)
    archive.addfile(member, io.BytesIO(payload))
with tarfile.open(symlink_path, "w:gz") as archive:
    root = tarfile.TarInfo("pb_data")
    root.type = tarfile.DIRTYPE
    archive.addfile(root)
    member = tarfile.TarInfo("pb_data/link")
    member.type = tarfile.SYMTYPE
    member.linkname = "../../escape"
    archive.addfile(member)
PY
for unsafe in "$unsafe_archive" "$symlink_archive"; do
  digest=$(shasum -a 256 "$unsafe" | cut -d ' ' -f 1)
  printf '%s  %s\n' "$digest" "$(basename "$unsafe")" > "$unsafe.sha256"
done
if ARCHIVE="$unsafe_archive" RESTORE_DIR="$TMP_DIR/unsafe-path-restore" bash "$RESTORE_SCRIPT" >"$TMP_DIR/unsafe-path.out" 2>"$TMP_DIR/unsafe-path.err"; then
  echo 'expected traversal archive to fail' >&2
  exit 1
fi
grep -q 'unsafe archive member path' "$TMP_DIR/unsafe-path.err"
[ ! -e "$TMP_DIR/escape" ] || { echo 'unsafe archive escaped restore directory' >&2; exit 1; }
if ARCHIVE="$symlink_archive" RESTORE_DIR="$TMP_DIR/unsafe-symlink-restore" bash "$RESTORE_SCRIPT" >"$TMP_DIR/unsafe-symlink.out" 2>"$TMP_DIR/unsafe-symlink.err"; then
  echo 'expected symlink archive to fail' >&2
  exit 1
fi
grep -q 'unsupported archive member type' "$TMP_DIR/unsafe-symlink.err"

if MAX_RESTORE_BYTES=1 ARCHIVE="$archive" RESTORE_DIR="$TMP_DIR/limited-restore" bash "$RESTORE_SCRIPT" >"$TMP_DIR/limited.out" 2>"$TMP_DIR/limited.err"; then
  echo 'expected configured expanded-size limit to fail' >&2
  exit 1
fi
grep -q 'archive exceeds configured restore limits' "$TMP_DIR/limited.err"
[ ! -e "$TMP_DIR/limited-restore" ] || { echo 'limited restore left a destination behind' >&2; exit 1; }

member_bomb_archive="$BACKUPS/member-bomb.tar.gz"
python3 - "$member_bomb_archive" <<'PY'
import io
import sys
import tarfile

with tarfile.open(sys.argv[1], "w:gz") as archive:
    root = tarfile.TarInfo("pb_data")
    root.type = tarfile.DIRTYPE
    archive.addfile(root)
    for index in range(20):
        directory = tarfile.TarInfo(f"pb_data/directory-{index}")
        directory.type = tarfile.DIRTYPE
        archive.addfile(directory)
    payload = b"x"
    member = tarfile.TarInfo("pb_data/final.txt")
    member.size = len(payload)
    archive.addfile(member, io.BytesIO(payload))
PY
member_bomb_digest=$(shasum -a 256 "$member_bomb_archive" | cut -d ' ' -f 1)
printf '%s  %s\n' "$member_bomb_digest" "$(basename "$member_bomb_archive")" > "$member_bomb_archive.sha256"
if MAX_RESTORE_FILES=5 ARCHIVE="$member_bomb_archive" RESTORE_DIR="$TMP_DIR/member-bomb-restore" bash "$RESTORE_SCRIPT" >"$TMP_DIR/member-bomb.out" 2>"$TMP_DIR/member-bomb.err"; then
  echo 'expected directory/member bomb to exceed configured member limit' >&2
  exit 1
fi
grep -q 'archive exceeds configured restore limits' "$TMP_DIR/member-bomb.err"
[ ! -e "$TMP_DIR/member-bomb-restore" ] || { echo 'member-bomb restore left a destination behind' >&2; exit 1; }

corrupt_archive="$BACKUPS/corrupt-sqlite.tar.gz"
corrupt_source="$TMP_DIR/corrupt-source"
mkdir -p "$corrupt_source/pb_data"
printf 'not a sqlite database' > "$corrupt_source/pb_data/data.db"
tar -czf "$corrupt_archive" -C "$corrupt_source" pb_data
corrupt_digest=$(shasum -a 256 "$corrupt_archive" | cut -d ' ' -f 1)
printf '%s  %s\n' "$corrupt_digest" "$(basename "$corrupt_archive")" > "$corrupt_archive.sha256"
if ARCHIVE="$corrupt_archive" RESTORE_DIR="$TMP_DIR/corrupt-restore" bash "$RESTORE_SCRIPT" >"$TMP_DIR/corrupt.out" 2>"$TMP_DIR/corrupt.err"; then
  echo 'expected corrupt SQLite database to fail validation' >&2
  exit 1
fi
grep -Eq 'DatabaseError|database disk image is malformed|file is not a database' "$TMP_DIR/corrupt.err"
[ ! -e "$TMP_DIR/corrupt-restore" ] || { echo 'corrupt restore published a destination' >&2; exit 1; }
[ -z "$(find "$TMP_DIR" -maxdepth 1 -type d -name 'corrupt-restore.tmp.*' -print -quit)" ] || { echo 'corrupt restore left staging behind' >&2; exit 1; }

bad_archive="$BACKUPS/bad.tar.gz"
printf 'not a tarball' > "$bad_archive"
if ARCHIVE="$bad_archive" RESTORE_DIR="$TMP_DIR/bad-restore" bash "$RESTORE_SCRIPT" >"$TMP_DIR/bad.out" 2>"$TMP_DIR/bad.err"; then
  echo 'expected bad archive to fail' >&2
  exit 1
fi
grep -q 'checksum file is required' "$TMP_DIR/bad.err"

echo 'pocketbase-restore-check.test.sh: OK'
