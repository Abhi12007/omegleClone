const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server,{cors:{origin:"*",methods:["GET","POST"]}});

const waitingQueue=[];
const partners={};
const userInfo={};

io.on('connection',(socket)=>{
  io.emit('online-count',io.engine.clientsCount);

  socket.on('join',(data)=>{
    userInfo[socket.id]=data;
    if(partners[socket.id]) return;
    if(waitingQueue.length===0){waitingQueue.push(socket.id); socket.emit('waiting');}
    else{
      const peerId = waitingQueue.shift();
      partners[peerId]=socket.id;
      partners[socket.id]=peerId;
      io.to(peerId).emit('paired',{partnerId:socket.id,initiator:true,partnerInfo:data});
      io.to(socket.id).emit('paired',{partnerId:peerId,initiator:false,partnerInfo:userInfo[peerId]});
    }
  });

  socket.on('offer',({to,sdp})=>{if(to) io.to(to).emit('offer',{from:socket.id,sdp});});
  socket.on('answer',({to,sdp})=>{if(to) io.to(to).emit('answer',{from:socket.id,sdp});});
  socket.on('ice-candidate',({to,candidate})=>{if(to) io.to(to).emit('ice-candidate',{from:socket.id,candidate});});

  socket.on('chat-message',({to,message})=>{if(to) io.to(to).emit('chat-message',{from:socket.id,message});});

  socket.on('leave',()=>{
    const partner=partners[socket.id];
    if(partner){io.to(partner).emit('partner-left'); delete partners[partner];}
    else{const idx=waitingQueue.indexOf(socket.id); if(idx!==-1) waitingQueue.splice(idx,1);}
    delete partners[socket.id];
    delete userInfo[socket.id];
    io.emit('online-count',io.engine.clientsCount);
  });

  socket.on('disconnect',()=>{
    const partner=partners[socket.id];
    if(partner){io.to(partner).emit('partner-left'); delete partners[partner];}
    else{const idx=waitingQueue.indexOf(socket.id); if(idx!==-1) waitingQueue.splice(idx,1);}
    delete partners[socket.id];
    delete userInfo[socket.id];
    io.emit('online-count',io.engine.clientsCount);
  });
});

if(process.env.NODE_ENV==='production'){
  app.use(express.static(path.join(__dirname,'../../client/build')));
  app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'../../client/build','index.html')));
}

const PORT=process.env.PORT||5000;
server.listen(PORT,()=>console.log(`🚀 Server running on port ${PORT}`));
