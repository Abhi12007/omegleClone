const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET","POST"]
  }
});

// waiting queue and partner map
const waitingQueue = [];
const partners = {}; // socketId -> partnerSocketId

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join', () => {
    console.log('Join request from', socket.id);
    // if already in a pair or queue, ignore
    if (partners[socket.id]) return;
    if (waitingQueue.length === 0) {
      waitingQueue.push(socket.id);
      socket.emit('waiting');
    } else {
      const peerId = waitingQueue.shift();
      // pair peerId and socket.id
      partners[peerId] = socket.id;
      partners[socket.id] = peerId;
      // peerId was waiting earlier: mark peerId as initiator
      io.to(peerId).emit('paired', { partnerId: socket.id, initiator: true });
      io.to(socket.id).emit('paired', { partnerId: peerId, initiator: false });
      console.log('Paired', peerId, '↔', socket.id);
    }
  });

  socket.on('offer', ({ to, sdp }) => {
    if (to) io.to(to).emit('offer', { from: socket.id, sdp });
  });

  socket.on('answer', ({ to, sdp }) => {
    if (to) io.to(to).emit('answer', { from: socket.id, sdp });
  });

  socket.on('ice-candidate', ({ to, candidate }) => {
    if (to) io.to(to).emit('ice-candidate', { from: socket.id, candidate });
  });

  socket.on('leave', () => {
    const partner = partners[socket.id];
    if (partner) {
      // inform partner
      io.to(partner).emit('partner-left');
      delete partners[partner];
    } else {
      // remove from queue if waiting
      const idx = waitingQueue.indexOf(socket.id);
      if (idx !== -1) waitingQueue.splice(idx,1);
    }
    delete partners[socket.id];
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    const partner = partners[socket.id];
    if (partner) {
      io.to(partner).emit('partner-left');
      delete partners[partner];
    } else {
      const idx = waitingQueue.indexOf(socket.id);
      if (idx !== -1) waitingQueue.splice(idx,1);
    }
    delete partners[socket.id];
  });
});

// serve client build in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../../client/build')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../client/build', 'index.html'));
  });
}

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
