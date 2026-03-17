#!/bin/bash
set -euo pipefail

APP_DIR="/opt/vsworldcup/vs-worldcup"
SERVICE_NAME="vsworldcup"

cd "$APP_DIR"
echo "--- build ---"
npm run build

echo "--- restart ---"
systemctl restart "$SERVICE_NAME.service"
systemctl is-active "$SERVICE_NAME.service"

echo "--- local app check ---"
curl -s --head http://127.0.0.1:3000 | grep "HTTP/1.1 200 OK"

echo "--- public app check ---"
curl -s --head https://vsworldcup.com | grep "HTTP/2 200"

echo "--- api generate check ---"
API_BODY=$(mktemp)
trap 'rm -f "$API_BODY"' EXIT
API_CODE=$(curl -s -o "$API_BODY" -w "%{http_code}" -X POST https://api.vsworldcup.com/api/generate \
  -H "Content-Type: application/json" \
  --data '{"prompt":"best pizza toppings","count":4}')
if [ "$API_CODE" != "200" ] || ! grep -q '"entries"' "$API_BODY"; then
  echo "API check failed" >&2
  sed -n "1,40p" "$API_BODY" >&2 || true
  exit 1
fi

echo "--- deploy and smoke passed ---"
