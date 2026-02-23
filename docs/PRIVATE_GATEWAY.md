# Supernet Private Gateway Mode (Starlink Mode)

## Overview

Supernet now supports two distinct exit modes for VPN traffic:

1. **SaaS VPN Mode (Default)**: Traffic exits via our high-speed global VPS nodes. Ideal for privacy and bypassing censorship.
2. **Private Gateway Mode**: Traffic exits via a machine in your own local network (e.g., behind a Starlink terminal or in your office). Ideal for accessing region-locked content from home or securely accessing home/office resources.

## How it Works

When **Private Gateway Mode** is selected, your device still connects to the Supernet VPS for the initial handshake, but the VPS routes your traffic through a dedicated "Private Gateway" machine located in your chosen network.

### Security Features

- **Kill-Switch**: If the connection between the VPS and your Private Gateway is interrupted, all internet traffic is blocked to prevent data leaks.
- **LAN Isolation**: Traffic exiting the gateway is automatically blocked from accessing other devices on your local private network (RFC1918).
- **Admin Oversight**:
  - Users must be explicitly authorized to use Private Gateway mode.
  - Each individual device must be approved before it can switch to Private Gateway mode.

## Setup Instructions

### 1. Provision the Gateway Machine

On a Linux machine (e.g., Raspberry Pi, Ubuntu Server) located in your target network:

```bash
# Run the hardening script
curl -sSL https://raw.githubusercontent.com/supernet/supernet/main/scripts/setup-gateway.sh | sudo bash
```

### 2. Configure Supernet

Admins can enable the feature by setting the following environment variables on the main Supernet server:

- `SUPERNET_PRIVATE_GATEWAY_ENABLED=true`
- `PRIVATE_GATEWAY_ENDPOINT=<GATEWAY_IP>:<PORT>`
- `PRIVATE_GATEWAY_PUBLIC_KEY=<GATEWAY_PUBKEY>`

### 3. Authorize Users & Devices

In the Admin Dashboard (`/admin/dashboard`):

1. **Users Tab**: Click **Authorize** next to a user to allow them to use Private Gateways.
2. **Connections Tab**: Click **Approve** next to a specific device configuration.

### 4. Switch Mode

Users can toggle between modes in their personal dashboard. Switching modes will immediately regenerate the WireGuard configuration.
