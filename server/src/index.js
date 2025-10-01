// server/src/index.js
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET","POST"] } });

const waitingQueue = []; // list of socket ids
const partners = {};     // socketId -> partnerSocketId
const userInfo = {};     // socketId -> { name, gender }

// helper to remove socket from waitingQueue
function removeFromQueue(socketId) {
  const idx = waitingQueue.indexOf(socketId);
  if (idx !== -1) waitingQueue.splice(idx, 1);
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // broadcast counts
  io.emit('online-count', io.engine.clientsCount);
  io.emit('online-users', io.engine.clientsCount);

  // join: data = { name, gender }
  socket.on('join', (data) => {
    // store user info
    userInfo[socket.id] = data || { name: 'Anonymous', gender: 'other' };

    // do not add if already paired
    if (partners[socket.id]) {
      return;
    }

    // remove if somehow exists (prevent duplicates)
    removeFromQueue(socket.id);

    // if no one waiting, add to queue and tell them to wait
    if (waitingQueue.length === 0) {
      waitingQueue.push(socket.id);
      socket.emit('waiting');
      io.emit('online-count', io.engine.clientsCount);
      io.emit('online-users', io.engine.clientsCount);
      return;
    }

    // find a random waiting peer that is not the same and still connected
    let peerIndex = -1;
    for (let i = 0; i < waitingQueue.length; i++) {
      const cand = waitingQueue[i];
      if (cand !== socket.id && io.sockets.sockets.get(cand)) {
        peerIndex = i;
        break;
      }
    }

    if (peerIndex === -1) {
      // fallback: no valid peer found, push to queue
      waitingQueue.push(socket.id);
      socket.emit('waiting');
      io.emit('online-count', io.engine.clientsCount);
      io.emit('online-users', io.engine.clientsCount);
      return;
    }

    // remove chosen peer from queue
    const peerId = waitingQueue.splice(peerIndex, 1)[0];

    // pair them
    partners[peerId] = socket.id;
    partners[socket.id] = peerId;

    // send partner info to both sides
    io.to(peerId).emit('paired', { partnerId: socket.id, initiator: true, partnerInfo: userInfo[socket.id] });
    io.to(socket.id).emit('paired', { partnerId: peerId, initiator: false, partnerInfo: userInfo[peerId] });

    io.emit('online-count', io.engine.clientsCount);
    io.emit('online-users', io.engine.clientsCount);

    console.log('Paired', peerId, '<->', socket.id);
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

  // leave
  socket.on('leave', () => {
    const partner = partners[socket.id];
    if (partner) {
      // notify partner and clean mapping
      io.to(partner).emit('partner-left');
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
