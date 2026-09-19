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

command -v python3 >/dev/null 2>&1 || fail 'python3 is required to verify restored SQLite databases'
MAX_RESTORE_FILES=${MAX_RESTORE_FILES:-100000}
MAX_RESTORE_BYTES=${MAX_RESTORE_BYTES:-21474836480}
python3 - "$ARCHIVE" "$RESTORE_DIR" "$MAX_RESTORE_FILES" "$MAX_RESTORE_BYTES" "$expected_digest" <<'PY'
import hashlib
import os
from pathlib import Path, PurePosixPath
import shutil
import secrets
import sqlite3
import sys
import tarfile
import tempfile

archive_path, restore_path, max_files_raw, max_bytes_raw, expected_digest = sys.argv[1:]
try:
    max_files = int(max_files_raw)
    max_bytes = int(max_bytes_raw)
except ValueError as exc:
    raise SystemExit(f"restore limits must be integers: {exc}")
if max_files < 1 or max_bytes < 1:
    raise SystemExit("restore limits must be positive")

restore = Path(restore_path)
temporary = None
temporary_fd = None
destination_claimed = False
restore_fd = None
seen = set()
members = []
member_count = 0
total_bytes = 0

try:
    with open(archive_path, "rb") as archive_file:
        digest = hashlib.sha256()
        while chunk := archive_file.read(1024 * 1024):
            digest.update(chunk)
        actual_digest = digest.hexdigest()
        if actual_digest != expected_digest:
            raise SystemExit(
                f"checksum verification failed for supplied ARCHIVE: {archive_path}"
            )
        archive_file.seek(0)
        with tarfile.open(fileobj=archive_file, mode="r:gz") as archive:
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

            root_members = [
                member for member, path in members if path.parts == ("pb_data",)
            ]
            if not root_members:
                raise SystemExit("archive must contain a top-level pb_data directory")
            if not root_members[0].isdir():
                raise SystemExit("top-level pb_data archive member must be a directory")

            temporary = Path(tempfile.mkdtemp(
                prefix=f".{restore.name}.tmp.", dir=str(restore.parent)
            ))
            temporary_fd = os.open(temporary, os.O_RDONLY)
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
    for restored_db in (temporary / "pb_data").glob("*.db"):
        if not restored_db.is_file() or restored_db.stat().st_size == 0:
            continue
        database_uri = restored_db.resolve(strict=True).as_uri() + "?mode=ro"
        connection = sqlite3.connect(database_uri, uri=True)
        try:
            result = connection.execute("PRAGMA integrity_check").fetchone()
            if result != ("ok",):
                raise SystemExit(
                    f"restored SQLite integrity_check failed for {restored_db}: {result}"
                )
        finally:
            connection.close()
        sqlite_databases += 1

    restored_files = sum(1 for path in temporary.rglob("*") if path.is_file())
    if restored_files == 0:
        raise SystemExit("restore produced no files")

    # Claim the final directory only after validation. mkdir(exist_ok=False)
    # is the exclusive operation that closes the check-then-replace race.
    restore.mkdir(mode=0o700, parents=False, exist_ok=False)
    destination_claimed = True
    restore_fd = os.open(restore, os.O_RDONLY)
    os.replace(temporary / "pb_data", restore / "pb_data")
    temporary.rmdir()
    os.close(temporary_fd)
    temporary_fd = None
    temporary = None
    if sqlite_databases:
        print("[pocketbase-restore-check] integrity=ok")
    else:
        print("[pocketbase-restore-check] integrity=skipped no-nonempty-sqlite-databases")
    print(f"[pocketbase-restore-check] sqlite_databases={sqlite_databases}")
    print(f"[pocketbase-restore-check] restored_files={restored_files}")
    os.close(restore_fd)
    restore_fd = None
except BaseException:
    def remove_owned_tree(path, descriptor, label):
        if path is None or descriptor is None:
            return
        quarantine = path.with_name(
            f"{path.name}.retained.{secrets.token_hex(8)}"
        )
        try:
            os.rename(path, quarantine)
        except FileNotFoundError:
            return
        current = os.lstat(quarantine)
        owned = os.fstat(descriptor)
        if os.path.samestat(current, owned):
            shutil.rmtree(quarantine)
        else:
            print(
                f"[pocketbase-restore-check] retained-{label}={quarantine}",
                file=sys.stderr,
            )

    remove_owned_tree(temporary, temporary_fd, "failed-staging")
    if destination_claimed:
        remove_owned_tree(restore, restore_fd, "failed-destination")
    for descriptor in (temporary_fd, restore_fd):
        if descriptor is not None:
            try:
                os.close(descriptor)
            except OSError:
                pass
    raise
PY
log 'restore-check=ok'
