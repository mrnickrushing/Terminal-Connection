#!/bin/bash

# Get the directory where the script is located
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo "========================================"
echo "  Kali Mobile Terminal Remote Launcher  "
echo "========================================"

# 1. Get the local IP address
IP_ADDRESS=$(hostname -I | awk '{print $1}')
echo "[*] Local IP Address: $IP_ADDRESS"

# 2. Start the Kali Server in the background
echo "[*] Starting Kali WebSocket Server on port 8000..."
cd "$DIR/kali-server"
./start.sh &
SERVER_PID=$!

# 3. Start the Expo Mobile App server
echo "[*] Starting Expo Mobile App Server..."
cd "$DIR/mobile-app"
# Force Expo to use the correct IP address
REACT_NATIVE_PACKAGER_HOSTNAME=$IP_ADDRESS npx expo start --clear

# When Expo is closed (Ctrl+C), kill the background server
kill $SERVER_PID
echo "[*] Servers shut down."
