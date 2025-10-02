// Track blocked users by IP: { ip: unblockTimestamp }
const blockedUsers = new Map();
// server/src/index.js
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET","POST"] } });

const waitingQueue = [];
const partners = {};
const userInfo = {};

function removeFromQueue(socketId) {
  const idx = waitingQueue.indexOf(socketId);
  if (idx !== -1) waitingQueue.splice(idx, 1);
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  io.emit('online-count', io.engine.clientsCount);
  io.emit('online-users', io.engine.clientsCount);

    // Join event with blocked IP check
  socket.on('join', (data) => {
    const ip = socket.handshake.headers['x-forwarded-for']?.split(',')[0] || socket.handshake.address;
    const unblockAt = blockedUsers.get(ip);

    if (unblockAt && unblockAt > Date.now()) {
      const remaining = Math.ceil((unblockAt - Date.now()) / 1000);
      console.log(`Blocked IP ${ip} tried to join. ${remaining}s left.`);

      // tell user they are still blocked with actual remaining time
      socket.emit("reported", { remaining });
      return;
    }

    // normal join flow
    userInfo[socket.id] = data || { name: 'Anonymous', gender: 'other' };
    if (partners[socket.id]) return;

    removeFromQueue(socket.id);

    if (waitingQueue.length === 0) {
      waitingQueue.push(socket.id);
      socket.emit('waiting');
      return;
    }

    let peerIndex = -1;
    for (let i = 0; i < waitingQueue.length; i++) {
      const cand = waitingQueue[i];
      if (cand !== socket.id && io.sockets.sockets.get(cand)) {
        peerIndex = i;
        break;
      }
    }

    if (peerIndex === -1) {
      waitingQueue.push(socket.id);
      socket.emit('waiting');
      return;
    }

    const peerId = waitingQueue.splice(peerIndex, 1)[0];

    partners[peerId] = socket.id;
    partners[socket.id] = peerId;

    io.to(peerId).emit('paired', {
      partnerId: socket.id,
      initiator: true,
      partnerInfo: userInfo[socket.id]
    });
    io.to(socket.id).emit('paired', {
      partnerId: peerId,
      initiator: false,
      partnerInfo: userInfo[peerId]
    });
  });


  // signaling
  socket.on('offer', ({ to, sdp }) => { if (to) io.to(to).emit('offer', { from: socket.id, sdp }); });
  socket.on('answer', ({ to, sdp }) => { if (to) io.to(to).emit('answer', { from: socket.id, sdp }); });
  socket.on('ice-candidate', ({ to, candidate }) => { if (to) io.to(to).emit('ice-candidate', { from: socket.id, candidate }); });

  // chat
  socket.on('chat-message', ({ to, message }) => {
    if (!to) return;
    const info = userInfo[socket.id] || { name: 'Stranger', gender: 'other' };
    io.to(to).emit('chat-message', { from: socket.id, fromName: info.name, message });
  });

  // typing indicator
  socket.on('typing', ({ to, fromName }) => {
    if (to) {
      io.to(to).emit('typing', { from: socket.id, fromName });
    }
  });

     // --- Report Event ---
  socket.on("report", ({ partnerId, reason }) => {
    console.log(`User ${socket.id} reported ${partnerId} for: ${reason}`);

    const partnerSocket = io.sockets.sockets.get(partnerId);
    if (!partnerSocket) return;

    // --- Block partner’s IP ---
    const partnerIp = partnerSocket.handshake.headers['x-forwarded-for']?.split(',')[0] || partnerSocket.handshake.address;
    const now = Date.now();
    const cooldown = 60 * 1000; // 60 seconds
    blockedUsers.set(partnerIp, now + cooldown);

    // tell partner they are reported, send remaining time (always 60s at report time)
    io.to(partnerId).emit("reported", { remaining: 60 });

    // end session for partner
    io.to(partnerId).emit("partner-left");
    removeFromQueue(partnerId);
    delete partners[partnerId];

    // ✅ reporter is re-queued back into matchmaking immediately
    io.to(socket.id).emit("partner-left");
    removeFromQueue(socket.id);
    waitingQueue.push(socket.id);
    delete partners[socket.id];
  }); 
    // add handler
   socket.on("skip-block", () => {
  const ip = socket.handshake.headers['x-forwarded-for']?.split(',')[0] || socket.handshake.address;
  if (blockedUsers.has(ip)) {
    blockedUsers.delete(ip); // ✅ allow immediate rejoin
    console.log(`Block skipped for IP: ${ip}`);
    }
    });


  // leave
  socket.on('leave', () => {
    const partner = partners[socket.id];
    if (partner) {
      io.to(partner).emit('partner-left');
      removeFromQueue(partner);
      waitingQueue.push(partner); // partner requeued
      delete partners[partner];
      delete partners[socket.id];
    } else {
      removeFromQueue(socket.id);
    }
    delete userInfo[socket.id];
    io.emit('online-count', io.engine.clientsCount);
    io.emit('online-users', io.engine.clientsCount);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    const partner = partners[socket.id];
    if (partner) {
      io.to(partner).emit('partner-left');
      removeFromQueue(partner);
      waitingQueue.push(partner);
      delete partners[partner];
      delete partners[socket.id];
    } else {
      removeFromQueue(socket.id);
    }
    delete userInfo[socket.id];
    io.emit('online-count', io.engine.clientsCount);
    io.emit('online-users', io.engine.clientsCount);
  });
});

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../../client/build')));
  app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../../client/build', 'index.html')));
}

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
