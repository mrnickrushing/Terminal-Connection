const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
  transports: ['websocket', 'polling']
});

let kaliSocket = null;
let mobileClients = new Set();

const API_TOKEN = process.env.TERMINAL_TOKEN || 'kali-remote-secret-token-123';
const PORT = process.env.PORT || 3000;

console.log('=== Relay Server Starting (Socket.io) ===');
console.log('Token:', API_TOKEN ? '[set]' : '[NOT SET - using default]');
console.log('Port:', PORT);

app.get('/', (req, res) => {
  res.json({ status: 'running', kaliConnected: kaliSocket !== null, mobileClients: mobileClients.size });
});

io.on('connection', (socket) => {
  console.log('[IO] New connection:', socket.id);
  
  let isKali = false;
  let isAuthenticated = false;

  socket.on('auth', (token) => {
    if (token === API_TOKEN) {
      isAuthenticated = true;
      mobileClients.add(socket);
      socket.emit('data', 'Authentication successful.\r\n');
      console.log('[AUTH] Mobile client authenticated.');
    } else {
      socket.emit('data', 'Authentication failed.\r\n');
      socket.disconnect();
    }
  });

  socket.on('kali-auth', (token) => {
    if (token === API_TOKEN) {
      isAuthenticated = true;
      isKali = true;
      
      if (kaliSocket) {
        kaliSocket.disconnect();
      }
      
      kaliSocket = socket;
      console.log('[KALI] Kali Terminal connected.');
      
      mobileClients.forEach(client => {
        client.emit('data', '\r\n[Relay] Kali Terminal connected.\r\n');
      });
    } else {
      socket.disconnect();
    }
  });

  socket.on('data', (data) => {
    if (!isAuthenticated) return;

    if (isKali) {
      mobileClients.forEach(client => client.emit('data', data));
    } else {
      if (kaliSocket) {
        kaliSocket.emit('data', data);
      } else {
        socket.emit('data', '\r\n[Relay] Kali Terminal is not connected.\r\n');
      }
    }
  });

  socket.on('disconnect', () => {
    if (isKali) {
      console.log('[KALI] Disconnected.');
      kaliSocket = null;
      mobileClients.forEach(client => client.emit('data', '\r\n[Relay] Kali Terminal disconnected.\r\n'));
    } else {
      mobileClients.delete(socket);
      console.log(`[MOBILE] Disconnected. Total: ${mobileClients.size}`);
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[SERVER] Listening on port ${PORT}`);
});
