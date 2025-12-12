#!/bin/bash
# manage-vpn.sh

WG_INTERFACE="wg0"

command=$1

if [ "$command" == "add-peer" ]; then
  PUBLIC_KEY=$2
  ALLOWED_IPS=$3
  
  if [ -z "$PUBLIC_KEY" ] || [ -z "$ALLOWED_IPS" ]; then
    echo "Usage: $0 add-peer <public_key> <allowed_ips>"
    exit 1
  fi

  echo "Adding peer $PUBLIC_KEY with IP $ALLOWED_IPS to $WG_INTERFACE"
  
  # Check if we are actually running on a system with wg
  if command -v wg &> /dev/null; then
      # Check if peer exists first
      if sudo wg show $WG_INTERFACE peers | grep -q "$PUBLIC_KEY"; then
         echo "Peer already exists. Updating allowed-ips..."
         sudo wg set $WG_INTERFACE peer $PUBLIC_KEY allowed-ips $ALLOWED_IPS
      else 
         sudo wg set $WG_INTERFACE peer $PUBLIC_KEY allowed-ips $ALLOWED_IPS
         echo "Peer added to live interface."
      fi
  else
      echo "WireGuard command 'wg' not found. Skipping live interface update (Dev/Windows Mode)."
  fi

elif [ "$command" == "restart" ]; then
   echo "Restarting interface..."
   if command -v wg-quick &> /dev/null; then
       sudo wg-quick down $WG_INTERFACE
       sudo wg-quick up $WG_INTERFACE
   else
       echo "wg-quick not found. Skipping."
   fi

elif [ "$command" == "get-stats" ]; then
    # Returns format: PUBLIC_KEY RX_BYTES TX_BYTES
    if command -v wg &> /dev/null; then
        sudo wg show $WG_INTERFACE transfer
    else
        # Mock data for dev
        echo "MOCK_KEY_1 1024 2048"
        echo "MOCK_KEY_2 5000 10000"
    fi


else
  echo "Unknown command: $command"
  exit 1
fi
