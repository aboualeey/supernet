#!/bin/bash
# setup-oracle.sh
# Usage: ./setup-oracle.sh <ssh_user> <ssh_host> <path_to_private_key>

SSH_USER=$1
SSH_HOST=$2
SSH_KEY=$3

if [ -z "$SSH_USER" ] || [ -z "$SSH_HOST" ] || [ -z "$SSH_KEY" ]; then
  echo "Usage: $0 <ssh_user> <ssh_host> <path_to_private_key>"
  exit 1
fi

echo "Connecting to $SSH_USER@$SSH_HOST..."

ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$SSH_USER@$SSH_HOST" << 'EOF'
  set -e
  
  echo "Updating system..."
  sudo apt-get update && sudo apt-get upgrade -y
  
  echo "Installing WireGuard..."
  sudo apt-get install -y wireguard
  
  # Generate keys if not exists
  if [ ! -f /etc/wireguard/private.key ]; then
    echo "Generating keys..."
    umask 077
    wg genkey | sudo tee /etc/wireguard/private.key
    sudo cat /etc/wireguard/private.key | wg pubkey | sudo tee /etc/wireguard/public.key
  fi
  
  PRIVATE_KEY=$(sudo cat /etc/wireguard/private.key)
  
  # Create interface config
  echo "Configuring wg0..."
  sudo tee /etc/wireguard/wg0.conf > /dev/null <<EOL
[Interface]
Address = 10.8.0.1/24
SaveConfig = true
PostUp = ufw route allow in on wg0 out on enp0s3
PostUp = iptables -A FORWARD -i wg0 -j ACCEPT; iptables -t nat -A POSTROUTING -o enp0s3 -j MASQUERADE
PostDown = ufw route delete allow in on wg0 out on enp0s3
PostDown = iptables -D FORWARD -i wg0 -j ACCEPT; iptables -t nat -D POSTROUTING -o enp0s3 -j MASQUERADE
ListenPort = 51820
PrivateKey = $PRIVATE_KEY
EOL

  # Enable IP forwarding
  echo "Enabling IP forwarding..."
  echo "net.ipv4.ip_forward=1" | sudo tee -a /etc/sysctl.conf
  sudo sysctl -p
  
  # Start WireGuard
  echo "Starting WireGuard..."
  sudo systemctl enable wg-quick@wg0
  sudo systemctl start wg-quick@wg0
  
  # Open firewall port (Oracle Cloud security list must also be open!)
  if command -v ufw >/dev/null; then
      sudo ufw allow 51820/udp
      sudo ufw allow OpenSSH
      sudo ufw --force enable
  fi

  echo "Server setup complete!"
  echo "Public Key (Save this for your records):"
  sudo cat /etc/wireguard/public.key
EOF
