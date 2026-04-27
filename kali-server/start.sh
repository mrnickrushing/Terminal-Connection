#!/bin/bash
cd "$(dirname "$0")"

# Check if .venv exists, if not create it and install dependencies
if [ ! -d ".venv" ]; then
    echo "Creating virtual environment and installing dependencies..."
    python3 -m venv .venv
    source .venv/bin/activate
    pip install fastapi uvicorn websockets ptyprocess
else
    source .venv/bin/activate
fi

uvicorn main:app --host 0.0.0.0 --port ${APP_PORT:-8000}
