#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)
SCRIPT="$ROOT_DIR/ops/vsworldcup-healthcheck.sh"
TMP_DIR=$(mktemp -d 2>/dev/null || mktemp -d -t vsworldcup-healthcheck-test)
cleanup() { rm -rf "$TMP_DIR"; }
trap cleanup EXIT INT TERM

FAKE_BIN="$TMP_DIR/bin"
BACKUPS="$TMP_DIR/backups"
mkdir -p "$FAKE_BIN" "$BACKUPS"

cat > "$FAKE_BIN/curl" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
output=/dev/null
url=''
while [ "$#" -gt 0 ]; do
  case "$1" in
    -o) output=$2; shift 2 ;;
    -w|-m) shift 2 ;;
    -*) shift ;;
    *) url=$1; shift ;;
  esac
done
code=200
body='{}'
case "$url" in
  *status*) code=${FAKE_STATUS_CODE:-200} ;;
  *auto-tournaments*) body=${FAKE_AUTO_BODY:-'{"ok":true,"last_created":{"id":"auto-2099-01-01"}}'} ;;
esac
printf '%s' "$body" > "$output"
printf '%s' "$code"
SH

cat > "$FAKE_BIN/journalctl" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
case " $* " in
  *' --show-cursor '*) printf '%s\n' '-- cursor: test-cursor' ;;
  *)
    if [ "${FAKE_FALLBACK:-0}" = 1 ]; then
      echo 'PocketBase API stats read failed, falling back to sqlite: PocketBase play_sessions read failed: 403'
    fi
    ;;
esac
SH
chmod +x "$FAKE_BIN/curl" "$FAKE_BIN/journalctl"

read -r today fresh_created recent_id_date recent_created just_inside_created just_outside_created <<EOF
$(python3 - <<'PY'
import datetime as dt
now = dt.datetime.now(dt.timezone.utc)
print(
    now.date().isoformat(),
    (now - dt.timedelta(minutes=5)).isoformat().replace("+00:00", "Z"),
    (now - dt.timedelta(days=1)).date().isoformat(),
    (now - dt.timedelta(hours=1)).isoformat().replace("+00:00", "Z"),
    (now - dt.timedelta(hours=35, minutes=59)).isoformat().replace("+00:00", "Z"),
    (now - dt.timedelta(hours=36, minutes=1)).isoformat().replace("+00:00", "Z"),
)
PY
)
EOF
fresh_body="{\"ok\":true,\"last_created\":{\"id\":\"auto-$today\",\"created\":\"$fresh_created\"}}"
printf 'backup\n' > "$BACKUPS/pocketbase-test.tar.gz"

if grep -Eq 'POST|/api/generate' "$SCRIPT"; then
  echo 'healthcheck must not invoke the mutating generation endpoint' >&2
  exit 1
fi

run_healthcheck() {
  PATH="$FAKE_BIN:$PATH" \
    BACKUP_DIR="$BACKUPS" \
    FAKE_AUTO_BODY="${FAKE_AUTO_BODY:-$fresh_body}" \
    "$SCRIPT" "$@"
}

output=$(run_healthcheck)
printf '%s\n' "$output"
grep -q 'OK public-status' <<< "$output"
grep -q 'OK auto-generation-freshness' <<< "$output"
grep -q 'OK pocketbase-fallback not-observed' <<< "$output"
grep -q 'OK backup-age' <<< "$output"
grep -q 'SUMMARY OK failures=0 warnings=0' <<< "$output"

recent_timestamp_body="{\"ok\":true,\"last_created\":{\"id\":\"auto-$recent_id_date\",\"created\":\"$recent_created\"}}"
recent_output=$(FAKE_AUTO_BODY="$recent_timestamp_body" run_healthcheck)
grep -q 'OK auto-generation-freshness .*source=created' <<< "$recent_output"

just_inside_body="{\"ok\":true,\"last_created\":{\"id\":\"auto-$recent_id_date\",\"created\":\"$just_inside_created\"}}"
just_inside_output=$(FAKE_AUTO_BODY="$just_inside_body" run_healthcheck)
grep -q 'OK auto-generation-freshness .*source=created' <<< "$just_inside_output"

just_outside_body="{\"ok\":true,\"last_created\":{\"id\":\"auto-$recent_id_date\",\"created\":\"$just_outside_created\"}}"
if FAKE_AUTO_BODY="$just_outside_body" run_healthcheck >"$TMP_DIR/created-boundary.out" 2>"$TMP_DIR/created-boundary.err"; then
  echo 'expected a created timestamp just beyond the 36-hour limit to fail' >&2
  exit 1
fi
grep -q 'FAIL auto-generation-freshness .*max_hours=36.*source=created' "$TMP_DIR/created-boundary.err"

if FAKE_STATUS_CODE=502 run_healthcheck >"$TMP_DIR/status.out" 2>"$TMP_DIR/status.err"; then
  echo 'expected status dashboard failure to fail healthcheck' >&2
  exit 1
fi
grep -q 'FAIL public-status .* expected=200 got=502' "$TMP_DIR/status.err"

stale_body='{"ok":true,"last_created":{"id":"auto-2020-01-01"}}'
if FAKE_AUTO_BODY="$stale_body" run_healthcheck >"$TMP_DIR/auto.out" 2>"$TMP_DIR/auto.err"; then
  echo 'expected stale auto tournament to fail healthcheck' >&2
  exit 1
fi
grep -q 'FAIL auto-generation-freshness .*max_hours=36' "$TMP_DIR/auto.err"

FAKE_FALLBACK=1 run_healthcheck >"$TMP_DIR/fallback.out" 2>"$TMP_DIR/fallback.err"
grep -q 'WARN pocketbase-fallback sqlite-fallback-observed' "$TMP_DIR/fallback.err"
grep -q 'SUMMARY OK failures=0 warnings=1' "$TMP_DIR/fallback.out"

python3 - "$BACKUPS/pocketbase-test.tar.gz" <<'PY'
import os
import sys
import time
old = time.time() - 7 * 3600
os.utime(sys.argv[1], (old, old))
PY
if run_healthcheck >"$TMP_DIR/backup.out" 2>"$TMP_DIR/backup.err"; then
  echo 'expected stale backup to fail healthcheck' >&2
  exit 1
fi
grep -q 'FAIL backup-age .*max_hours=6' "$TMP_DIR/backup.err"

echo 'vsworldcup-healthcheck.test.sh: OK'