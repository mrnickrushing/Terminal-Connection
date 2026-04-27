import asyncio
import os
import pty
import fcntl
import struct
import termios
import websockets
import sys

# Use a fixed token for convenience, or read from environment
API_TOKEN = os.environ.get("TERMINAL_TOKEN", "kali-remote-secret-token-123")
RELAY_URL = os.environ.get("RELAY_URL", "ws://localhost:3000")

async def connect_to_relay():
    print(f"Connecting to Relay Server at {RELAY_URL}...")
    
    while True:
        try:
            async with websockets.connect(RELAY_URL) as websocket:
                print("Connected to Relay Server. Authenticating...")
                await websocket.send(f"kali-auth:{API_TOKEN}")
                
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
                                    await websocket.send(data.decode('utf-8', errors='replace'))
                                except BlockingIOError:
                                    await asyncio.sleep(0.01)
                                except Exception as e:
                                    print(f"Error reading from pty: {e}")
                                    break

                        async def read_from_ws():
                            while True:
                                try:
                                    data = await websocket.recv()
                                    os.write(fd, data.encode('utf-8'))
                                except websockets.exceptions.ConnectionClosed:
                                    print("Connection to relay closed.")
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
                            
        except Exception as e:
            print(f"Failed to connect to relay: {e}. Retrying in 5 seconds...")
            await asyncio.sleep(5)

if __name__ == "__main__":
    print("Starting Kali Terminal Client (Relay Mode)")
    asyncio.run(connect_to_relay())
