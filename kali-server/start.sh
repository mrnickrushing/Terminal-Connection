#!/bin/bash
cd "$(dirname "$0")"

# Check if .venv exists, if not create it and install dependencies
if [ ! -d ".venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv .venv
fi

source .venv/bin/activate
pip install "python-socketio[asyncio_client]" aiohttp

python main.py
