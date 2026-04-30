#!/bin/bash

# Get the directory where the script is located
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo "========================================"
echo "  Kali Mobile Terminal Remote Launcher  "
echo "========================================"

# 1. Set the Relay URL environment variable
export RELAY_URL="wss://terminal-connection-production.up.railway.app"
echo "[*] Relay Server URL: $RELAY_URL"

# 2. Start the Kali Server in the background (with the environment variable)
echo "[*] Starting Kali WebSocket Client (connecting to Relay)..."
cd "$DIR/kali-server"
RELAY_URL="$RELAY_URL" ./start.sh &
SERVER_PID=$!

# Wait a bit for the Kali server to start
sleep 2

# 3. Start the Expo Mobile App server
echo "[*] Starting Expo Mobile App Server..."
cd "$DIR/mobile-app"

# Clear all Metro caches to avoid workspace issues
rm -rf .metro-cache node_modules/.cache
export WATCHMAN_DISABLE_CACHE=1

# Run expo with explicit config to avoid workspace scanning
npx expo start --clear --no-dev

# When Expo is closed (Ctrl+C), kill the background server
kill $SERVER_PID 2>/dev/null
echo "[*] Servers shut down."
