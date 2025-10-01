const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET","POST"] } });

// pairing
const waitingQueue = [];
const partners = {};
const userInfo = {}; // socketId -> { name, gender }

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // emit both event names so clients listening for either will work
  io.emit('online-count', io.engine.clientsCount);
  io.emit('online-users', io.engine.clientsCount);

  socket.on('join', (data) => {
    // data: { name, gender }
    userInfo[socket.id] = data || { name: 'Anonymous', gender: 'other' };
    if (partners[socket.id]) return;
    if (waitingQueue.length === 0) {
      waitingQueue.push(socket.id);
      socket.emit('waiting');
    } else {
      const peerId = waitingQueue.shift();
      partners[peerId] = socket.id;
      partners[socket.id] = peerId;

      // send partner info to both peers (so client can display name/gender)
      io.to(peerId).emit('paired', { partnerId: socket.id, initiator: true, partnerInfo: userInfo[socket.id] });
      io.to(socket.id).emit('paired', { partnerId: peerId, initiator: false, partnerInfo: userInfo[peerId] });

      // update online counts for everyone (still valid)
      io.emit('online-count', io.engine.clientsCount);
      io.emit('online-users', io.engine.clientsCount);

      console.log('Paired', peerId, '<->', socket.id);
    }
  });

  // signaling
  socket.on('offer', ({ to, sdp }) => { if (to) io.to(to).emit('offer', { from: socket.id, sdp }); });
  socket.on('answer', ({ to, sdp }) => { if (to) io.to(to).emit('answer', { from: socket.id, sdp }); });
  socket.on('ice-candidate', ({ to, candidate }) => { if (to) io.to(to).emit('ice-candidate', { from: socket.id, candidate }); });

  // chat forwarding (include sender's name)
  socket.on('chat-message', ({ to, message }) => {
    if (!to) return;
    const info = userInfo[socket.id] || { name: 'Stranger', gender: 'other' };
    io.to(to).emit('chat-message', { from: socket.id, fromName: info.name, message });
  });

  socket.on('leave', () => {
    const partner = partners[socket.id];
    if (partner) {
      io.to(partner).emit('partner-left');
      delete partners[partner];
    } else {
      const idx = waitingQueue.indexOf(socket.id);
      if (idx !== -1) waitingQueue.splice(idx, 1);
    }
    delete partners[socket.id];
    delete userInfo[socket.id];

    io.emit('online-count', io.engine.clientsCount);
    io.emit('online-users', io.engine.clientsCount);
  });

  socket.on('disconnect', () => {
    const partner = partners[socket.id];
    if (partner) {
      io.to(partner).emit('partner-left');
      delete partners[partner];
    } else {
      const idx = waitingQueue.indexOf(socket.id);
      if (idx !== -1) waitingQueue.splice(idx, 1);
    }
    delete partners[socket.id];
    delete userInfo[socket.id];

    io.emit('online-count', io.engine.clientsCount);
    io.emit('online-users', io.engine.clientsCount);
    console.log('User disconnected:', socket.id);
  });
});

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../../client/build')));
  app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../../client/build', 'index.html')));
}

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
