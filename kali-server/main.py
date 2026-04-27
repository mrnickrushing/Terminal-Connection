import asyncio
import os
import pty
import fcntl
import struct
import termios
import secrets
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException, status
from fastapi.security import APIKeyHeader
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

app = FastAPI()

# Use a fixed token for convenience, or read from environment
API_TOKEN = os.environ.get("TERMINAL_TOKEN", "kali-remote-secret-token-123")
print(f"Starting server with token: {API_TOKEN}")

api_key_header = APIKeyHeader(name="X-Terminal-Token", auto_error=False)

async def get_api_key(api_key_header: str = Depends(api_key_header)):
    if api_key_header == API_TOKEN:
        return api_key_header
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or missing API Token",
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "Kali Terminal Server is running", "auth_required": True}

@app.websocket("/ws/terminal")
async def terminal_endpoint(websocket: WebSocket):
    await websocket.accept()
    
    # Wait for authentication message first
    try:
        auth_msg = await asyncio.wait_for(websocket.receive_text(), timeout=5.0)
        if not auth_msg.startswith("auth:") or auth_msg.split(":", 1)[1] != API_TOKEN:
            await websocket.send_text("Authentication failed. Closing connection.")
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
        await websocket.send_text("Authentication successful. Terminal ready.\r\n")
    except asyncio.TimeoutError:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    except Exception as e:
        print(f"Auth error: {e}")
        await websocket.close(code=status.WS_1011_INTERNAL_ERROR)
        return
    
    # Create a pseudo-terminal
    pid, fd = pty.fork()
    
    if pid == 0:
        # Child process: execute bash
        os.environ["TERM"] = "xterm-256color"
        os.execvp("bash", ["bash"])
    else:
        # Parent process: bridge websocket and pty
        try:
            # Set pty to non-blocking
            flags = fcntl.fcntl(fd, fcntl.F_GETFL)
            fcntl.fcntl(fd, fcntl.F_SETFL, flags | os.O_NONBLOCK)
            
            async def read_from_pty():
                loop = asyncio.get_running_loop()
                while True:
                    try:
                        # Read from pty
                        data = await loop.run_in_executor(None, os.read, fd, 1024)
                        if not data:
                            break
                        await websocket.send_text(data.decode('utf-8', errors='replace'))
                    except BlockingIOError:
                        await asyncio.sleep(0.01)
                    except Exception as e:
                        print(f"Error reading from pty: {e}")
                        break

            async def read_from_ws():
                while True:
                    try:
                        data = await websocket.receive_text()
                        os.write(fd, data.encode('utf-8'))
                    except WebSocketDisconnect:
                        break
                    except Exception as e:
                        print(f"Error reading from ws: {e}")
                        break

            # Run both tasks concurrently
            await asyncio.gather(
                read_from_pty(),
                read_from_ws()
            )
            
        except Exception as e:
            print(f"WebSocket error: {e}")
        finally:
            # Cleanup
            try:
                os.close(fd)
                os.kill(pid, 9)
                os.waitpid(pid, 0)
            except Exception:
                pass

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
