// client/src/App.js
import React, { useEffect, useRef, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import io from "socket.io-client";
import About from "./About";
import Blog from "./Blog";
import Contact from "./Contact";
import "./App.css";

const socket = io(); // assumes same origin

/* ---------- SVG Icons ---------- */
function MicIcon({ active }) {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
      <g stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3z" />
        <path d="M19 11v1a7 7 0 0 1-14 0v-1" />
        <path d="M12 19v3" />
      </g>
      {!active && <line x1="4" y1="20" x2="20" y2="4" stroke="#ff4040" strokeWidth="2.2" />}
    </svg>
  );
}

function CameraIcon({ active }) {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
      <g stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3.5" y="6" width="13" height="9" rx="2" />
        <path d="M17.5 8l4-2v11l-4-2" />
      </g>
      {!active && <line x1="4" y1="20" x2="20" y2="4" stroke="#ff4040" strokeWidth="2.2" />}
    </svg>
  );
}

function NextIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
      <g stroke="#1e3a8a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 19V5l14 7-14 7z" />
      </g>
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="5.5" y="5.5" width="13" height="13" rx="2" fill="#ff5252" />
    </svg>
  );
}

function ReloadIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="#fff" strokeWidth="2.5" />
      <path
        d="M15 9l3 3-3 3"
        stroke="#fff"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ---------- App ---------- */
export default function App() {
  // Refs
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteContainerRef = useRef(null);

  // App state
  const [name, setName] = useState("");
  const [gender, setGender] = useState("male");
  const [joined, setJoined] = useState(false);
  const [status, setStatus] = useState("init");
  const [partnerId, setPartnerId] = useState(null);
  const [partnerInfo, setPartnerInfo] = useState(null);
  const [onlineCount, setOnlineCount] = useState(0);

  // chat
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [typingIndicator, setTypingIndicator] = useState("");

  // controls
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);

  const storedPrefsRef = useRef({ micOn: true, camOn: true, localPos: null });

  // draggable preview
  const localSize = { w: 120, h: 80 };
  const [localPos, setLocalPos] = useState({ x: null, y: null });
  const draggingRef = useRef(false);
  const dragStartRef = useRef({});

  const chatWindowRef = useRef(null);

  /* ---------- Socket listeners ---------- */
  useEffect(() => {
    socket.on("online-count", (c) => setOnlineCount(c));
    socket.on("online-users", (c) => setOnlineCount(c));
    socket.on("waiting", () => setStatus("waiting"));

    socket.on("paired", async ({ partnerId, initiator, partnerInfo }) => {
      setPartnerId(partnerId);
      setPartnerInfo(partnerInfo || { name: "Stranger", gender: "other" });
      setStatus("paired");
      await startLocalStream();
      applyStoredPrefsToTracks();
      await createPeerConnection(partnerId, initiator);
    });

    socket.on("offer", async ({ from, sdp }) => {
      await startLocalStream();
      applyStoredPrefsToTracks();
      await createPeerConnection(from, false, sdp);
    });

    socket.on("answer", async ({ sdp }) => {
      if (pcRef.current) {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(sdp));
        setStatus("in-call");
      }
    });

    socket.on("ice-candidate", async ({ candidate }) => {
      if (candidate && pcRef.current)
        await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
    });

    socket.on("chat-message", ({ fromName, message }) => {
      setTypingIndicator("");
      setMessages((prev) => [...prev, { from: fromName || "Stranger", message, mine: false }]);
    });

    socket.on("typing", ({ fromName }) => {
      setTypingIndicator(`${fromName || "Stranger"} is typing...`);
      setTimeout(() => setTypingIndicator(""), 1600);
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
    if (chatWindowRef.current) chatWindowRef.current.scrollTop = chatWindowRef.current.scrollHeight;
  }, [messages, typingIndicator]);

  /* ---------- local preview default position (top-right) ---------- */
  useEffect(() => {
    const cont = remoteContainerRef.current;
    if (!cont) return;
    const rect = cont.getBoundingClientRect();
    setLocalPos({ x: rect.width - localSize.w - 16, y: 16 });
  }, []);

  /* ---------- Media ---------- */
  async function startLocalStream(forceEnable = false) {
    if (localStreamRef.current) {
      if (forceEnable) {
        localStreamRef.current.getTracks().forEach((t) => (t.enabled = true));
        setMicOn(true);
        setCamOn(true);
      }
      return localStreamRef.current;
    }
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = s;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = s;
        localVideoRef.current.muted = true;
        await localVideoRef.current.play().catch(() => {});
      }
      return s;
    } catch (err) {
      console.error("getUserMedia failed", err);
      throw err;
    }
  }

  function applyStoredPrefsToTracks() {
    if (!localStreamRef.current) return;
    localStreamRef.current.getAudioTracks().forEach((t) => (t.enabled = storedPrefsRef.current.micOn));
    localStreamRef.current.getVideoTracks().forEach((t) => (t.enabled = storedPrefsRef.current.camOn));
    setMicOn(storedPrefsRef.current.micOn);
    setCamOn(storedPrefsRef.current.camOn);
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

    pc.ontrack = (e) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = e.streams[0];
      }
    };

    pc.onicecandidate = (e) => {
      if (e.candidate) socket.emit("ice-candidate", { to: partnerSocketId, candidate: e.candidate });
    };

    const localStream = await startLocalStream();
    localStream.getTracks().forEach((t) => pc.addTrack(t, localStream));

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

  function cleanupCall() {
    if (pcRef.current) pcRef.current.close();
    pcRef.current = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
  }

  /* ---------- Actions ---------- */
  async function handleConnect() {
    await startLocalStream(true);
    socket.emit("join", { name, gender });
    setJoined(true);
    setStatus("searching");
  }

  function handleNext() {
    if (partnerId) socket.emit("leave");
    cleanupCall();
    socket.emit("join", { name, gender });
    setStatus("searching");
  }

  function handleStop() {
    if (partnerId) socket.emit("leave");
    cleanupCall();
    setName(""); setGender("male"); setJoined(false); setPartnerId(null);
    setStatus("init");
  }

  function toggleMic() {
    const s = localStreamRef.current;
    if (!s) return;
    const track = s.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setMicOn(track.enabled);
    }
  }

  function toggleCam() {
    const s = localStreamRef.current;
    if (!s) return;
    const track = s.getVideoTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setCamOn(track.enabled);
    }
  }

  async function reloadLocalStream() {
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = newStream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = newStream;
        localVideoRef.current.muted = true;
        await localVideoRef.current.play().catch(() => {});
      }
    } catch (err) {
      console.error("reloadLocalStream error", err);
    }
  }

  /* ---------- Chat ---------- */
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

  /* ---------- Render ---------- */
  return (
    <Router>
      <Routes>
        <Route path="/about" element={<About />} />
        <Route path="/blog" element={<Blog />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/*" element={
          <div className="page">
            {!joined ? (
              <div className="center-card">
                <header className="landing-header-nav">
                  <nav>
                    <Link to="/about">About Us</Link>
                    <Link to="/contact">Contact Us</Link>
                    <Link to="/blog">Blog</Link>
                  </nav>
                </header>

                <div className="landing-header side-by-side">
                  <img src="/banner.png" alt="Banner" className="landing-banner" />
                  <div className="landing-title">
                    <h1>Omegle</h1>
                    <div className="sub">Online: {onlineCount}</div>
                  </div>
                </div>

                <input className="input white-text" placeholder="Enter your name" value={name} onChange={(e)=>setName(e.target.value)} />

                <div className="gender-vertical">
                  <div className={`gender-option-vertical ${gender==="male"?"active":""}`} onClick={()=>setGender("male")}>♂️ Male</div>
                  <div className={`gender-option-vertical ${gender==="female"?"active":""}`} onClick={()=>setGender("female")}>♀️ Female</div>
                  <div className={`gender-option-vertical ${gender==="other"?"active":""}`} onClick={()=>setGender("other")}>⚧️ Other</div>
                </div>

                <button className="primary" onClick={handleConnect}>Connect to a stranger</button>
              </div>
            ) : (
              <div className="inapp-wrapper">
                <div className="topbar">Online: {onlineCount} • Status: {status}</div>

                <div className="content">
                  <div className="video-container" ref={remoteContainerRef}>
                    <video ref={remoteVideoRef} className="remote-video" autoPlay playsInline />
                    {!partnerId && <div className="waiting-overlay">Waiting for user...</div>}
                    {partnerInfo && <div className="overlay">{partnerInfo.name} ({partnerInfo.gender})</div>}

                    <video ref={localVideoRef} className="local-video-floating" autoPlay muted playsInline style={{ left: localPos.x, top: localPos.y, position: "absolute" }} />

                    <button className="preview-reload" onClick={reloadLocalStream}><ReloadIcon /></button>

                    <div className="controls centered">
                      <button className={`control ${micOn ? "active" : "inactive"}`} onClick={toggleMic}><MicIcon active={micOn} /><div className="label">Mute</div></button>
                      <button className={`control ${camOn ? "active" : "inactive"}`} onClick={toggleCam}><CameraIcon active={camOn} /><div className="label">Camera</div></button>
                      <button className="control next glow" onClick={handleNext}><NextIcon /><div className="label">Next</div></button>
                      <button className="control stop" onClick={handleStop}><StopIcon /><div className="label">Stop</div></button>
                    </div>
                  </div>

                  <div className="chat-card">
                    <div className="chat-window" ref={chatWindowRef}>
                      {messages.map((m, i) => (
                        <div key={i} className={`chat-bubble ${m.mine ? "mine" : "theirs"}`}>
                          {!m.mine && <strong>{m.from}: </strong>}{m.message}
                        </div>
                      ))}
                      {typingIndicator && <div className="chat-bubble theirs typing">{typingIndicator}</div>}
                    </div>

                    <div className="chat-input modern">
                      <input value={input} onChange={handleTyping} placeholder="Type your message" onKeyDown={(e)=>{ if(e.key==="Enter") sendChat(); }} />
                      <button onClick={sendChat}>Send</button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        } />
      </Routes>
    </Router>
  );
}
