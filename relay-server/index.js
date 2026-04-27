const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Store connections
let kaliTerminal = null;
let mobileClients = new Set();

const API_TOKEN = process.env.TERMINAL_TOKEN || 'kali-remote-secret-token-123';

app.get('/', (req, res) => {
  res.send({
    status: 'Relay Server is running',
    kaliConnected: kaliTerminal !== null,
    mobileClientsConnected: mobileClients.size
  });
});

wss.on('connection', (ws, req) => {
  console.log('New connection attempt from:', req.socket.remoteAddress);
  
  let isKali = false;
  let isAuthenticated = false;

  ws.on('message', (message) => {
    const msgStr = message.toString();
    
    // Handle Authentication
    if (!isAuthenticated) {
      if (msgStr.startsWith('auth:')) {
        const token = msgStr.split(':', 2)[1];
        if (token === API_TOKEN) {
          isAuthenticated = true;
          ws.send('Authentication successful.\r\n');
          console.log('Client authenticated successfully.');
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
          
          // If there's an old Kali connection, close it
          if (kaliTerminal) {
            kaliTerminal.close();
          }
          
          kaliTerminal = ws;
          console.log('Kali Terminal connected and authenticated.');
          
          // Notify mobile clients
          mobileClients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
              client.send('\r\n[Relay] Kali Terminal connected.\r\n');
            }
          });
          return;
        } else {
          ws.close();
          return;
        }
      }
      
      // If not authenticated and not sending auth message, ignore
      return;
    }

    // Handle routing after authentication
    if (isKali) {
      // Message from Kali -> Send to all mobile clients
      mobileClients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });
    } else {
      // Message from Mobile -> Send to Kali
      if (!mobileClients.has(ws)) {
        mobileClients.add(ws);
        console.log(`Mobile client joined. Total: ${mobileClients.size}`);
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
      console.log('Kali Terminal disconnected.');
      kaliTerminal = null;
      mobileClients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send('\r\n[Relay] Kali Terminal disconnected.\r\n');
        }
      });
    } else {
      mobileClients.delete(ws);
      console.log(`Mobile client disconnected. Total: ${mobileClients.size}`);
    }
  });
  
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Relay server listening on port ${PORT}`);
});
