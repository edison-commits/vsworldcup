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

race_restore="$TMP_DIR/race-restore"
wrapper_dir="$TMP_DIR/destination-race-wrapper"
mkdir -p "$wrapper_dir"
real_python3=$(command -v python3)
cat > "$wrapper_dir/python3" <<'SH'
#!/bin/sh
set -eu
mkdir -p "$RACE_RESTORE"
printf 'preserve me\n' > "$RACE_RESTORE/marker.txt"
exec "$REAL_PYTHON3" "$@"
SH
chmod 0755 "$wrapper_dir/python3"
if RACE_RESTORE="$race_restore" REAL_PYTHON3="$real_python3" PATH="$wrapper_dir:$PATH" ARCHIVE="$archive" RESTORE_DIR="$race_restore" bash "$RESTORE_SCRIPT" >"$TMP_DIR/race.out" 2>"$TMP_DIR/race.err"; then
  echo 'expected destination created after initial check to fail exclusively' >&2
  exit 1
fi
grep -Eq 'File exists|already exists' "$TMP_DIR/race.err"
[ "$(cat "$race_restore/marker.txt")" = 'preserve me' ] || { echo 'raced destination was replaced or modified' >&2; exit 1; }
[ ! -e "$race_restore/pb_data" ] || { echo 'validated database was published into raced destination' >&2; exit 1; }

foreign_temp_restore="$TMP_DIR/foreign-temp-restore"
foreign_temp_wrapper="$TMP_DIR/foreign-temp-wrapper"
mkdir -p "$foreign_temp_wrapper"
real_python3=$(command -v python3)
cat > "$foreign_temp_wrapper/python3" <<'SH'
#!/bin/sh
set -eu
foreign="$RESTORE_DIR.tmp.$$"
mkdir -p "$foreign"
printf 'foreign marker\n' > "$foreign/marker.txt"
exec "$REAL_PYTHON3" "$@"
SH
chmod 0755 "$foreign_temp_wrapper/python3"
REAL_PYTHON3="$real_python3" PATH="$foreign_temp_wrapper:$PATH" ARCHIVE="$archive" RESTORE_DIR="$foreign_temp_restore" bash "$RESTORE_SCRIPT" >/dev/null
foreign_temp=$(find "$TMP_DIR" -maxdepth 1 -type d -name 'foreign-temp-restore.tmp.*' -print -quit)
[ -n "$foreign_temp" ] || { echo 'restore deleted a temporary directory it did not create' >&2; exit 1; }
[ "$(cat "$foreign_temp/marker.txt")" = 'foreign marker' ] || { echo 'restore modified foreign temporary content' >&2; exit 1; }

replacement_restore="$TMP_DIR/replacement-restore"
replacement_wrapper="$TMP_DIR/replacement-wrapper"
replacement_owned="$TMP_DIR/replacement-owned-original"
mkdir -p "$replacement_wrapper"
cat > "$replacement_wrapper/sitecustomize.py" <<'PY'
import os
from pathlib import Path

_real_replace = os.replace
def replacing_restore(source, destination, *args, **kwargs):
    result = _real_replace(source, destination, *args, **kwargs)
    restore = Path(os.environ.get('REPLACEMENT_RESTORE', ''))
    if restore and Path(destination) == restore / 'pb_data':
        owned = Path(os.environ['REPLACEMENT_OWNED'])
        os.rename(restore, owned)
        restore.mkdir()
        (restore / 'marker.txt').write_text('foreign replacement\n', encoding='utf-8')
        raise RuntimeError('injected failure after destination replacement')
    return result
os.replace = replacing_restore
PY
if PYTHONPATH="$replacement_wrapper" REPLACEMENT_RESTORE="$replacement_restore" REPLACEMENT_OWNED="$replacement_owned" ARCHIVE="$archive" RESTORE_DIR="$replacement_restore" bash "$RESTORE_SCRIPT" >"$TMP_DIR/replacement.out" 2>"$TMP_DIR/replacement.err"; then
  echo 'expected injected post-publication restore failure' >&2
  exit 1
fi
replacement_marker=$(find "$TMP_DIR" -maxdepth 2 -type f -path '*replacement-restore.retained.*/marker.txt' -print -quit)
[ -n "$replacement_marker" ] || { echo 'restore cleanup deleted a replacement destination it did not own' >&2; exit 1; }
[ "$(cat "$replacement_marker")" = 'foreign replacement' ] || { echo 'restore cleanup modified replacement destination content' >&2; exit 1; }

swap_original="$BACKUPS/swap-original.tar.gz"
swap_replacement="$BACKUPS/swap-replacement.tar.gz"
swap_source="$TMP_DIR/swap-source"
swap_restore="$TMP_DIR/swap-restore"
swap_wrapper="$TMP_DIR/swap-wrapper"
cp "$archive" "$swap_original"
mkdir -p "$swap_source/pb_data" "$swap_wrapper"
sqlite3 "$swap_source/pb_data/data.db" "CREATE TABLE votes (id INTEGER PRIMARY KEY, winner TEXT NOT NULL); INSERT INTO votes (winner) VALUES ('Substituted');"
tar -czf "$swap_replacement" -C "$swap_source" pb_data
swap_digest=$(shasum -a 256 "$swap_original" | cut -d ' ' -f 1)
printf '%s  %s\n' "$swap_digest" "$(basename "$swap_original")" > "$swap_original.sha256"
real_shasum=$(command -v shasum)
cat > "$swap_wrapper/sha256sum" <<'SH'
#!/bin/sh
set -eu
digest=$($REAL_SHASUM -a 256 "$1" | cut -d ' ' -f 1)
cp "$SWAP_REPLACEMENT" "$1"
printf '%s  %s\n' "$digest" "$1"
SH
chmod 0755 "$swap_wrapper/sha256sum"
cat > "$swap_wrapper/sitecustomize.py" <<'PY'
import hashlib
import os
import shutil

_real_sha256 = hashlib.sha256
_replaced = False

class _ReplacingHash:
    def __init__(self, *args, **kwargs):
        self._inner = _real_sha256(*args, **kwargs)

    def update(self, *args, **kwargs):
        return self._inner.update(*args, **kwargs)

    def hexdigest(self):
        global _replaced
        result = self._inner.hexdigest()
        if not _replaced:
            replacement = os.environ["SWAP_REPLACEMENT"]
            archive = os.environ["SWAP_ARCHIVE"]
            temporary = archive + ".replacement"
            shutil.copyfile(replacement, temporary)
            os.replace(temporary, archive)
            _replaced = True
        return result

hashlib.sha256 = _ReplacingHash
PY
REAL_SHASUM="$real_shasum" SWAP_REPLACEMENT="$swap_replacement" SWAP_ARCHIVE="$swap_original" PYTHONPATH="$swap_wrapper" PATH="$swap_wrapper:$PATH" ARCHIVE="$swap_original" RESTORE_DIR="$swap_restore" bash "$RESTORE_SCRIPT" >/dev/null
[ "$(sqlite3 "$swap_restore/pb_data/data.db" 'SELECT winner FROM votes WHERE id = 1;')" = 'Pizza' ] || { echo 'restore accepted bytes substituted after checksum verification' >&2; exit 1; }

empty_archive="$BACKUPS/empty-root.tar.gz"
root_file_archive="$BACKUPS/root-file.tar.gz"
python3 - "$empty_archive" "$root_file_archive" <<'PY'
import io
import sys
import tarfile

empty_path, root_file_path = sys.argv[1:]
with tarfile.open(empty_path, "w:gz") as archive:
    root = tarfile.TarInfo("pb_data")
    root.type = tarfile.DIRTYPE
    archive.addfile(root)
with tarfile.open(root_file_path, "w:gz") as archive:
    payload = b"not a directory"
    root = tarfile.TarInfo("pb_data")
    root.size = len(payload)
    archive.addfile(root, io.BytesIO(payload))
PY
for invalid in "$empty_archive" "$root_file_archive"; do
  digest=$(shasum -a 256 "$invalid" | cut -d ' ' -f 1)
  printf '%s  %s\n' "$digest" "$(basename "$invalid")" > "$invalid.sha256"
done
if ARCHIVE="$empty_archive" RESTORE_DIR="$TMP_DIR/empty-root-restore" bash "$RESTORE_SCRIPT" >"$TMP_DIR/empty-root.out" 2>"$TMP_DIR/empty-root.err"; then
  echo 'expected archive without files to fail before publication' >&2
  exit 1
fi
grep -q 'restore produced no files' "$TMP_DIR/empty-root.err"
[ ! -e "$TMP_DIR/empty-root-restore" ] || { echo 'empty archive left a claimed destination' >&2; exit 1; }
if ARCHIVE="$root_file_archive" RESTORE_DIR="$TMP_DIR/root-file-restore" bash "$RESTORE_SCRIPT" >"$TMP_DIR/root-file.out" 2>"$TMP_DIR/root-file.err"; then
  echo 'expected regular-file pb_data root to fail' >&2
  exit 1
fi
grep -q 'top-level pb_data archive member must be a directory' "$TMP_DIR/root-file.err"
[ ! -e "$TMP_DIR/root-file-restore" ] || { echo 'invalid root type left a destination' >&2; exit 1; }

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
[ -z "$(find "$TMP_DIR" -maxdepth 1 -type d -name '.corrupt-restore.tmp.*' -print -quit)" ] || { echo 'corrupt restore left staging behind' >&2; exit 1; }

corrupt_special_archive="$BACKUPS/corrupt-special-sqlite.tar.gz"
corrupt_special_source="$TMP_DIR/corrupt-special-source"
mkdir -p "$corrupt_special_source/pb_data"
printf 'not a sqlite database' > "$corrupt_special_source/pb_data/corrupt?ignored.db"
tar -czf "$corrupt_special_archive" -C "$corrupt_special_source" pb_data
corrupt_special_digest=$(shasum -a 256 "$corrupt_special_archive" | cut -d ' ' -f 1)
printf '%s  %s\n' "$corrupt_special_digest" "$(basename "$corrupt_special_archive")" > "$corrupt_special_archive.sha256"
if ARCHIVE="$corrupt_special_archive" RESTORE_DIR="$TMP_DIR/corrupt-special-restore" bash "$RESTORE_SCRIPT" >"$TMP_DIR/corrupt-special.out" 2>"$TMP_DIR/corrupt-special.err"; then
  echo 'expected corrupt SQLite with URI metacharacters to fail validation' >&2
  exit 1
fi
grep -Eq 'DatabaseError|database disk image is malformed|file is not a database' "$TMP_DIR/corrupt-special.err"
[ ! -e "$TMP_DIR/corrupt-special-restore" ] || { echo 'corrupt special-name restore published a destination' >&2; exit 1; }
[ ! -e "$TMP_DIR/corrupt-special-source/pb_data/corrupt" ] || { echo 'restore URI parsing mutated the source fixture' >&2; exit 1; }
[ -z "$(find "$TMP_DIR" -maxdepth 1 -type d -name '.corrupt-special-restore.tmp.*' -print -quit)" ] || { echo 'corrupt special-name restore left staging behind' >&2; exit 1; }

bad_archive="$BACKUPS/bad.tar.gz"
printf 'not a tarball' > "$bad_archive"
if ARCHIVE="$bad_archive" RESTORE_DIR="$TMP_DIR/bad-restore" bash "$RESTORE_SCRIPT" >"$TMP_DIR/bad.out" 2>"$TMP_DIR/bad.err"; then
  echo 'expected bad archive to fail' >&2
  exit 1
fi
grep -q 'checksum file is required' "$TMP_DIR/bad.err"

echo 'pocketbase-restore-check.test.sh: OK'
