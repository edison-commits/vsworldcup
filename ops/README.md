# vsworldcup Ops Scripts

This directory tracks the production-current VPS helper scripts that were previously only present in `/opt/vsworldcup` / the local VPS snapshot at `/Users/edison/Projects/vsworldcup`.

These files are source-control candidates for review only. Adding them here does **not** deploy, schedule, restart, or mutate production.

## Scripts

- `auto-tournament.py` — daily local-to-VPS automation that chooses a non-duplicate theme, calls the local API proxy at `http://localhost:3001/api/generate`, validates a 16-entry response, skips duplicate generated titles, and creates the featured PocketBase tournament record.
- `vsworldcup-healthcheck.sh` — non-mutating healthcheck for local frontend, local API health, and public site availability. It intentionally avoids `POST /api/generate` so healthchecks do not spend tokens or create AI/API load.
- `pocketbase-backup.sh` — source-controlled backup helper candidate. It requires explicit `PB_DATA_DIR` and `BACKUP_DIR`, rejects nested source/destination paths, stages `data.db` through SQLite online backup when present, copies other PocketBase files into a temporary staging directory, writes timestamped `.tar.gz` archives through temporary files plus `.sha256` checksums, verifies checksum/archive listing/restored SQLite integrity in tests, uses a lock directory, and refuses remote copy/prune behavior unless explicitly enabled. It is **not** installed or scheduled by this repo change.
- `pocketbase-restore-check.sh` — restore-proof helper. It requires an archive and matching `.sha256`, refuses to overwrite an existing restore directory, extracts to a proof directory, runs SQLite `PRAGMA integrity_check` when `data.db` is present, and reports restored file count. Use this after the first approved production snapshot and for periodic restore drills.

## Local verification

```bash
python3 -m unittest ops/auto_tournament_test.py
python3 -m py_compile ops/auto-tournament.py
bash -n ops/vsworldcup-healthcheck.sh
bash -n ops/pocketbase-backup.sh
bash -n ops/pocketbase-restore-check.sh
bash ops/pocketbase-backup.test.sh
bash ops/pocketbase-restore-check.test.sh
```

## Production boundary

Before these scripts are used for deployment or cron changes, get explicit approval and verify:

1. the canonical API proxy behavior matches production expectations;
2. `auto-tournament.py` duplicate checks and 16-entry guard still pass locally;
3. the next midnight UTC auto-tournament run has been checked after the 2026-06-26 production fix;
4. the PocketBase backup path uses a consistency-safe source for SQLite data (the local helper now stages `data.db` with SQLite online backup when present; production still needs approved layout confirmation, destination, first-run window, and restore proof before scheduling);
5. any cron/install paths are reviewed against the VPS layout.
