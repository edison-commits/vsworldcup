# VSWorldCup expanded monitoring and maintenance reboot — 2026-09-19

## Outcome

The production healthcheck now detects the public status dashboard, auto-tournament freshness, PocketBase stats fallback activation, and PocketBase backup age in addition to the existing local frontend, local API, and public-site checks. It uses only GET requests and filesystem/journal reads; it never calls `POST /api/generate`.

The healthcheck was installed with a checksummed rollback copy, passed directly, and passed from its existing `*/15` cron entry after the reboot. The separately approved maintenance reboot completed after the status-routing, PocketBase-auth, and tournament-deduplication work had finished and after current-state backups were verified. A 924-second post-reboot observation produced 17/17 passing samples.

## Monitoring contract

Installed path: `/opt/vsworldcup/vsworldcup-healthcheck.sh`

Historical installed SHA-256 observed during the reboot window: `60ba8d2973262abc70578e33a4a8e4f7c5170070c80155b6f11852c6b6eeb825`.

The later source candidate uses `last_created.created` with an ID-date fallback and has SHA-256 `d80cd44ddb248bf4b085f08131e2d711c72f518604826cc8d792d33814d66ecf`. It is verified locally but was not installed during the historical observation documented here; merging this receipt does not claim that production already runs that revision.

Default checks:

- local frontend: `http://127.0.0.1:3000`
- local API health: `http://127.0.0.1:3001/api/health`
- public site: `https://vsworldcup.com`
- public status dashboard: `https://status.vsworldcup.com` (redirects followed)
- auto-generation freshness: local read-only `GET /api/stats/auto-tournaments`, using `last_created.created` with an explicitly labeled ID-date fallback, maximum age 36 hours
- PocketBase fallback: read-only country-winner request plus journal cursor inspection for the existing observable SQLite-fallback warning
- backup freshness: newest `/opt/vsworldcup/backups/pocketbase/pocketbase-*.tar.gz`, maximum age 6 hours

The script aggregates failures, exits nonzero when any check fails, and emits a final `SUMMARY OK` or `SUMMARY FAIL` line. Local regression coverage exercises healthy output plus status failure, stale generation, fallback activation, stale backup, and the prohibition on `POST`/`/api/generate` in the monitor.

## Install and rollback

The prior script and cron file were copied before installation to:

`/opt/vsworldcup/deploy-backups/healthcheck-20260919T163720Z`

The directory contains a verified `SHA256SUMS` file. Recorded hashes:

- prior `vsworldcup-healthcheck.sh`: `68e5436d61f69c57ee38ab53d3bb65f0e5f8d99889cfc3b0dee8c93779a185f2`
- prior `vsworldcup-healthcheck.cron`: `86638f2e4142b616a25999650ef1314c7daf6b5791827c0bbadbd7fcf6de2673`

Exact monitor rollback:

```bash
set -euo pipefail
backup=/opt/vsworldcup/deploy-backups/healthcheck-20260919T163720Z
cd "$backup"
sha256sum -c SHA256SUMS
install -o root -g root -m 0755 "$backup/vsworldcup-healthcheck.sh" /opt/vsworldcup/vsworldcup-healthcheck.sh
install -o root -g root -m 0644 "$backup/vsworldcup-healthcheck.cron" /etc/cron.d/vsworldcup-healthcheck
bash -n /opt/vsworldcup/vsworldcup-healthcheck.sh
/opt/vsworldcup/vsworldcup-healthcheck.sh
```

No service restart is required for this file-and-cron rollback.

## Backup and automation recovery evidence

Before the reboot, the current post-remediation PocketBase state was backed up and restore-checked. After the controlled recovery run of the repaired daily writer, a second current-state backup was created and checksum-verified:

- archive: `/opt/vsworldcup/backups/pocketbase/pocketbase-20260919T163507Z.tar.gz`
- SHA-256: `e8aeb8b685325f49d9b9f35ca5df4aa1805125ecd81278ec94c57e07447947af`
- size: 225,796,389 bytes
- mode: `0600` in the root-owned backup directory

The controlled invocation of the same command used by daily cron created `auto-2026-09-19`, titled `Greatest Rock Bands of All Time`, with exactly 16 generated entries. Independent production readback confirmed it is present and active; the active total rose from the post-deduplication 96 to 97, duplicate `tournament_id` groups remain zero, the public active API returns HTTP 200 with 97 items, and SQLite integrity is `ok`.

The periodic healthcheck itself did not perform this write and contains no generation POST.

## Reboot receipt

Pre-reboot:

- time: `2026-09-19T16:37:35Z`
- boot ID: `f9cec277-986b-4b90-ba2e-1a48cb87d018`
- uptime: 25 weeks, 2 days, 10 hours, 47 minutes
- failed systemd units: 0
- package-manager lock files: all unlocked; no active apt/dpkg transaction
- fresh backup checksum: passed
- expanded healthcheck: `SUMMARY OK failures=0`

Post-reboot:

- new boot ID: `b378e36c-ffc6-4c1e-9feb-c2cc63a1ad01`
- `/var/run/reboot-required`: absent
- active units: `pocketbase`, `vsworldcup-api`, `vsworldcup`, `docker`, `cron`
- failed systemd units: 0
- local HTTP 200: frontend 3000, API 3001, Uptime Kuma 3002, Umami 3003, PocketBase 8090
- public HTTP 200 after redirects: home, API health, status, analytics
- Docker: 13 running containers; relevant healthchecked containers healthy
- `coolify-sentinel` remains the one historical stopped container (`Exited (0)` for five months, restart policy `no`); this was unchanged and is not a reboot failure
- current automation state: `today_created=true`, `last_created=auto-2026-09-19`, public active total 97, zero duplicate tournament IDs
- database: `PRAGMA integrity_check = ok`
- relevant core service error logs since boot: 0 for PocketBase, API, frontend, and Docker
- cron emitted one boot-time warning that unset optional `EXTRA_OPTS` evaluated empty; cron remained active and executed the healthcheck successfully

## Cron proof

The existing entry remains:

`*/15 * * * * root /bin/bash -c '/opt/vsworldcup/vsworldcup-healthcheck.sh' >> /opt/vsworldcup/logs/healthcheck.log 2>&1`

At `2026-09-19 16:45:02Z`, after the reboot, `/opt/vsworldcup/logs/healthcheck.log` was updated with all seven checks passing and `SUMMARY OK failures=0`. The cron journal independently recorded the healthcheck command invocation.

## Fifteen-minute observation

Durable sanitized evidence: `docs/evidence/post-reboot-monitor-2026-09-19.md`. The private task artifact retains the complete individual sample log.

- first sample: `2026-09-19T16:40:40Z`
- final sample: `2026-09-19T16:56:04Z`
- elapsed: 924 seconds
- samples: 17
- passing samples: 17

Every sample confirmed public home/API/status/analytics HTTP 200, zero failed systemd units, no unhealthy/restarting/dead relevant containers, and `SUMMARY OK failures=0` from the expanded production monitor.
