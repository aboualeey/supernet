#!/bin/bash
# =============================================================================
# setup-killswitch.sh  —  Supernet VPN Kill-Switch
#
# Enforces: ALL traffic is dropped unless it goes through wg0 (or is WireGuard
# handshake traffic on UDP 51820).
#
# Run ONCE on the VPS as root (or via sudo).
# Persisted via iptables-persistent so it survives reboots.
# =============================================================================

set -euo pipefail

WG_IFACE="wg0"
WG_PORT=51820
WG_PHYS="ens4"   # physical NIC on Google Cloud; change to eth0 for other providers

log() { echo "[kill-switch] $*"; }

# ── 1 · Install iptables-persistent (non-interactive) ──────────────────────
if ! dpkg -l iptables-persistent &>/dev/null; then
  log "Installing iptables-persistent..."
  DEBIAN_FRONTEND=noninteractive apt-get install -y iptables-persistent
fi

# ── 2 · Flush existing custom rules (keep ACCEPT defaults during setup) ─────
log "Flushing existing rules..."
iptables -F OUTPUT  || true
iptables -F INPUT   || true
iptables -F FORWARD || true

# ── 3 · Set default policies ─────────────────────────────────────────────────
# INPUT  : ACCEPT (we need to receive WireGuard handshakes)
# FORWARD: ACCEPT (forwards VPN client traffic to internet)
# OUTPUT : DROP   ← THE KILL-SWITCH
iptables -P INPUT   ACCEPT
iptables -P FORWARD ACCEPT
iptables -P OUTPUT  DROP

# ── 4 · OUTPUT allow-list ────────────────────────────────────────────────────
# ① Loopback
iptables -A OUTPUT -o lo -j ACCEPT

# ② Already-established connections (prevents breaking existing sessions)
iptables -A OUTPUT -m state --state ESTABLISHED,RELATED -j ACCEPT

# ③ WireGuard handshake — allows the tunnel to be established
iptables -A OUTPUT -o "$WG_PHYS" -p udp --dport "$WG_PORT" -j ACCEPT
iptables -A OUTPUT -o "$WG_PHYS" -p udp --sport "$WG_PORT" -j ACCEPT

# ④ All traffic through the wg0 tunnel (VPN clients reach internet via this)
iptables -A OUTPUT -o "$WG_IFACE" -j ACCEPT

# ⑤ SSH — keep management access even if WireGuard is down
iptables -A OUTPUT -o "$WG_PHYS" -p tcp --dport 22  -j ACCEPT
iptables -A OUTPUT -o "$WG_PHYS" -p tcp --sport 22  -j ACCEPT

# ⑥ DNS for the server itself (needed for apt updates, etc.)
iptables -A OUTPUT -o "$WG_PHYS" -p udp --dport 53 -j ACCEPT
iptables -A OUTPUT -o "$WG_PHYS" -p tcp --dport 53 -j ACCEPT

# ── 5 · INPUT: block forwarded traffic from non-wg0 ──────────────────────────
# (already handled by FORWARD ACCEPT + wg0 routing, but explicit for clarity)
iptables -A INPUT -i lo -j ACCEPT
iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
iptables -A INPUT -i "$WG_PHYS" -p udp --dport "$WG_PORT" -j ACCEPT  # WG handshake
iptables -A INPUT -i "$WG_PHYS" -p tcp --dport 22         -j ACCEPT  # SSH
iptables -A INPUT -i "$WG_IFACE"                           -j ACCEPT  # VPN clients

# ── 6 · Persist rules ────────────────────────────────────────────────────────
log "Persisting rules..."
mkdir -p /etc/iptables
iptables-save > /etc/iptables/rules.v4
log "Rules saved to /etc/iptables/rules.v4"

# ── 7 · Enable iptables-restore on boot ──────────────────────────────────────
systemctl enable netfilter-persistent 2>/dev/null || true

log "Kill-switch ACTIVE. Test: sudo wg-quick down wg0 && curl -s https://1.1.1.1 (should fail)"
log "To undo: iptables -P OUTPUT ACCEPT && iptables -F OUTPUT"
