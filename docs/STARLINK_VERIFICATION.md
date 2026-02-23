# Starlink Verification Guide

This document outlines the automated verification process used to conclusively prove a user device is routing through a Starlink-connected Private Gateway.

## 🎯 Objective

To provide deterministic proof that the Supernet VPS is acting only as a control plane, and the user's exit point is the Starlink terminal.

## 🛠 verification Flow

1. **Gateway Report**: The Admin Dashboard triggers the `supernet-gateway-verify.sh` agent on the Private Gateway via SSH.
2. **IP Comparison**: The Gateway reports its current public IP (Starlink IP). The Admin inputs the Device's reported exit IP.
3. **Traffic Validation**: The system verifies that the Device is seen as a peer on the Gateway's WireGuard interface and has transmitted/received data (RX/TX > 0).
4. **Kill-Switch Validation (AUTOMATIC)**: The system automatically probes the gateway's firewall to confirm that the `OUTPUT` policy is set to `DROP` and that the Supernet kill-switch rules are active.
5. **Verdict**:
    * **VERIFIED**: IPs match, data flow is active, and kill-switch is hardened.
    * **FAILED**: IP mismatch, no data flow, or kill-switch is missing.

## 📁 Components

### 1. Gateway Agent

**Path**: `/usr/local/bin/supernet-gateway-verify.sh`
**Command**: `sudo supernet-gateway-verify.sh`
**Output**: JSON containing Gateway IP and Peer stats.

### 2. Client Test Script

**Path**: `scripts/supernet-starlink-test.sh`
**Usage**: Users run this on their local machine to check their IP before and after connecting to the VPN.

### 3. Verification API

**Endpoint**: `POST /api/admin/private-gateway/verify`
**Roles**: Admin Only.

## 🔴 Failure Modes & Remediation

| Issue | Cause | Fix |
| :--- | :--- | :--- |
| **IP Mismatch** | Traffic bypassing VPN or exit node misconfig | Check "Private Gateway" mode is active in User Dashboard. |
| **No Peer Data** | Device not connected to Gateway wg0 | Verify WireGuard handshake on Gateway (`wg show`). |
| **RX/TX is 0** | Encryption error or firewall blocking | Check iptables on Gateway for `FORWARD` drop rules. |
| **SSH Timeout** | Gateway machine unreachable | Ensure Gateway machine is online and SSH port is open to VPS. |

## 🔐 Security

* **No Public Endpoints**: Verification logic is strictly behind Admin authentication.
* **Audit Logging**: Every verification attempt is persisted in the `verification_results` table for 90+ days.
