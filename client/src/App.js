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
      <g stroke={active ? "#ffffff" : "#ffffff"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3z" />
        <path d="M19 11v1a7 7 0 0 1-14 0v-1" />
        <path d="M12 19v3" />
      </g>
      {!active && <line x1="4" y1="20" x2="20" y2="4" stroke="#ff4040" strokeWidth="2.2" strokeLinecap="round" />}
    </svg>
  );
}

function CameraIcon({ active }) {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
      <g stroke={active ? "#ffffff" : "#ffffff"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <rect x="3.5" y="6" width="13" height="9" rx="2" />
        <path d="M17.5 8l4-2v11l-4-2" />
      </g>
      {!active && <line x1="4" y1="20" x2="20" y2="4" stroke="#ff4040" strokeWidth="2.2" strokeLinecap="round" />}
    </svg>
  );
}

function NextIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
      <g stroke="#1e3a8a" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M5 19V5l14 7-14 7z" />
      </g>
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
      <g stroke="none" strokeWidth="0" fill="#ff5252">
        <rect x="5.5" y="5.5" width="13" height="13" rx="2" />
      </g>
    </svg>
  );
}

function ReloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M20 8v6h-6" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 12a8 8 0 0114-5.3L20 8" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
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
  const [status, setStatus] = useState("init"); // init | searching | waiting | paired | in-call
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

  // stored prefs for Next (persist while app open)
  const storedPrefsRef = useRef({ micOn: true, camOn: true, localPos: null });

  // draggable preview
  const localSize = { w: 120, h: 80 };
  const [localPos, setLocalPos] = useState({ x: null, y: null });
  const draggingRef = useRef(false);
  const dragStartRef = useRef({ sx: 0, sy: 0, lx: 0, ly: 0 });

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

    socket.on("answer", async ({ from, sdp }) => {
      if (pcRef.current) {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(sdp));
        setStatus("in-call");
      }
    });

    socket.on("ice-candidate", async ({ from, candidate }) => {
      if (candidate && pcRef.current) await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
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
    function setDefault() {
      const cont = remoteContainerRef.current;
      if (!cont) return;
      const rect = cont.getBoundingClientRect();
      const x = rect.width - localSize.w - 16;
      const y = 16;
      const stored = storedPrefsRef.current.localPos;
      if (stored) setLocalPos(stored);
      else setLocalPos({ x, y });
    }
    const t = setTimeout(setDefault, 200);
    window.addEventListener("resize", setDefault);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", setDefault);
    };
  }, []);

  /* ---------- Media & Peer ---------- */
  async function startLocalStream(forceEnable = false) {
    if (localStreamRef.current) {
      if (forceEnable) {
        localStreamRef.current.getAudioTracks().forEach((t) => (t.enabled = true));
        localStreamRef.current.getVideoTracks().forEach((t) => (t.enabled = true));
        setMicOn(true);
        setCamOn(true);
      }
      return localStreamRef.current;
    }
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = s;
      s.getAudioTracks().forEach((t) => (t.enabled = micOn));
      s.getVideoTracks().forEach((t) => (t.enabled = camOn));
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
    const { micOn: storedMic, camOn: storedCam } = storedPrefsRef.current;
    if (typeof storedMic === "boolean") {
      localStreamRef.current.getAudioTracks().forEach((t) => (t.enabled = storedMic));
      setMicOn(storedMic);
    }
    if (typeof storedCam === "boolean") {
      localStreamRef.current.getVideoTracks().forEach((t) => (t.enabled = storedCam));
      setCamOn(storedCam);
    }
    if (storedPrefsRef.current.localPos) setLocalPos(storedPrefsRef.current.localPos);
  }

  async function createPeerConnection(partnerSocketId, initiator = false, remoteOffer = null) {
    if (pcRef.current) {
      try { pcRef.current.close(); } catch {}
      pcRef.current = null;
    }
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
        remoteVideoRef.current.muted = false;
        remoteVideoRef.current.play().catch(() => {});
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

  function cleanupCall(stopCamera = false) {
    if (pcRef.current) {
      try { pcRef.current.close(); } catch {}
      pcRef.current = null;
    }
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;

    if (stopCamera && localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      if (localVideoRef.current) localVideoRef.current.srcObject = null;
    } else if (localStreamRef.current && localVideoRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
    setMessages([]);
  }

  /* ---------- Actions ---------- */
  async function handleConnect() {
    // initial connect: force mic & camera ON
    setMicOn(true);
    setCamOn(true);
    storedPrefsRef.current.micOn = true;
    storedPrefsRef.current.camOn = true;

    await startLocalStream(true);

    // default top-right
    const cont = remoteContainerRef.current;
    if (cont) {
      const rect = cont.getBoundingClientRect();
      const pos = { x: rect.width - localSize.w - 16, y: 16 };
      storedPrefsRef.current.localPos = pos;
      setLocalPos(pos);
    }

    socket.emit("join", { name, gender });
    setJoined(true);
    setStatus("searching");
  }

  function handleNext() {
    storedPrefsRef.current.micOn = micOn;
    storedPrefsRef.current.camOn = camOn;
    storedPrefsRef.current.localPos = localPos;
    if (partnerId) socket.emit("leave");
    cleanupCall(false);
    setPartnerId(null);
    setPartnerInfo(null);
    socket.emit("join", { name, gender });
    setStatus("searching");
  }

  function handleStop() {
    if (partnerId) socket.emit("leave");
    cleanupCall(true);
    storedPrefsRef.current = { micOn: true, camOn: true, localPos: null };
    setMicOn(true); setCamOn(true); setLocalPos({ x: null, y: null });
    setName(""); setGender("male"); setJoined(false); setPartnerId(null); setPartnerInfo(null); setStatus("init");
    socket.emit("leave");
  }

  function toggleMic() {
    const s = localStreamRef.current;
    if (!s) {
      storedPrefsRef.current.micOn = !micOn;
      setMicOn(!micOn);
      return;
    }
    const tracks = s.getAudioTracks();
    if (tracks.length === 0) return;
    const willEnable = !tracks[0].enabled;
    tracks.forEach((t) => (t.enabled = willEnable));
    setMicOn(willEnable);
    storedPrefsRef.current.micOn = willEnable;
  }

  function toggleCam() {
    const s = localStreamRef.current;
    if (!s) {
      storedPrefsRef.current.camOn = !camOn;
      setCamOn(!camOn);
      return;
    }
    const tracks = s.getVideoTracks();
    if (tracks.length === 0) return;
    const willEnable = !tracks[0].enabled;
    tracks.forEach((t) => (t.enabled = willEnable));
    setCamOn(willEnable);
    storedPrefsRef.current.camOn = willEnable;
  }

  // reload local stream: reacquire and replace tracks on the current pc
  async function reloadLocalStream() {
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      newStream.getAudioTracks().forEach((t) => (t.enabled = storedPrefsRef.current.micOn ?? true));
      newStream.getVideoTracks().forEach((t) => (t.enabled = storedPrefsRef.current.camOn ?? true));

      // update preview
      localStreamRef.current = newStream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = newStream;
        localVideoRef.current.muted = true;
        await localVideoRef.current.play().catch(() => {});
      }

      // replace tracks on existing RTCPeerConnection
      if (pcRef.current) {
        const senders = pcRef.current.getSenders();
        const audioTrack = newStream.getAudioTracks()[0];
        const videoTrack = newStream.getVideoTracks()[0];

        const audioSender = senders.find((s) => s.track && s.track.kind === "audio");
        const videoSender = senders.find((s) => s.track && s.track.kind === "video");

        if (audioSender && audioTrack) await audioSender.replaceTrack(audioTrack);
        else if (audioTrack) pcRef.current.addTrack(audioTrack, newStream);

        if (videoSender && videoTrack) await videoSender.replaceTrack(videoTrack);
        else if (videoTrack) pcRef.current.addTrack(videoTrack, newStream);
      }

      setMicOn(newStream.getAudioTracks().some((t) => t.enabled));
      setCamOn(newStream.getVideoTracks().some((t) => t.enabled));
      storedPrefsRef.current.micOn = micOn;
      storedPrefsRef.current.camOn = camOn;
    } catch (err) {
      console.error("reloadLocalStream error", err);
      alert("Unable to access camera/microphone. Check browser permissions.");
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

  /* ---------- Drag handlers for local preview ---------- */
  function onLocalPointerDown(e) {
    e.preventDefault();
    draggingRef.current = true;
    const container = remoteContainerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const startX = (e.clientX ?? e.touches?.[0]?.clientX) - rect.left;
    const startY = (e.clientY ?? e.touches?.[0]?.clientY) - rect.top;
    dragStartRef.current = {
      sx: startX,
      sy: startY,
      lx: localPos.x ?? rect.width - localSize.w - 16,
      ly: localPos.y ?? 16,
      cw: rect.width,
      ch: rect.height,
    };
    window.addEventListener("pointermove", onLocalPointerMove);
    window.addEventListener("pointerup", onLocalPointerUp);
  }

  function onLocalPointerMove(e) {
    if (!draggingRef.current) return;
    const container = remoteContainerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const moveX = (e.clientX ?? e.touches?.[0]?.clientX) - rect.left;
    const moveY = (e.clientY ?? e.touches?.[0]?.clientY) - rect.top;
    const { sx, sy, lx, ly, cw, ch } = dragStartRef.current;
    let nx = lx + (moveX - sx);
    let ny = ly + (moveY - sy);

    // constrain inside remote and avoid overlapping bottom controls area (reserve 120px)
    const controlsMargin = 120;
    nx = Math.max(6, Math.min(nx, cw - localSize.w - 6));
    ny = Math.max(6, Math.min(ny, ch - localSize.h - controlsMargin));
    setLocalPos({ x: nx, y: ny });
    storedPrefsRef.current.localPos = { x: nx, y: ny };
  }

  function onLocalPointerUp() {
    draggingRef.current = false;
    window.removeEventListener("pointermove", onLocalPointerMove);
    window.removeEventListener("pointerup", onLocalPointerUp);
  }

  const previewStyle = {};
  if (localPos.x !== null && localPos.y !== null) {
    previewStyle.left = `${localPos.x}px`;
    previewStyle.top = `${localPos.y}px`;
    previewStyle.position = "absolute";
  } else {
    previewStyle.right = "16px";
    previewStyle.top = "16px";
    previewStyle.position = "absolute";
  }

  /* ---------- Typing bubble ---------- */
  function TypingBubble() {
    if (!typingIndicator) return null;
    return (
      <div className="chat-bubble theirs typing-bubble">
        <div className="dots"><span /><span /><span /></div>
      </div>
    );
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
            {/* Header nav on landing only */}
            {!joined && (
              <header className="landing-header-nav">
                <nav>
                  <Link to="/about">About Us</Link>
                  <Link to="/contact">Contact Us</Link>
                  <Link to="/blog">Blog</Link>
                </nav>
              </header>
            )}

            {!joined ? (
              /* ----- LANDING ----- */
              <div className="center-card">
                <div className="landing-header">
                  <div className="landing-title">
                    <h1>Omegle</h1>
                    <div className="sub">Online: {onlineCount}</div>
                  </div>

                  {/* banner from public */}
                  <img src="/banner.png" alt="Banner" className="landing-banner" />
                </div>

                <input className="input" placeholder="Enter your name" value={name} onChange={(e)=>setName(e.target.value)} />

                <div className="gender-vertical">
                  <div className={`gender-option-vertical ${gender==="male"?"active":""}`} onClick={()=>setGender("male")}>♂️ Male</div>
                  <div className={`gender-option-vertical ${gender==="female"?"active":""}`} onClick={()=>setGender("female")}>♀️ Female</div>
                  <div className={`gender-option-vertical ${gender==="other"?"active":""}`} onClick={()=>setGender("other")}>⚧️ Other</div>
                </div>

                <button className="primary" onClick={async ()=>{ await startLocalStream(true); socket.emit("join",{name,gender}); setJoined(true); setStatus("searching"); }}>
                  Connect to a stranger
                </button>

                <div className="info-section">
                  <h2>Talk To Stranger</h2>
                  <p>
                    Omegle lets you connect instantly with strangers across the world. Start a chat or video call and meet new people anytime.
                  </p>
                  <h3>Communication Guidelines</h3>
                  <ul>
                    <li>Be respectful and kind.</li>
                    <li>Do not share personal information.</li>
                    <li>Report inappropriate behavior.</li>
                    <li>Enjoy making new friends!</li>
                  </ul>
                </div>

                <footer className="landing-footer">
                  <div className="footer-left">
                    Follow us on <span className="insta-icon">📸 Instagram</span>
                  </div>
                  <div className="footer-right">
                    <a href="#">Terms of Service</a>
                    <a href="#">Privacy Policy</a>
                    <a href="/about">About Us</a>
                    <a href="/contact">Contact Us</a>
                  </div>
                </footer>
              </div>
            ) : (
              /* ----- IN-APP (video + chat) ----- */
              <div className="inapp-wrapper">
                <div className="topbar">Online: {onlineCount} • Status: {status}</div>

                <div className="content">
                  <div className="video-container" ref={remoteContainerRef}>
                    <video ref={remoteVideoRef} className="remote-video" autoPlay playsInline />
                    {!partnerId && <div className="waiting-overlay">Waiting for user...</div>}
                    {partnerInfo && <div className="overlay green-glow">{partnerInfo.name} ({partnerInfo.gender})</div>}

                    <video
                      ref={localVideoRef}
                      className="local-video-floating green-glow"
                      autoPlay muted playsInline
                      onPointerDown={onLocalPointerDown}
                      style={previewStyle}
                    />

                    {/* reload button positioned relative to small preview
                        ensure it stays within preview bounds by computing left/top inline */}
                    <button
                      className="preview-reload"
                      onClick={reloadLocalStream}
                      style={{
                        left: localPos.x !== null ? `${localPos.x + localSize.w - 20}px` : undefined,
                        top: localPos.y !== null ? `${localPos.y - 10}px` : undefined,
                        right: localPos.x === null ? "18px" : undefined,
                        position: "absolute",
                      }}
                      title="Reload camera"
                    >
                      <ReloadIcon />
                    </button>

                    <div className="controls centered">
                      <button className={`control ${micOn ? "active" : "inactive"}`} onClick={toggleMic} title={micOn ? "Mute" : "Unmute"}>
                        <MicIcon active={micOn} />
                        <div className="label">Mute</div>
                      </button>

                      <button className={`control ${camOn ? "active" : "inactive"}`} onClick={toggleCam} title={camOn ? "Camera Off" : "Camera On"}>
                        <CameraIcon active={camOn} />
                        <div className="label">Camera</div>
                      </button>

                      <button className="control next" onClick={handleNext} title="Next">
                        <NextIcon />
                        <div className="label">Next</div>
                      </button>

                      <button className="control stop" onClick={handleStop} title="Stop">
                        <StopIcon />
                        <div className="label">Stop</div>
                      </button>
                    </div>
                  </div>

                  <div className="chat-card">
                    <div className="chat-window" ref={chatWindowRef}>
                      {messages.map((m, i) => (
                        <div key={i} className={`chat-bubble ${m.mine ? "mine" : "theirs"}`}>
                          <strong style={{display: m.mine ? "none" : "inline"}}>{m.from}: </strong>
                          {m.message}
                        </div>
                      ))}

                      {typingIndicator && <TypingBubble />}
                    </div>

                    <div className="chat-input modern">
                      <button className="plus-btn" title="Open extras">＋</button>
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
