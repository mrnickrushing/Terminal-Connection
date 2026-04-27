const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const wss = new WebSocket.Server({ 
  server,
  perMessageDeflate: false
});

let kaliTerminal = null;
let mobileClients = new Set();

const API_TOKEN = process.env.TERMINAL_TOKEN || 'kali-remote-secret-token-123';
const PORT = process.env.PORT || 3000;

console.log('=== Relay Server Starting ===');
console.log('Token:', API_TOKEN);
console.log('Port:', PORT);
console.log('Process PID:', process.pid);

app.get('/', (req, res) => {
  res.json({
    status: 'Relay Server is running',
    kaliConnected: kaliTerminal !== null,
    mobileClientsConnected: mobileClients.size,
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

wss.on('connection', (ws, req) => {
  console.log('[WS] New connection from:', req.socket.remoteAddress);
  
  let isKali = false;
  let isAuthenticated = false;

  ws.on('message', (message) => {
    const msgStr = message.toString();
    console.log('[WS] Received message from', isKali ? 'Kali' : 'Mobile', ':', msgStr.substring(0, 50));
    
    if (!isAuthenticated) {
      if (msgStr.startsWith('auth:')) {
        const token = msgStr.split(':', 2)[1];
        if (token === API_TOKEN) {
          isAuthenticated = true;
          ws.send('Authentication successful.\r\n');
          console.log('[AUTH] Mobile client authenticated successfully.');
          return;
        } else {
          ws.send('Authentication failed.\r\n');
          ws.close();
          return;
        }
      }
      
      if (msgStr.startsWith('kali-auth:')) {
        const token = msgStr.split(':', 2)[1];
        if (token === API_TOKEN) {
          isAuthenticated = true;
          isKali = true;
          
          if (kaliTerminal) {
            console.log('[KALI] Closing previous Kali connection.');
            kaliTerminal.close();
          }
          
          kaliTerminal = ws;
          console.log('[KALI] Kali Terminal connected and authenticated.');
          
          mobileClients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
              client.send('\r\n[Relay] Kali Terminal connected.\r\n');
            }
          });
          return;
        } else {
          console.log('[AUTH] Kali auth failed - bad token');
          ws.close();
          return;
        }
      }
      
      return;
    }

    if (isKali) {
      mobileClients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });
    } else {
      if (!mobileClients.has(ws)) {
        mobileClients.add(ws);
        console.log(`[MOBILE] Client joined. Total: ${mobileClients.size}`);
      }
      
      if (kaliTerminal && kaliTerminal.readyState === WebSocket.OPEN) {
        kaliTerminal.send(message);
      } else {
        ws.send('\r\n[Relay] Kali Terminal is not connected to the relay server.\r\n');
      }
    }
  });

  ws.on('close', () => {
    if (isKali) {
      console.log('[KALI] Kali Terminal disconnected.');
      kaliTerminal = null;
      mobileClients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send('\r\n[Relay] Kali Terminal disconnected.\r\n');
        }
      });
    } else {
      mobileClients.delete(ws);
      console.log(`[MOBILE] Mobile client disconnected. Total: ${mobileClients.size}`);
    }
  });
  
  ws.on('error', (error) => {
    console.error('[WS] WebSocket error:', error);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[SERVER] Relay server listening on port ${PORT}`);
  console.log(`[SERVER] Ready to accept connections`);
  console.log(`[SERVER] WebSocket endpoint: ws://0.0.0.0:${PORT}`);
});

server.on('error', (error) => {
  console.error('[SERVER] Server error:', error);
});

process.on('uncaughtException', (error) => {
  console.error('[FATAL] Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[FATAL] Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});
