import React, { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';

const socket = io(); // connects to same origin

export default function App() {
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState('init'); // init, waiting, paired, in-call
  const [partnerId, setPartnerId] = useState(null);
  const [initiator, setInitiator] = useState(false);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);

  useEffect(() => {
    socket.on('connect', () => {
      setConnected(true);
      // join the waiting queue automatically when connected
      socket.emit('join');
      setStatus('joining');
    });
    socket.on('disconnect', () => {
      setConnected(false);
      cleanupCall();
      setStatus('init');
    });

    socket.on('waiting', () => {
      setStatus('waiting');
    });

    socket.on('paired', ({ partnerId, initiator }) => {
      setPartnerId(partnerId);
      setInitiator(initiator);
      setStatus('paired');
      console.log('Paired with', partnerId, 'initiator:', initiator);
      // prepare for call
      startLocalStream().then(() => {
        setupPeerConnection();
        if (initiator) {
          createOffer();
        }
      });
    });

    socket.on('offer', async ({ from, sdp }) => {
      console.log('Received offer from', from);
      if (!pcRef.current) {
        await startLocalStream();
        setupPeerConnection();
      }
      await pcRef.current.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await pcRef.current.createAnswer();
      await pcRef.current.setLocalDescription(answer);
      socket.emit('answer', { to: from, sdp: pcRef.current.localDescription });
      setStatus('in-call');
    });

    socket.on('answer', async ({ from, sdp }) => {
      console.log('Received answer from', from);
      await pcRef.current.setRemoteDescription(new RTCSessionDescription(sdp));
      setStatus('in-call');
    });

    socket.on('ice-candidate', async ({ from, candidate }) => {
      try {
        if (candidate && pcRef.current) {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } catch (err) {
        console.warn('Error adding received ICE candidate', err);
      }
    });

    socket.on('partner-left', () => {
      alert('Partner left the call');
      cleanupCall();
      // rejoin queue
      socket.emit('join');
      setStatus('waiting');
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('waiting');
      socket.off('paired');
      socket.off('offer');
      socket.off('answer');
      socket.off('ice-candidate');
      socket.off('partner-left');
    };
  }, []);

  async function startLocalStream() {
    if (localStreamRef.current) return localStreamRef.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localVideoRef.current.srcObject = stream;
      localStreamRef.current = stream;
      return stream;
    } catch (err) {
      console.error('Could not get user media', err);
      alert('Please allow camera and microphone access.');
      throw err;
    }
  }

  function setupPeerConnection() {
    pcRef.current = new RTCPeerConnection();

    pcRef.current.onicecandidate = (event) => {
      if (event.candidate && partnerId) {
        socket.emit('ice-candidate', { to: partnerId, candidate: event.candidate });
      }
    };

    pcRef.current.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    // add local tracks if available
    const localStream = localStreamRef.current;
    if (localStream) {
      localStream.getTracks().forEach(track => pcRef.current.addTrack(track, localStream));
    }
  }

  async function createOffer() {
    try {
      const offer = await pcRef.current.createOffer();
      await pcRef.current.setLocalDescription(offer);
      socket.emit('offer', { to: partnerId, sdp: pcRef.current.localDescription });
    } catch (err) {
      console.error('Error creating offer', err);
    }
  }

  function cleanupCall() {
    // close peer connection
    if (pcRef.current) {
      try { pcRef.current.close(); } catch(e){}
      pcRef.current = null;
    }
    // stop local stream tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    setPartnerId(null);
    setInitiator(false);
    setStatus('waiting');
  }

  function leaveAndNext() {
    // tell server we're leaving current pair (if any)
    socket.emit('leave');
    cleanupCall();
    // join queue again
    socket.emit('join');
    setStatus('waiting');
  }

  return (
    <div style={{ textAlign: 'center', padding: 20 }}>
      <h1>Omegle Clone 🚀</h1>
      <p>Status: {status}</p>
      <p>Connected to signaling: {connected ? 'Yes' : 'No'}</p>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 20 }}>
        <div>
          <h3>You</h3>
          <video ref={localVideoRef} autoPlay playsInline muted style={{ width: 320, height: 240, background: '#000' }} />
        </div>
        <div>
          <h3>Stranger</h3>
          <video ref={remoteVideoRef} autoPlay playsInline style={{ width: 320, height: 240, background: '#000' }} />
        </div>
      </div>

      <div style={{ marginTop: 20 }}>
        <button onClick={() => { socket.emit('join'); setStatus('joining'); }} style={{ marginRight: 10 }}>
          Find Stranger
        </button>
        <button onClick={leaveAndNext} style={{ marginRight: 10 }}>Next Stranger</button>
        <button onClick={() => { socket.emit('leave'); cleanupCall(); setStatus('init'); }}>Stop</button>
      </div>
    </div>
  );
}
