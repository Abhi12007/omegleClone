import React,{useEffect,useRef,useState} from 'react';
import io from 'socket.io-client';
const socket=io();

export default function App(){
const [page,setPage]=useState("landing");
const [name,setName]=useState("");
const [gender,setGender]=useState("");
const [status,setStatus]=useState("init");
const [partnerId,setPartnerId]=useState(null);
const [partnerInfo,setPartnerInfo]=useState({name:'',gender:''});
const [initiator,setInitiator]=useState(false);
const [onlineCount,setOnlineCount]=useState(0);
const [micOn,setMicOn]=useState(true);
const [camOn,setCamOn]=useState(true);
const [messages,setMessages]=useState([]);
const [input,setInput]=useState("");

const localVideoRef=useRef(null);
const remoteVideoRef=useRef(null);
const pcRef=useRef(null);
const localStreamRef=useRef(null);

useEffect(()=>{
  socket.on('online-count',c=>setOnlineCount(c));
  socket.on('waiting',()=>setStatus("waiting"));
  socket.on('paired',({partnerId,initiator,partnerInfo})=>{
    setPartnerId(partnerId); setInitiator(initiator); setPartnerInfo(partnerInfo); setStatus("paired");
    startLocalStream().then(()=>{setupPeerConnection(); if(initiator) createOffer();});
  });
  socket.on('offer',async({from,sdp})=>{if(!pcRef.current){await startLocalStream(); setupPeerConnection();}
  await pcRef.current.setRemoteDescription(new RTCSessionDescription(sdp));
  const answer=await pcRef.current.createAnswer();
  await pcRef.current.setLocalDescription(answer);
  socket.emit('answer',{to:from,sdp:pcRef.current.localDescription});
  setStatus('in-call');});
  socket.on('answer',async({from,sdp})=>{await pcRef.current.setRemoteDescription(new RTCSessionDescription(sdp)); setStatus('in-call');});
  socket.on('ice-candidate',async({from,candidate})=>{try{if(candidate && pcRef.current) await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));}catch(e){}});
  socket.on('partner-left',()=>{cleanupCall(); setPartnerId(null); setPartnerInfo({name:'',gender:''}); setStatus('waiting');});
  socket.on('chat-message',({from,message})=>{setMessages(prev=>[...prev,{from,message}]);});
  return ()=>{socket.off();};
},[]);

async function startLocalStream(){if(localStreamRef.current) return localStreamRef.current;
const stream=await navigator.mediaDevices.getUserMedia({video:true,audio:true});
localVideoRef.current.srcObject=stream;
localStreamRef.current=stream;
return stream;}

function setupPeerConnection(){
  pcRef.current=new RTCPeerConnection();
  pcRef.current.onicecandidate=e=>{if(e.candidate && partnerId) socket.emit('ice-candidate',{to:partnerId,candidate:e.candidate});};
  pcRef.current.ontrack=e=>{if(remoteVideoRef.current) remoteVideoRef.current.srcObject=e.streams[0];};
  const localStream=localStreamRef.current; if(localStream) localStream.getTracks().forEach(t=>pcRef.current.addTrack(t,localStream));
}

async function createOffer(){const offer=await pcRef.current.createOffer();await pcRef.current.setLocalDescription(offer);socket.emit('offer',{to:partnerId,sdp:pcRef.current.localDescription});}

function cleanupCall(){if(pcRef.current){pcRef.current.close(); pcRef.current=null;}
if(localStreamRef.current){localStreamRef.current.getTracks().forEach(t=>t.stop()); localStreamRef.current=null;}
if(localVideoRef.current) localVideoRef.current.srcObject=null;
if(remoteVideoRef.current) remoteVideoRef.current.srcObject=null;
setPartnerId(null); setPartnerInfo({name:'',gender:''}); setStatus('waiting'); setMessages([]);}

function leaveAndNext(){socket.emit('leave'); cleanupCall(); socket.emit('join',{name,gender}); setStatus('waiting');}

function sendMessage(){
  if(input.trim() && partnerId){socket.emit('chat-message',{to:partnerId,message:input});setMessages(prev=>[...prev,{from:'Me',message:input}]); setInput('');}
}

function renderLanding(){return (<div style={{textAlign:'center',padding:20}}>
<h1>Omegle Clone 🚀</h1>
<p>Online: {onlineCount}</p>
<input type="text" placeholder="Enter your name" value={name} onChange={e=>setName(e.target.value)} style={{padding:8,margin:10}}/>
<div style={{margin:10}}>
<label><input type="radio" value="male" checked={gender==='male'} onChange={e=>setGender(e.target.value)}/> Male</label>
<label style={{marginLeft:15}}><input type="radio" value="female" checked={gender==='female'} onChange={e=>setGender(e.target.value)}/> Female</label>
<label style={{marginLeft:15}}><input type="radio" value="other" checked={gender==='other'} onChange={e=>setGender(e.target.value)}/> Other</label>
</div>
<button disabled={!name||!gender} onClick={()=>{socket.emit('join',{name,gender}); setPage('call'); setStatus('joining');}} style={{padding:'10px 20px'}}>Connect to a stranger</button>
</div>);}

if(page==='landing') return renderLanding();

return (<div style={{textAlign:'center',padding:20,position:'relative'}}>
<h1>Omegle Clone 🚀</h1>
<p>Status: {status}</p>
<div style={{position:'absolute',top:10,right:20}}>Online: {onlineCount}</div>
<div style={{display:'flex',justifyContent:'center',gap:20,marginTop:20}}>

<div style={{position:'relative'}}>
<h3>You</h3>
<video ref={localVideoRef} autoPlay playsInline muted style={{width:320,height:240,background:'#000'}}/>
<div style={{position:'absolute',top:5,left:5,color:'#fff',background:'rgba(0,0,0,0.5)',padding:'2px 5px',borderRadius:4}}>{name} ({gender})</div>
</div>

<div style={{position:'relative'}}>
<h3>Stranger</h3>
<video ref={remoteVideoRef} autoPlay playsInline style={{width:320,height:240,background:'#000'}}/>
<div style={{position:'absolute',top:5,left:5,color:'#fff',background:'rgba(0,0,0,0.5)',padding:'2px 5px',borderRadius:4}}>{partnerId?`${partnerInfo.name} (${partnerInfo.gender})`:'Waiting for user'}</div>
</div>
</div>

<div style={{marginTop:20,display:'flex',justifyContent:'center',gap:10}}>
<div style={{flexDirection:'column',display:'flex'}}>
<div style={{height:100,width:400,border:'1px solid #ccc',overflowY:'auto',padding:5,marginBottom:5}}>
{messages.map((m,i)=><div key={i}><b>{m.from}:</b> {m.message}</div>)}
</div>
<div style={{display:'flex',gap:5}}>
<input value={input} onChange={e=>setInput(e.target.value)} style={{flex:1,padding:5}}/>
<button onClick={sendMessage}>Send</button>
</div>
</div>
</div>

<div style={{marginTop:20}}>
<button onClick={leaveAndNext} style={{marginRight:10}}>Next Stranger</button>
<button onClick={()=>{socket.emit('leave'); cleanupCall(); setPage('landing'); setStatus('init');}} style={{marginRight:10}}>Stop</button>
<button onClick={()=>{if(localStreamRef.current){localStreamRef.current.getAudioTracks().forEach(t=>t.enabled=!micOn); setMicOn(!micOn);}}} style={{marginRight:10}}>{micOn?'Mute':'Unmute'}</button>
<button onClick={()=>{if(localStreamRef.current){localStreamRef.current.getVideoTracks().forEach(t=>t.enabled=!camOn); setCamOn(!camOn);}}}>{camOn?'Camera Off':'Camera On'}</button>
</div>

</div>);
}
