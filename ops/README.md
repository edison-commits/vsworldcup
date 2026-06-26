# vsworldcup Ops Scripts

This directory tracks the production-current VPS helper scripts that were previously only present in `/opt/vsworldcup` / the local VPS snapshot at `/Users/edison/Projects/vsworldcup`.

These files are source-control candidates for review only. Adding them here does **not** deploy, schedule, restart, or mutate production.

## Scripts

- `auto-tournament.py` — daily local-to-VPS automation that chooses a non-duplicate theme, calls the local API proxy at `http://localhost:3001/api/generate`, validates a 16-entry response, skips duplicate generated titles, and creates the featured PocketBase tournament record.
- `vsworldcup-healthcheck.sh` — non-mutating healthcheck for local frontend, local API health, and public site availability. It intentionally avoids `POST /api/generate` so healthchecks do not spend tokens or create AI/API load.

## Local verification

```bash
python3 -m unittest ops/auto_tournament_test.py
python3 -m py_compile ops/auto-tournament.py
bash -n ops/vsworldcup-healthcheck.sh
```

## Production boundary

Before these scripts are used for deployment or cron changes, get explicit approval and verify:

1. the canonical API proxy behavior matches production expectations;
2. `auto-tournament.py` duplicate checks and 16-entry guard still pass locally;
3. the next midnight UTC auto-tournament run has been checked after the 2026-06-26 production fix;
4. any cron/install paths are reviewed against the VPS layout.
