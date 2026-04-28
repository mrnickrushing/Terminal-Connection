import asyncio
import os
import pty
import fcntl
import socketio
import sys

API_TOKEN = os.environ.get("TERMINAL_TOKEN", "kali-remote-secret-token-123")
# Change wss:// to https:// for socket.io
RELAY_URL = os.environ.get("RELAY_URL", "https://terminal-connection-production.up.railway.app").replace("wss://", "https://").replace("ws://", "http://")

sio = socketio.AsyncClient(logger=False, engineio_logger=False)
fd = None
pid = None

@sio.event
async def connect():
    print("Connected to Relay Server. Authenticating...")
    await sio.emit('kali-auth', API_TOKEN)

@sio.event
async def data(msg):
    global fd
    if fd:
        try:
            os.write(fd, msg.encode('utf-8') if isinstance(msg, str) else msg)
        except Exception as e:
            print(f"Error writing to pty: {e}")

@sio.event
async def disconnect():
    print("Disconnected from relay server.")

async def read_from_pty():
    global fd
    loop = asyncio.get_running_loop()
    while True:
        if fd and sio.connected:
            try:
                data = await loop.run_in_executor(None, os.read, fd, 1024)
                if data:
                    await sio.emit('data', data.decode('utf-8', errors='replace'))
            except BlockingIOError:
                await asyncio.sleep(0.01)
            except Exception as e:
                await asyncio.sleep(0.1)
        else:
            await asyncio.sleep(0.1)

async def main():
    global fd, pid
    print(f"Connecting to Relay Server at {RELAY_URL}...")
    
    pid, fd = pty.fork()
    
    if pid == 0:
        os.environ["TERM"] = "xterm-256color"
        os.execvp("bash", ["bash"])
    else:
        flags = fcntl.fcntl(fd, fcntl.F_GETFL)
        fcntl.fcntl(fd, fcntl.F_SETFL, flags | os.O_NONBLOCK)
        
        asyncio.create_task(read_from_pty())
        
        while True:
            try:
                if not sio.connected:
                    await sio.connect(RELAY_URL, transports=['websocket', 'polling'])
                    await sio.wait()
            except Exception as e:
                print(f"Connection failed: {e}. Retrying in 5s...")
                await asyncio.sleep(5)

if __name__ == "__main__":
    print("Starting Kali Terminal Client (Socket.io Mode)")
    asyncio.run(main())
