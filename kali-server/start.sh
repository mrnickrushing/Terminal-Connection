#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -d ".venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv .venv
fi

source .venv/bin/activate
python -m pip install --upgrade "python-socketio[asyncio_client]" aiohttp

python main.py
