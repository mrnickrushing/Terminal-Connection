#!/bin/bash

# Get the directory where the script is located
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo "========================================"
echo "  Kali Mobile Terminal Remote Launcher  "
echo "========================================"

# 1. Start the Kali Server in the background
echo "[*] Starting Kali WebSocket Client (connecting to Relay)..."
cd "$DIR/kali-server"
./start.sh &
SERVER_PID=$!

# 2. Start the Expo Mobile App server
echo "[*] Starting Expo Mobile App Server..."
cd "$DIR/mobile-app"
npx expo start --clear

# When Expo is closed (Ctrl+C), kill the background server
kill $SERVER_PID
echo "[*] Servers shut down."
