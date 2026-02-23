#!/bin/bash
# setup-gateway.sh — Hardened WireGuard Private Gateway Setup (Starlink Mode)
#
# OBJECTIVE:
# - Act as a secure VPN gateway for family/office use.
# - Exit traffic via the local WAN (Starlink/Office).
# - Block access to the Private LAN (RFC1918).
# - Enforce a kill-switch (if VPN is down, no traffic leaves the box).

set -e

# --- Configuration ---
IF_WAN="eth0"
IF_WG="wg0"
WG_PORT=51820
ADMIN_SSH_IP="any" # Change to specific admin IP for higher security

echo "Starting Hardened Private Gateway Setup..."

# 1. Enable IP Forwarding
echo "net.ipv4.ip_forward=1" > /etc/sysctl.d/99-vpn-gateway.conf
sysctl -p /etc/sysctl.d/99-vpn-gateway.conf

# 2. Reset Tables
iptables -F
iptables -t nat -F
iptables -X

# 3. Default Policies (KILL-SWITCH)
iptables -P INPUT DROP
iptables -P FORWARD DROP
iptables -P OUTPUT DROP

# 4. Allow Loopback
iptables -A INPUT -i lo -j ACCEPT
iptables -A OUTPUT -o lo -j ACCEPT

# 5. Allow Essential Services (DNS/NTP)
iptables -A OUTPUT -p udp --dport 53 -j ACCEPT
iptables -A OUTPUT -p udp --dport 123 -j ACCEPT
iptables -A INPUT -p udp --sport 53 -j ACCEPT

# 6. Allow Incoming WireGuard (Port 51820)
iptables -A INPUT -p udp --dport $WG_PORT -j ACCEPT
iptables -A OUTPUT -p udp --sport $WG_PORT -j ACCEPT

# 7. Allow SSH (Admin)
if [ "$ADMIN_SSH_IP" == "any" ]; then
    iptables -A INPUT -p tcp --dport 22 -j ACCEPT
    iptables -A OUTPUT -p tcp --sport 22 -m state --state ESTABLISHED -j ACCEPT
else
    iptables -A INPUT -p tcp -s "$ADMIN_SSH_IP" --dport 22 -j ACCEPT
    iptables -A OUTPUT -p tcp -d "$ADMIN_SSH_IP" --sport 22 -m state --state ESTABLISHED -j ACCEPT
fi

# 8. MAPPING & NAT (SaaS VPN Access to Internet)
iptables -t nat -A POSTROUTING -o $IF_WAN -j MASQUERADE

# 9. FORWARDING RULES (The Core Security Logic)
# - Allow traffic from wg0 to WAN
iptables -A FORWARD -i $IF_WG -o $IF_WAN -j ACCEPT
iptables -A FORWARD -i $IF_WAN -o $IF_WG -m state --state ESTABLISHED,RELATED -j ACCEPT

# - BLOCK Forwarding TO Private LANs (RFC1918)
iptables -I FORWARD -i $IF_WG -d 192.168.0.0/16 -j REJECT
iptables -I FORWARD -i $IF_WG -d 10.0.0.0/8 -j REJECT
iptables -I FORWARD -i $IF_WG -d 172.16.0.0/12 -j REJECT

# 10. Persist Rules (Ubuntu/Debian)
if command -v iptables-save > /dev/null; then
    mkdir -p /etc/iptables
    iptables-save > /etc/iptables/rules.v4
    echo "Iptables rules saved to /etc/iptables/rules.v4"
fi

echo "Hardened Private Gateway Setup Complete!"
echo "Interface: $IF_WAN -> $IF_WG"
echo "Security: Kill-switch ACTIVE, LAN access BLOCKED."
