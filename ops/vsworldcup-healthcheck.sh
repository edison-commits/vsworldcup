#!/usr/bin/env bash
set -euo pipefail

FRONTEND_URL=${FRONTEND_URL:-http://127.0.0.1:3000}
API_HEALTH_URL=${API_HEALTH_URL:-http://127.0.0.1:3001/api/health}
PUBLIC_SITE_URL=${PUBLIC_SITE_URL:-https://vsworldcup.com}
PUBLIC_STATUS_URL=${PUBLIC_STATUS_URL:-https://status.vsworldcup.com}
AUTO_STATS_URL=${AUTO_STATS_URL:-http://127.0.0.1:3001/api/stats/auto-tournaments}
COUNTRY_STATS_URL=${COUNTRY_STATS_URL:-http://127.0.0.1:3001/api/stats/tournaments/monitor-health/country-winners?limit=1}
API_SERVICE=${API_SERVICE:-vsworldcup-api}
BACKUP_DIR=${BACKUP_DIR:-/opt/vsworldcup/backups/pocketbase}
AUTO_MAX_AGE_HOURS=${AUTO_MAX_AGE_HOURS:-36}
BACKUP_MAX_AGE_HOURS=${BACKUP_MAX_AGE_HOURS:-6}

failures=0
warnings=0
tmp_dir=$(mktemp -d)
cleanup() { rm -rf "$tmp_dir"; }
trap cleanup EXIT INT TERM

ok() {
  echo "OK $*"
}

fail() {
  echo "FAIL $*" >&2
  failures=$((failures + 1))
}

warn() {
  echo "WARN $*" >&2
  warnings=$((warnings + 1))
}

check_url() {
  local name=$1
  local url=$2
  local expected=${3:-200}
  local code
  if ! code=$(curl -sS -L -m 10 -o /dev/null -w '%{http_code}' "$url"); then
    fail "$name $url request-error"
    return
  fi
  if [ "$code" != "$expected" ]; then
    fail "$name $url expected=$expected got=$code"
    return
  fi
  ok "$name $url $code"
}

check_auto_freshness() {
  local body="$tmp_dir/auto-stats.json"
  local code details
  if ! code=$(curl -sS -m 10 -o "$body" -w '%{http_code}' "$AUTO_STATS_URL"); then
    fail "auto-generation-freshness $AUTO_STATS_URL request-error"
    return
  fi
  if [ "$code" != 200 ]; then
    fail "auto-generation-freshness $AUTO_STATS_URL expected=200 got=$code"
    return
  fi
  if ! details=$(python3 - "$body" "$AUTO_MAX_AGE_HOURS" 2>&1 <<'PY'
import datetime as dt
import json
import re
import sys

path, max_age = sys.argv[1], float(sys.argv[2])
with open(path, encoding="utf-8") as handle:
    payload = json.load(handle)
record = payload.get("last_created") or {}
tournament_id = record.get("id", "")
match = re.fullmatch(r"auto-(\d{4}-\d{2}-\d{2})", tournament_id)
if payload.get("ok") is not True or not match:
    raise SystemExit("missing valid last_created auto tournament")
created_raw = record.get("created")
if created_raw:
    normalized = str(created_raw).strip().replace(" ", "T", 1)
    if normalized.endswith("Z"):
        normalized = normalized[:-1] + "+00:00"
    try:
        created = dt.datetime.fromisoformat(normalized)
    except ValueError as exc:
        raise SystemExit(f"invalid last_created.created timestamp: {exc}")
    if created.tzinfo is None:
        created = created.replace(tzinfo=dt.timezone.utc)
    else:
        created = created.astimezone(dt.timezone.utc)
    source = "created"
else:
    created = dt.datetime.strptime(match.group(1), "%Y-%m-%d").replace(tzinfo=dt.timezone.utc)
    source = "id-date-fallback"
age = (dt.datetime.now(dt.timezone.utc) - created).total_seconds() / 3600
summary = f"last_created={tournament_id} age_hours={age:.1f} max_hours={max_age:g} source={source}"
if age < -24 or age > max_age:
    raise SystemExit(summary)
print(summary)
PY
  ); then
    fail "auto-generation-freshness ${details:-invalid-json-or-stale}"
    return
  fi
  ok "auto-generation-freshness $details"
}

check_fallback_use() {
  local cursor code logs
  if ! cursor=$(journalctl -u "$API_SERVICE" -n 0 --show-cursor --no-pager 2>/dev/null | sed -n 's/^-- cursor: //p' | tail -1) || [ -z "$cursor" ]; then
    fail "pocketbase-fallback unable-to-read-journal-cursor service=$API_SERVICE"
    return
  fi
  if ! code=$(curl -sS -m 10 -o /dev/null -w '%{http_code}' "$COUNTRY_STATS_URL"); then
    fail "pocketbase-fallback $COUNTRY_STATS_URL request-error"
    return
  fi
  if [ "$code" != 200 ]; then
    fail "pocketbase-fallback $COUNTRY_STATS_URL expected=200 got=$code"
    return
  fi
  if ! logs=$(journalctl -u "$API_SERVICE" --after-cursor "$cursor" --no-pager -o cat 2>/dev/null); then
    fail "pocketbase-fallback unable-to-read-journal service=$API_SERVICE"
    return
  fi
  if grep -Fq 'PocketBase API stats read failed, falling back to sqlite:' <<< "$logs"; then
    # The API deliberately falls back to the local read-only SQLite database
    # when its private PocketBase read is rejected. The route's 200 response
    # proves availability; preserve the fallback as an operational warning.
    warn "pocketbase-fallback sqlite-fallback-observed service=$API_SERVICE"
    return
  fi
  ok "pocketbase-fallback not-observed service=$API_SERVICE"
}

check_backup_age() {
  local details
  if ! details=$(python3 - "$BACKUP_DIR" "$BACKUP_MAX_AGE_HOURS" 2>&1 <<'PY'
import pathlib
import sys
import time

backup_dir, max_age = pathlib.Path(sys.argv[1]), float(sys.argv[2])
archives = list(backup_dir.glob("pocketbase-*.tar.gz"))
if not archives:
    raise SystemExit(f"no pocketbase backup archives in {backup_dir}")
latest = max(archives, key=lambda path: path.stat().st_mtime)
age = (time.time() - latest.stat().st_mtime) / 3600
if age < 0 or age > max_age:
    raise SystemExit(f"latest={latest.name} age_hours={age:.1f} max_hours={max_age:g}")
print(f"latest={latest.name} age_hours={age:.1f} max_hours={max_age:g}")
PY
  ); then
    fail "backup-age ${details:-missing-or-stale}"
    return
  fi
  ok "backup-age $details"
}

check_url frontend-local "$FRONTEND_URL"
check_url api-health "$API_HEALTH_URL"
check_url public-site "$PUBLIC_SITE_URL"
check_url public-status "$PUBLIC_STATUS_URL"
check_auto_freshness
check_fallback_use
check_backup_age

if [ "$failures" -gt 0 ]; then
  echo "SUMMARY FAIL failures=$failures" >&2
  exit 1
fi

echo "SUMMARY OK failures=0 warnings=$warnings"
