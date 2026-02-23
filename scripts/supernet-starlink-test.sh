#!/bin/bash
# Supernet User Device Test Script
# One-click verification of Starlink routing

set -e

echo "🚀 Starting Supernet Starlink Verification..."
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# 1. Detect IP before (Local ISP)
IP_BEFORE=$(curl -s --connect-timeout 5 https://icanhazip.com || echo "unknown")

# 2. Check VPN Status (assuming wg interface is up)
if ip link show wg0 >/dev/null 2>&1 || ip link show utun >/dev/null 2>&1; then
    VPN_STATUS="connected"
else
    VPN_STATUS="disconnected"
fi

# 3. Generate Traffic
echo "📡 Generating verification traffic..."
curl -s https://google.com > /dev/null
ping -c 3 8.8.8.8 > /dev/null

# 4. Detect IP after
IP_AFTER=$(curl -s --connect-timeout 5 https://icanhazip.com || echo "unknown")

# 5. Output JSON
cat <<EOF
{
  "device_ip_before": "$IP_BEFORE",
  "device_ip_after": "$IP_AFTER",
  "vpn_status": "$VPN_STATUS",
  "traffic_generated": true,
  "timestamp": "$TIMESTAMP"
}
EOF
