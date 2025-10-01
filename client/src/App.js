// client/src/App.js
import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import "./App.css";

const socket = io();

export default function App() {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);

  const [name, setName] = useState("");
  const [gender, setGender] = useState("male");
  const [joined, setJoined] = useState(false);
  const [status, setStatus] = useState("init");

  const [partnerId, setPartnerId] = useState(null);
  const [partnerInfo, setPartnerInfo] = useState(null);

  const [onlineCount, setOnlineCount] = useState(0);

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [typingIndicator, setTypingIndicator] = useState("");

  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);

  const chatWindowRef = useRef(null);

  useEffect(() => {
    socket.on("online-count", (c) => setOnlineCount(c));
    socket.on("online-users", (c) => setOnlineCount(c));

    socket.on("waiting", () => setStatus("waiting"));

    socket.on("paired", async ({ partnerId, initiator, partnerInfo }) => {
      setPartnerId(partnerId);
      setPartnerInfo(partnerInfo || { name: "Stranger", gender: "other" });
      setStatus("paired");
      await startLocalStream();
      await createPeerConnection(partnerId, initiator);
    });

    socket.on("offer", async ({ from, sdp }) => {
      await startLocalStream();
      await createPeerConnection(from, false, sdp);
    });

    socket.on("answer", async ({ from, sdp }) => {
      if (pcRef.current) {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(sdp));
        setStatus("in-call");
      }
    });

    socket.on("ice-candidate", async ({ from, candidate }) => {
      if (candidate && pcRef.current) {
        await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      }
    });

    socket.on("chat-message", ({ fromName, message }) => {
      setTypingIndicator("");
      setMessages((prev) => [...prev, { from: fromName || "Stranger", message, mine: false }]);
    });

    socket.on("typing", ({ fromName }) => {
      setTypingIndicator(`${fromName || "Stranger"} is typing...`);
      setTimeout(() => setTypingIndicator(""), 2000);
    });

    socket.on("partner-left", () => {
      cleanupCall(false);
      setPartnerId(null);
      setPartnerInfo(null);
      setStatus("waiting");
      if (name && gender) socket.emit("join", { name, gender });
    });

    return () => socket.removeAllListeners();
  }, [name, gender]);

  useEffect(() => {
    if (chatWindowRef.current) {
      chatWindowRef.current.scrollTop = chatWindowRef.current.scrollHeight;
    }
  }, [messages, typingIndicator]);

  async function startLocalStream() {
    if (localStreamRef.current) return localStreamRef.current;
    const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localStreamRef.current = s;
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = s;
      localVideoRef.current.muted = true;
      localVideoRef.current.play().catch(() => {});
    }
    return s;
  }

  async function createPeerConnection(partnerSocketId, initiator = false, remoteOffer = null) {
    if (pcRef.current) pcRef.current.close();

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        {
          urls: "turn:relay1.expressturn.com:3480",
          username: "000000002074682235",
          credential: "tN/jre4jo0Rpoi0z5MXgby3QAqo=",
        },
      ],
    });
    pcRef.current = pc;

    pc.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
        remoteVideoRef.current.muted = false;
        remoteVideoRef.current.play().catch(() => {});
      }
    };

    pc.onicecandidate = (e) => {
      if (e.candidate) socket.emit("ice-candidate", { to: partnerSocketId, candidate: e.candidate });
    };

    const localStream = await startLocalStream();
    localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

    if (initiator) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit("offer", { to: partnerSocketId, sdp: pc.localDescription });
    } else if (remoteOffer) {
      await pc.setRemoteDescription(new RTCSessionDescription(remoteOffer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("answer", { to: partnerSocketId, sdp: pc.localDescription });
    }
  }

  function cleanupCall(stopCamera = false) {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    if (stopCamera && localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (localStreamRef.current && localVideoRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
    setMessages([]);
  }

  function leaveAndNext() {
    if (partnerId) socket.emit("leave");
    cleanupCall(false);
    setPartnerId(null);
    setPartnerInfo(null);
    socket.emit("join", { name, gender });
    setStatus("waiting");
  }

  function stopAndLeave() {
    if (partnerId) socket.emit("leave");
    cleanupCall(true);
    setJoined(false);
    setPartnerId(null);
    setPartnerInfo(null);
    setStatus("init");
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
      setMessages((prev) => [...prev, { from: "Me", message: input, mine: true }]);
      setInput("");
    }
  }

  function handleTyping(e) {
    setInput(e.target.value);
    if (partnerId) socket.emit("typing", { to: partnerId, fromName: name });
  }

  if (!joined) {
    return (
      <div className="page">
        <div className="card center-card">
          <h1>Omegle Clone</h1>
          <div className="sub">Online: {onlineCount}</div>
          <input
            className="input"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div className="gender-vertical">
            <div className={`gender-option-vertical ${gender === "male" ? "active" : ""}`} onClick={() => setGender("male")}>♂️ Male</div>
            <div className={`gender-option-vertical ${gender === "female" ? "active" : ""}`} onClick={() => setGender("female")}>♀️ Female</div>
            <div className={`gender-option-vertical ${gender === "other" ? "active" : ""}`} onClick={() => setGender("other")}>⚧️ Other</div>
          </div>
          <button className="primary" onClick={async () => {
            await startLocalStream();
            socket.emit("join", { name, gender });
            setJoined(true);
          }}>Connect to a stranger</button>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="topbar">Online: {onlineCount} • Status: {status}</div>

      <div className="content">
        <div className="video-container">
          <video ref={remoteVideoRef} className="remote-video" autoPlay playsInline />
          {!partnerId && <div className="waiting-overlay">Waiting for user...</div>}
          {partnerInfo && <div className="overlay highlight">{partnerInfo.name} ({partnerInfo.gender})</div>}

          {/* Floating local video */}
          <video ref={localVideoRef} className="local-video-floating" autoPlay muted playsInline />

          <div className="controls">
            <button className={`control ${micOn ? "active" : "inactive"}`} onClick={toggleMic}>
              🎤<div className="label">Mute</div>
            </button>
            <button className={`control ${camOn ? "active" : "inactive"}`} onClick={toggleCam}>
              📷<div className="label">Camera</div>
            </button>
            <button className="control active" onClick={leaveAndNext}>
              ➡️<div className="label">Next</div>
            </button>
            <button className="control stop" onClick={stopAndLeave}>
              ⛔<div className="label">Stop</div>
            </button>
          </div>
        </div>

        <div className="chat-card">
          <div className="chat-window" ref={chatWindowRef}>
            {messages.map((m, i) => (
              <div key={i} className={`chat-bubble ${m.mine ? "mine" : "theirs"}`}>
                {m.message}
              </div>
            ))}
            {typingIndicator && <div className="typing">{typingIndicator}</div>}
          </div>
          <div className="chat-input modern">
            <input value={input} onChange={handleTyping} placeholder="Type a message..."
                   onKeyDown={(e) => { if (e.key === "Enter") sendChat(); }} />
            <button onClick={sendChat}>Send</button>
          </div>
        </div>
      </div>
    </div>
  );
}
