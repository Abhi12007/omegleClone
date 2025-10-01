// client/src/App.js
import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import "./App.css";

const socket = io();

export default function App() {
  // refs
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);

  // state
  const [name, setName] = useState("");
  const [gender, setGender] = useState("");
  const [joined, setJoined] = useState(false);
  const [status, setStatus] = useState("init"); // init, joining, waiting, paired, in-call

  const [partnerId, setPartnerId] = useState(null);
  const [partnerInfo, setPartnerInfo] = useState(null);

  const [onlineCount, setOnlineCount] = useState(0);

  // chat
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");

  // controls
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);

  // ensure we only emit join once while waiting
  const isWaitingRef = useRef(false);

  useEffect(() => {
    socket.on("online-count", (c) => setOnlineCount(c));
    socket.on("online-users", (c) => setOnlineCount(c));

    socket.on("waiting", () => {
      setStatus("waiting");
      isWaitingRef.current = true;
    });

    socket.on("paired", ({ partnerId, initiator, partnerInfo }) => {
      setPartnerId(partnerId);
      setPartnerInfo(partnerInfo || { name: "Stranger", gender: "other" });
      setStatus("paired");
      isWaitingRef.current = false;
      // ensure local stream started then create pc
      startLocalStream().then(() => createPeerConnection(partnerId, initiator)).catch(() => {});
    });

    socket.on("offer", async ({ from, sdp }) => {
      // handle incoming offer
      if (!pcRef.current) {
        await startLocalStream();
        await createPeerConnection(from, false, sdp);
      } else {
        try {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(sdp));
        } catch (e) {}
      }
    });

    socket.on("answer", async ({ from, sdp }) => {
      try {
        if (pcRef.current) {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(sdp));
          setStatus("in-call");
        }
      } catch (e) {}
    });

    socket.on("ice-candidate", async ({ from, candidate }) => {
      try {
        if (candidate && pcRef.current) {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } catch (e) {}
    });

    socket.on("chat-message", ({ fromName, message }) => {
      setMessages((prev) => [...prev, { from: fromName || "Stranger", message }]);
    });

    socket.on("partner-left", () => {
      cleanupCall();
      setPartnerId(null);
      setPartnerInfo(null);
      setStatus("waiting");
    });

    return () => {
      socket.off("online-count");
      socket.off("online-users");
      socket.off("waiting");
      socket.off("paired");
      socket.off("offer");
      socket.off("answer");
      socket.off("ice-candidate");
      socket.off("chat-message");
      socket.off("partner-left");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // start local stream
  async function startLocalStream() {
    if (localStreamRef.current) return localStreamRef.current;
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = s;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = s;
        localVideoRef.current.play().catch(() => {});
      }
      // apply toggles
      s.getAudioTracks().forEach((t) => (t.enabled = micOn));
      s.getVideoTracks().forEach((t) => (t.enabled = camOn));
      return s;
    } catch (err) {
      console.error("getUserMedia error", err);
      throw err;
    }
  }

  // create peer connection
  async function createPeerConnection(partnerSocketId, initiator = false, remoteOffer = null) {
    // close existing
    if (pcRef.current) {
      try { pcRef.current.close(); } catch (e) {}
      pcRef.current = null;
    }

    const config = {
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        // ExpressTurn TURN server (you provided)
        {
          urls: "turn:relay1.expressturn.com:3480",
          username: "000000002074682235",
          credential: "tN/jre4jo0Rpoi0z5MXgby3QAqo=",
        },
      ],
    };

    const pc = new RTCPeerConnection(config);
    pcRef.current = pc;

    // when remote track arrives
    pc.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
        remoteVideoRef.current.muted = false;
        remoteVideoRef.current.volume = 1;
        remoteVideoRef.current.play().catch(() => {});
      }
      setStatus("in-call");
    };

    // connection state handling
    pc.onconnectionstatechange = () => {
      const st = pc.connectionState;
      console.log("PC connectionState:", st);
      if (st === "failed" || st === "disconnected" || st === "closed") {
        setStatus("disconnected");
      }
      if (st === "connected") {
        setStatus("in-call");
      }
    };

    pc.oniceconnectionstatechange = () => {
      const ice = pc.iceConnectionState;
      console.log("ICE state:", ice);
      if (ice === "failed") {
        setStatus("ice-failed");
      } else if (ice === "connected") {
        setStatus("in-call");
      }
    };

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socket.emit("ice-candidate", { to: partnerSocketId, candidate: e.candidate });
      }
    };

    // add local tracks
    const localStream = localStreamRef.current;
    if (localStream) {
      localStream.getTracks().forEach((track) => {
        try {
          pc.addTrack(track, localStream);
        } catch (e) {
          // ignore
        }
      });
    }

    // offer/answer flow
    if (initiator) {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("offer", { to: partnerSocketId, sdp: pc.localDescription });
      } catch (e) {
        console.error("createOffer error", e);
      }
    } else if (remoteOffer) {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(remoteOffer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("answer", { to: partnerSocketId, sdp: pc.localDescription });
      } catch (e) {
        console.error("handle offer error", e);
      }
    }
  }

  // cleanup
  function cleanupCall() {
    if (pcRef.current) {
      try { pcRef.current.close(); } catch (e) {}
      pcRef.current = null;
    }
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    setMessages([]);
  }

  // Join queue
  async function handleJoin() {
    if (!name || !gender) {
      alert("Please enter name and select gender.");
      return;
    }
    try {
      await startLocalStream();
      // prevent emitting join repeatedly while waiting
      if (!isWaitingRef.current) {
        socket.emit("join", { name, gender });
        isWaitingRef.current = true;
        setStatus("joining");
      }
      setJoined(true);
    } catch (e) {
      // user denied permission
    }
  }

  function leaveAndNext() {
    if (partnerId) socket.emit("leave");
    cleanupCall();
    setPartnerId(null);
    setPartnerInfo(null);
    // re-join queue
    isWaitingRef.current = true;
    socket.emit("join", { name, gender });
    setStatus("waiting");
  }

  function stopAndLeave() {
    if (partnerId) socket.emit("leave");
    cleanupCall();
    setJoined(false);
    setPartnerId(null);
    setPartnerInfo(null);
    setStatus("init");
    isWaitingRef.current = false;
    socket.emit("leave");
  }

  function toggleMic() {
    const s = localStreamRef.current;
    if (!s) return;
    s.getAudioTracks().forEach((t) => (t.enabled = !t.enabled));
    setMicOn((v) => !v);
  }

  function toggleCam() {
    const s = localStreamRef.current;
    if (!s) return;
    s.getVideoTracks().forEach((t) => (t.enabled = !t.enabled));
    setCamOn((v) => !v);
  }

  function sendChat() {
    if (!input.trim()) return;
    if (partnerId) {
      socket.emit("chat-message", { to: partnerId, message: input });
      setMessages((prev) => [...prev, { from: "Me", message: input }]);
      setInput("");
    } else {
      alert("Not connected to a stranger.");
    }
  }

  if (!joined) {
    return (
      <div className="page">
        <div className="card center-card">
          <h1>Omegle Clone</h1>
          <div className="sub">Online: {onlineCount}</div>
          <input className="input" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
          <select className="select" value={gender} onChange={(e) => setGender(e.target.value)}>
            <option value="">Select gender</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
          <button className="primary" onClick={handleJoin}>Connect to a stranger</button>
        </div>
      </div>
    );
  }

  // joined view
  return (
    <div className="page">
      <div className="topbar">Online: {onlineCount} • Status: {status}</div>

      <div className="content">
        <div className="remote-area">
          <video ref={remoteVideoRef} className="remote-video" autoPlay playsInline />
          {!partnerId && <div className="waiting-overlay">Waiting for user...</div>}
          {partnerInfo && <div className="overlay">{partnerInfo.name} ({partnerInfo.gender})</div>}

          <div className="controls">
            <button className="control" onClick={toggleMic}>{micOn ? "Mute" : "Unmute"}</button>
            <button className="control" onClick={toggleCam}>{camOn ? "Camera Off" : "Camera On"}</button>
            <button className="control" onClick={leaveAndNext}>Next Stranger</button>
            <button className="control stop" onClick={stopAndLeave}>Stop</button>
          </div>
        </div>

        <div className="side-area">
          <div className="local-card">
            <video ref={localVideoRef} className="local-video" autoPlay muted playsInline />
            <div className="overlay small">{name} ({gender})</div>
          </div>

          <div className="chat-card">
            <div className="chat-window">
              {messages.map((m, i) => <div key={i}><strong>{m.from}:</strong> {m.message}</div>)}
            </div>
            <div className="chat-input">
              <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Type a message..." />
              <button onClick={sendChat}>Send</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
