#!/usr/bin/env bash
set -euo pipefail

FRONTEND_URL=${FRONTEND_URL:-http://127.0.0.1:3000}
API_HEALTH_URL=${API_HEALTH_URL:-http://127.0.0.1:3001/api/health}
PUBLIC_SITE_URL=${PUBLIC_SITE_URL:-https://vsworldcup.com}

check_url() {
  local name=$1
  local url=$2
  local expected=${3:-200}
  local code
  code=$(curl -fsS -m 10 -o /dev/null -w '%{http_code}' "$url")
  if [ "$code" != "$expected" ]; then
    echo "FAIL $name $url expected=$expected got=$code" >&2
    return 1
  fi
  echo "OK $name $url $code"
}

check_url frontend-local "$FRONTEND_URL"
check_url api-health "$API_HEALTH_URL"
check_url public-site "$PUBLIC_SITE_URL"
