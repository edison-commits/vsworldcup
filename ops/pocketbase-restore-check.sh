#!/usr/bin/env bash
set -euo pipefail

log() { printf '[pocketbase-restore-check] %s\n' "$*"; }
fail() { printf '[pocketbase-restore-check] ERROR: %s\n' "$*" >&2; exit 1; }

ARCHIVE=${ARCHIVE:-}
RESTORE_DIR=${RESTORE_DIR:-}

[ -n "$ARCHIVE" ] || fail 'ARCHIVE is required'
[ -n "$RESTORE_DIR" ] || fail 'RESTORE_DIR is required'
[ -f "$ARCHIVE" ] || fail "ARCHIVE does not exist: $ARCHIVE"
[ -f "$ARCHIVE.sha256" ] || fail "checksum file is required: $ARCHIVE.sha256"
[ ! -e "$RESTORE_DIR" ] || fail "RESTORE_DIR already exists; choose an empty proof directory: $RESTORE_DIR"

expected_digest=$(awk 'NR == 1 { print $1; exit }' "$ARCHIVE.sha256" | tr '[:upper:]' '[:lower:]')
[[ "$expected_digest" =~ ^[[:xdigit:]]{64}$ ]] || fail "checksum file does not contain a SHA-256 digest: $ARCHIVE.sha256"

if command -v sha256sum >/dev/null 2>&1; then
  actual_digest=$(sha256sum "$ARCHIVE" | cut -d ' ' -f 1)
elif command -v shasum >/dev/null 2>&1; then
  actual_digest=$(shasum -a 256 "$ARCHIVE" | cut -d ' ' -f 1)
else
  fail 'neither sha256sum nor shasum is available for checksum verification'
fi
[ "$actual_digest" = "$expected_digest" ] || fail "checksum verification failed for supplied ARCHIVE: $ARCHIVE"

command -v python3 >/dev/null 2>&1 || fail 'python3 is required to verify restored SQLite databases'
MAX_RESTORE_FILES=${MAX_RESTORE_FILES:-100000}
MAX_RESTORE_BYTES=${MAX_RESTORE_BYTES:-21474836480}
python3 - "$ARCHIVE" "$RESTORE_DIR" "$MAX_RESTORE_FILES" "$MAX_RESTORE_BYTES" <<'PY'
import os
from pathlib import Path, PurePosixPath
import shutil
import sqlite3
import sys
import tarfile

archive_path, restore_path, max_files_raw, max_bytes_raw = sys.argv[1:]
try:
    max_files = int(max_files_raw)
    max_bytes = int(max_bytes_raw)
except ValueError as exc:
    raise SystemExit(f"restore limits must be integers: {exc}")
if max_files < 1 or max_bytes < 1:
    raise SystemExit("restore limits must be positive")

restore = Path(restore_path)
temporary = restore.with_name(f"{restore.name}.tmp.{os.getpid()}")
seen = set()
members = []
member_count = 0
total_bytes = 0

try:
    with tarfile.open(archive_path, "r:gz") as archive:
        for member in archive:
            member_count += 1
            if member_count > max_files:
                raise SystemExit("archive exceeds configured restore limits")
            path = PurePosixPath(member.name)
            parts = path.parts
            if path.is_absolute() or not parts or parts[0] != "pb_data" or ".." in parts:
                raise SystemExit(f"unsafe archive member path: {member.name}")
            normalized = path.as_posix()
            if normalized in seen:
                raise SystemExit(f"duplicate archive member: {member.name}")
            seen.add(normalized)
            if not (member.isdir() or member.isreg()):
                raise SystemExit(f"unsupported archive member type: {member.name}")
            if member.isreg():
                total_bytes += member.size
                if total_bytes > max_bytes:
                    raise SystemExit("archive exceeds configured restore limits")
            members.append((member, path))

        if not members or not any(path.parts == ("pb_data",) for _, path in members):
            raise SystemExit("archive must contain a top-level pb_data directory")

        temporary.mkdir(mode=0o700, parents=False)
        for member, path in members:
            destination = temporary.joinpath(*path.parts)
            if member.isdir():
                destination.mkdir(mode=0o700, parents=True, exist_ok=True)
                continue
            destination.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
            source = archive.extractfile(member)
            if source is None:
                raise SystemExit(f"could not read archive member: {member.name}")
            with source, destination.open("xb") as output:
                shutil.copyfileobj(source, output)
            destination.chmod(0o600)

    sqlite_databases = 0
    for restored_db in temporary.rglob("*.db"):
        if not restored_db.is_file() or restored_db.stat().st_size == 0:
            continue
        connection = sqlite3.connect(f"file:{restored_db}?mode=ro", uri=True)
        try:
            result = connection.execute("PRAGMA integrity_check").fetchone()
            if result != ("ok",):
                raise SystemExit(
                    f"restored SQLite integrity_check failed for {restored_db}: {result}"
                )
        finally:
            connection.close()
        sqlite_databases += 1

    os.replace(temporary, restore)
    if sqlite_databases:
        print("[pocketbase-restore-check] integrity=ok")
    else:
        print("[pocketbase-restore-check] integrity=skipped no-nonempty-sqlite-databases")
    print(f"[pocketbase-restore-check] sqlite_databases={sqlite_databases}")
except BaseException:
    shutil.rmtree(temporary, ignore_errors=True)
    raise
PY

file_count=$(find "$RESTORE_DIR" -type f | wc -l | tr -d ' ')
[ "$file_count" -gt 0 ] || fail 'restore produced no files'
log "restored_files=$file_count"
log 'restore-check=ok'
