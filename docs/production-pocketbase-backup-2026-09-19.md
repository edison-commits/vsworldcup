# VSWorldCup production access and PocketBase snapshot — 2026-09-19

## Scope and outcome

Production access was established through the existing root SSH identity at `~/.ssh/vsworldcup_deploy` to the previously inventoried Hetzner host `5.78.130.174` (`vs-worldcup`). No credential value was printed or copied. No production record was deleted or modified.

A per-database-consistent on-host PocketBase backup was created, checksum-verified, safely extracted into an isolated temporary directory, checked with SQLite, and booted with the deployed PocketBase binary on a loopback-only temporary port. The databases and storage files were captured sequentially while the service remained live, so this is not a single point-in-time transaction across every database and file. No recurring schedule, retention deletion, or off-host copy was configured.

## Production inventory

- Host: `5.78.130.174` (`vs-worldcup`), Linux 6.8.0-106-generic
- PocketBase: version `0.25.9`
- PocketBase binary: `/opt/pocketbase/pocketbase`
- PocketBase binary SHA-256: `9ca741ab236ae670dbc34dde13e2b07540ca8b962c59b8ed78a5cf950e1ca425`
- PocketBase service: `pocketbase.service`, active, root, working directory `/opt/pocketbase`
- PocketBase data: `/opt/pocketbase/pb_data`
- Frontend service: `vsworldcup.service`, active, working directory `/opt/vsworldcup/vs-worldcup`
- API service: `vsworldcup-api.service`, active, working directory `/opt/vsworldcup/api-proxy`
- Backup helper: `/opt/vsworldcup/ops/pocketbase-backup.sh`
- Restore-check helper: `/opt/vsworldcup/ops/pocketbase-restore-check.sh`
- Local backup directory: `/opt/vsworldcup/backups/pocketbase`, mode `0700`, owner `root:root`

The live data directory contained `data.db`, `auxiliary.db`, and active WAL/SHM sidecars. The canonical helper was hardened before use so every non-empty top-level `*.db` is copied through SQLite's online-backup API. Each staged database is normalized to DELETE journal mode, and live or staging-generated `*.db-wal` and `*.db-shm` files are excluded after committed WAL content is folded into the database. The empty `pocketbase.db` placeholder is preserved as an ordinary empty file. This provides SQLite consistency for each database independently; quiescing PocketBase is still required when a recovery point must be transactionally aligned across multiple databases and storage files.

## Snapshot receipt

- Archive: `/opt/vsworldcup/backups/pocketbase/pocketbase-20260919T160728Z.tar.gz`
- Checksum file: `/opt/vsworldcup/backups/pocketbase/pocketbase-20260919T160728Z.tar.gz.sha256`
- SHA-256: `498c405634470e1beff4b7417f627503a1d4d57fc9925e50008698fda9d045f5`
- Compressed size: `225,889,544` bytes
- Archive/checksum mode: `0600` inside a `0700` root-owned directory
- Temporary restore proof: `/tmp/vsworldcup-pb-restore-proof-20260919T160728Z` (removed after verification)
- Restored file count: `8`
- Restored non-empty SQLite databases: `2`
- Archive WAL/SHM sidecars: `0`
- Filesystem after snapshot and restore proof: 27% used, 53 GiB available

The helper created online backups of `auxiliary.db` and `data.db`, preserved the empty `pocketbase.db` placeholder, staged the remaining PocketBase files, created the archive atomically, and wrote the portable checksum file. `sha256sum -c` returned `OK`.

## Restored database counts

All counts below were read from the isolated restored copy, not production.

### `auxiliary.db`

- Size: `2,422,882,304` bytes
- `PRAGMA integrity_check`: `ok`
- Application tables: `1`
- Total rows: `14,656`
- `_logs`: `14,656`

### `data.db`

- Size: `458,752` bytes
- `PRAGMA integrity_check`: `ok`
- Application/system tables: `14`
- Total rows: `182`
- `_authOrigins`: `2`
- `_collections`: `11`
- `_externalAuths`: `0`
- `_mfas`: `0`
- `_migrations`: `18`
- `_otps`: `0`
- `_params`: `1`
- `_superusers`: `2`
- `feedback`: `10`
- `items`: `0`
- `match_results`: `9`
- `play_sessions`: `30`
- `tournaments`: `99`
- `users`: `0`

### `pocketbase.db`

- Size: `0` bytes
- Classification: preserved empty placeholder; SQLite integrity check not applicable

## Restore proof

The restore checker verified the supplied archive checksum, preflighted every member for the expected `pb_data/` layout, rejected links/special files/traversal/duplicates and excessive expanded size, extracted regular files through a private temporary directory, checked both non-empty SQLite databases with `PRAGMA integrity_check`, and verified restored file/database counts. The adjacent checksum detects accidental or unexpected changes relative to the supplied digest; it is not a cryptographic authenticity signature.

The restored data was then started with the production PocketBase `0.25.9` binary using:

```bash
/opt/pocketbase/pocketbase serve \
  --dir /tmp/vsworldcup-pb-restore-proof-20260919T160728Z/pb_data \
  --http=127.0.0.1:18091 \
  --automigrate=false \
  --hooksWatch=false
```

`GET http://127.0.0.1:18091/api/health` returned PocketBase code `200` and `API is healthy.` The isolated process was then stopped and port `18091` was confirmed closed. The production `pocketbase`, `vsworldcup`, and `vsworldcup-api` services remained active. Fresh external checks returned HTTP 200 for the public home page and API health endpoint.

## Off-host disposition

No approved/configured off-host destination was found. A bounded search found no PocketBase backup timer/cron or configured `REMOTE_TARGET`, rclone, restic, borg, rsync host, or object-storage target. In accordance with the task boundary, the archive was not copied to an unapproved destination and no storage account, bucket, credential, or paid service was created.

This on-host snapshot is a verified rollback artifact, but it does not protect against total VPS loss. Off-host replication and recurring scheduling remain separate follow-up decisions.

## Rollback / restore procedure

The snapshot operation itself is non-mutating, so no rollback is needed for its creation. To restore this recovery point during an approved outage/change window:

```bash
set -euo pipefail
archive=/opt/vsworldcup/backups/pocketbase/pocketbase-20260919T160728Z.tar.gz
proof=/tmp/vsworldcup-pb-pre-restore-check
safety=/opt/pocketbase/pb_data.pre-restore-$(date -u +%Y%m%dT%H%M%SZ)

rm -rf "$proof"
ARCHIVE="$archive" RESTORE_DIR="$proof" \
  /opt/vsworldcup/ops/pocketbase-restore-check.sh

systemctl stop pocketbase
mv /opt/pocketbase/pb_data "$safety"
install -d -m 0755 /opt/pocketbase
mv "$proof/pb_data" /opt/pocketbase/pb_data
chown -R root:root /opt/pocketbase/pb_data
systemctl start pocketbase
systemctl is-active pocketbase
curl -fsS http://127.0.0.1:8090/api/health
```

If validation fails, stop PocketBase, move the failed restored directory aside, move `$safety` back to `/opt/pocketbase/pb_data`, restore `root:root` ownership, start PocketBase, and re-run local/public health checks. Do not delete the safety directory or snapshot until the restored service and representative application reads are verified.
