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
  const [gender, setGender] = useState("male"); // default male
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

  const isWaitingRef = useRef(false);
  const chatWindowRef = useRef(null);

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
      startLocalStream().then(() => createPeerConnection(partnerId, initiator)).catch(() => {});
    });

    socket.on("offer", async ({ from, sdp }) => {
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
      setTypingIndicator("");
      setMessages((prev) => [...prev, { from: fromName || "Stranger", message }]);
    });

    socket.on("typing", ({ fromName }) => {
      setTypingIndicator(`${fromName || "Stranger"} is typing...`);
      setTimeout(() => setTypingIndicator(""), 2000); // clear after 2s
    });

    socket.on("partner-left", () => {
      cleanupCall(false); // keep camera on
      setPartnerId(null);
      setPartnerInfo(null);
      setStatus("waiting");
      if (name && gender) {
        socket.emit("join", { name, gender });
      }
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
      socket.off("typing");
      socket.off("partner-left");
    };
  }, [name, gender]);

  useEffect(() => {
    if (chatWindowRef.current) {
      chatWindowRef.current.scrollTop = chatWindowRef.current.scrollHeight;
    }
  }, [messages, typingIndicator]);

  async function startLocalStream() {
    if (localStreamRef.current) return localStreamRef.current;
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = s;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = s;
        localVideoRef.current.play().catch(() => {});
      }
      s.getAudioTracks().forEach((t) => (t.enabled = micOn));
      s.getVideoTracks().forEach((t) => (t.enabled = camOn));
      return s;
    } catch (err) {
      console.error("getUserMedia error", err);
      throw err;
    }
  }

  async function createPeerConnection(partnerSocketId, initiator = false, remoteOffer = null) {
    if (pcRef.current) {
      try { pcRef.current.close(); } catch {}
      pcRef.current = null;
    }

    const config = {
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        {
          urls: "turn:relay1.expressturn.com:3480",
          username: "000000002074682235",
          credential: "tN/jre4jo0Rpoi0z5MXgby3QAqo=",
        },
      ],
    };

    const pc = new RTCPeerConnection(config);
    pcRef.current = pc;

    pc.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
        remoteVideoRef.current.muted = false;
        remoteVideoRef.current.volume = 1;
        remoteVideoRef.current.play().catch(() => {});
      }
      setStatus("in-call");
    };

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socket.emit("ice-candidate", { to: partnerSocketId, candidate: e.candidate });
      }
    };

    const localStream = localStreamRef.current;
    if (localStream) {
      localStream.getTracks().forEach((track) => {
        try {
          pc.addTrack(track, localStream);
        } catch {}
      });
    }

    if (initiator) {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("offer", { to: partnerSocketId, sdp: pc.localDescription });
      } catch (e) {}
    } else if (remoteOffer) {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(remoteOffer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("answer", { to: partnerSocketId, sdp: pc.localDescription });
      } catch (e) {}
    }
  }

  function cleanupCall(stopCamera = true) {
    if (pcRef.current) {
      try { pcRef.current.close(); } catch {}
      pcRef.current = null;
    }
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    if (stopCamera && localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    setMessages([]);
  }

  async function handleJoin() {
    if (!name || !gender) {
      alert("Enter name and choose a gender.");
      return;
    }
    try {
      await startLocalStream();
      if (!isWaitingRef.current) {
        socket.emit("join", { name, gender });
        isWaitingRef.current = true;
        setStatus("joining");
      }
      setJoined(true);
    } catch (e) {}
  }

  function leaveAndNext() {
    if (partnerId) socket.emit("leave");
    cleanupCall(false); // keep camera
    setPartnerId(null);
    setPartnerInfo(null);
    isWaitingRef.current = true;
    socket.emit("join", { name, gender });
    setStatus("waiting");
  }

  function stopAndLeave() {
    if (partnerId) socket.emit("leave");
    cleanupCall(true); // stop camera
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
    }
  }

  function handleTyping(e) {
    setInput(e.target.value);
    if (partnerId) {
      socket.emit("typing", { to: partnerId, fromName: name });
    }
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

          {/* Vertical Gender Selection */}
          <div className="gender-vertical">
            <div
              className={`gender-option-vertical ${gender === "male" ? "active" : ""}`}
              onClick={() => setGender("male")}
            >
              ♂️ Male
            </div>
            <div
              className={`gender-option-vertical ${gender === "female" ? "active" : ""}`}
              onClick={() => setGender("female")}
            >
              ♀️ Female
            </div>
            <div
              className={`gender-option-vertical ${gender === "other" ? "active" : ""}`}
              onClick={() => setGender("other")}
            >
              ⚧️ Other
            </div>
          </div>

          <button className="primary" onClick={handleJoin}>
            Connect to a stranger
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="topbar">Online: {onlineCount} • Status: {status}</div>

      <div className="content">
        <div className="remote-area">
          <video ref={remoteVideoRef} className="remote-video" autoPlay playsInline />
          {!partnerId && <div className="waiting-overlay">Waiting for user...</div>}
          {partnerInfo && <div className="overlay highlight">{partnerInfo.name} ({partnerInfo.gender})</div>}

          <div className="controls">
            <button className={`control ${micOn ? "active" : "inactive"}`} onClick={toggleMic}>
              🎤
            </button>
            <button className={`control ${camOn ? "active" : "inactive"}`} onClick={toggleCam}>
              📷
            </button>
            <button className="control active" onClick={leaveAndNext}>
              ➡️
            </button>
            <button className="control stop" onClick={stopAndLeave}>
              ⛔
            </button>
          </div>
        </div>

        <div className="side-area">
          <div className="local-card">
            <video ref={localVideoRef} className="local-video" autoPlay muted playsInline />
            <div className="overlay small highlight">{name} ({gender})</div>
          </div>

          <div className="chat-card">
            <div className="chat-window" ref={chatWindowRef}>
              {messages.map((m, i) => (
                <div key={i}><strong>{m.from}:</strong> {m.message}</div>
              ))}
              {typingIndicator && <div className="typing">{typingIndicator}</div>}
            </div>
            <div className="chat-input">
              <input
                value={input}
                onChange={handleTyping}
                placeholder="Type a message..."
              />
              <button onClick={sendChat}>Send</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
