#!/bin/bash
cd "$(dirname "$0")"

# Check if .venv exists, if not create it and install dependencies
if [ ! -d ".venv" ]; then
    echo "Creating virtual environment and installing dependencies..."
    python3 -m venv .venv
    source .venv/bin/activate
    pip install "python-socketio[asyncio_client]" aiohttp
else
    source .venv/bin/activate
fi

python main.py
