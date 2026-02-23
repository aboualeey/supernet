#!/bin/bash
# wg-sync.sh — Host-side telemetry relay for Supernet admin dashboard
# This script SSHes to the VPS (which Docker can't do due to GCP firewall),
# fetches wg show wg0 dump, and POSTs it to the backend API.
#
# Usage: Run automatically via crontab:
#   */1 * * * * /home/abubakar/supernet/wg-sync.sh >> /tmp/wg-sync.log 2>&1
#
# Or run manually: bash wg-sync.sh

VPS_HOST="35.226.38.168"
VPS_USER="ubuntu"
SSH_KEY="/home/abubakar/supernet/backend/google_compute_engine"
BACKEND_URL="http://localhost:3000/admin/ingest-telemetry"
TELEMETRY_SECRET="supernet-telemetry-secret-2024"

# Fetch wg dump from VPS
WG_DUMP=$(ssh -i "$SSH_KEY" \
  -o StrictHostKeyChecking=no \
  -o ConnectTimeout=8 \
  -o ServerAliveInterval=5 \
  "$VPS_USER@$VPS_HOST" \
  "sudo wg show wg0 dump" 2>/dev/null)

if [ -z "$WG_DUMP" ]; then
  echo "[$(date)] wg-sync: VPS unreachable or empty dump." >&2
  exit 1
fi

# Escape the dump for JSON (replace tabs, newlines, quotes)
JSON_DUMP=$(echo "$WG_DUMP" | python3 -c "
import sys, json
data = sys.stdin.read()
print(json.dumps({'dump': data}))
")

# POST to backend
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$BACKEND_URL" \
  -H "Content-Type: application/json" \
  -H "x-telemetry-secret: $TELEMETRY_SECRET" \
  -d "$JSON_DUMP")

if [ "$HTTP_STATUS" = "201" ] || [ "$HTTP_STATUS" = "200" ]; then
  echo "[$(date)] wg-sync: OK (HTTP $HTTP_STATUS) — $(echo "$WG_DUMP" | wc -l) peer lines"
else
  echo "[$(date)] wg-sync: backend returned HTTP $HTTP_STATUS" >&2
fi
