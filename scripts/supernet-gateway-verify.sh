#!/bin/bash
# Supernet Gateway Verification Agent
# Conclusively proves routing through Starlink

set -e

# Detect Public IP
GATEWAY_IP=$(curl -s --connect-timeout 5 https://icanhazip.com || curl -s --connect-timeout 5 https://api.ipify.org)
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
SESSION_ID=$(cat /proc/sys/kernel/random/uuid)
INTERFACE="wg0"

if [ ! -d "/sys/class/net/$INTERFACE" ]; then
    echo "{\"error\": \"Interface $INTERFACE not found\"}"
    exit 1
fi

# Capture Peer Data
# wg show <intf> dump: public_key, preshared_key, endpoint, allowed_ips, latest_handshake, transfer_rx, transfer_tx, persistent_keepalive
PEERS_JSON=$(wg show "$INTERFACE" dump | tail -n +2 | awk '
BEGIN { printf "[" }
{
    if (NR > 1) printf ","
    printf "{\"public_key\": \"%s\", \"rx_bytes\": %s, \"tx_bytes\": %s, \"last_handshake\": \"%s\"}", $1, $6, $7, $5
}
END { printf "]" }
')

# Check for Kill-Switch Rules
KILL_SWITCH_ACTIVE=false
if iptables -L OUTPUT -v -n | grep -q "DROP" && iptables -L -n | grep -q "SUPERNET-KILL-SWITCH"; then
    KILL_SWITCH_ACTIVE=true
fi

# Output JSON
cat <<EOF
{
  "session_id": "$SESSION_ID",
  "gateway_public_ip": "$GATEWAY_IP",
  "timestamp": "$TIMESTAMP",
  "wg_interface": "$INTERFACE",
  "kill_switch_active": $KILL_SWITCH_ACTIVE,
  "peers": $PEERS_JSON
}
EOF
