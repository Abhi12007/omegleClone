// client/src/App.js
import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import "./App.css";

const socket = io();

// ---- SVG Icon components (modern look) ----
const IconWrapper = ({ children }) => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" style={{ display: "block" }}>
    {React.cloneElement(children, { stroke: "currentColor", fill: "none", strokeWidth: 1.5 })}
  </svg>
);

const MicIcon = () => (
  <IconWrapper>
    <g>
      <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3z" />
      <path d="M19 11v1a7 7 0 0 1-14 0v-1" />
      <path d="M12 19v3" />
    </g>
  </IconWrapper>
);

const CameraIcon = () => (
  <IconWrapper>
    <g>
      <rect x="3.5" y="6" width="13" height="9" rx="2" />
      <path d="M17.5 8l4-2v11l-4-2" />
    </g>
  </IconWrapper>
);

const NextIcon = () => (
  <IconWrapper>
    <g>
      <path d="M5 19V5l14 7-14 7z" />
    </g>
  </IconWrapper>
);

const StopIcon = () => (
  <IconWrapper>
    <g>
      <rect x="5.5" y="5.5" width="13" height="13" rx="2" />
    </g>
  </IconWrapper>
);

// ---- Starfield (same as before) ----
function Starfield() {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let w = (canvas.width = window.innerWidth);
    let h = (canvas.height = window.innerHeight);

    const STAR_COUNT = Math.floor((w * h) / 9000);
    const stars = [];
    const shootingStars = [];
    let satellite = { x: -200, y: h * 0.12, vx: 0.8 + Math.random() * 0.6 };

    function rand(min, max) { return Math.random() * (max - min) + min; }

    for (let i = 0; i < STAR_COUNT; i++) {
      stars.push({
        x: Math.random() * w,
        y: Math.random() * h * 0.6,
        r: Math.random() * 1.8 + 0.3,
        twinkleSpeed: Math.random() * 0.02 + 0.005,
        phase: Math.random() * Math.PI * 2,
        hue: rand(180, 220),
      });
    }

    function drawConstellations() {
      ctx.save();
      ctx.globalAlpha = 0.06;
      ctx.strokeStyle = "#8fbfff";
      ctx.lineWidth = 1;
      for (let i = 0; i < stars.length; i++) {
        for (let j = i + 1; j < Math.min(i + 8, stars.length); j++) {
          const a = stars[i];
          const b = stars[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 120) {
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }
      ctx.restore();
    }

    function spawnShootingStar(x, y) {
      shootingStars.push({
        x, y,
        vx: 8 + Math.random() * 6,
        vy: -2 - Math.random() * 3,
        life: 0,
        maxLife: 90 + Math.floor(Math.random() * 40),
      });
    }

    function animate() {
      ctx.clearRect(0, 0, w, h);

      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, "#04122a");
      grad.addColorStop(1, "#06132a");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      for (const s of stars) {
        s.phase += s.twinkleSpeed;
        const alpha = 0.4 + Math.abs(Math.sin(s.phase)) * 0.9;
        ctx.beginPath();
        ctx.fillStyle = `hsla(${s.hue}, 80%, 70%, ${alpha})`;
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }

      drawConstellations();

      for (let i = shootingStars.length - 1; i >= 0; i--) {
        const sh = shootingStars[i];
        sh.x += sh.vx;
        sh.y += sh.vy;
        sh.vy += 0.12;
        sh.life++;
        const t = sh.life / sh.maxLife;
        ctx.beginPath();
        ctx.moveTo(sh.x, sh.y);
        ctx.lineTo(sh.x - sh.vx * 3, sh.y - sh.vy * 3);
        ctx.strokeStyle = `rgba(255,255,200,${1 - t})`;
        ctx.lineWidth = 2 + (1 - t) * 2;
        ctx.stroke();

        if (sh.life > sh.maxLife) shootingStars.splice(i, 1);
      }

      satellite.x += satellite.vx;
      if (satellite.x > w + 100) {
        satellite.x = -200;
        satellite.y = rand(h * 0.06, h * 0.18);
        satellite.vx = 0.6 + Math.random() * 1.2;
      }
      ctx.save();
      ctx.translate(satellite.x, satellite.y);
      ctx.fillStyle = "#c7f9ff";
      ctx.fillRect(0, 0, 18, 6);
      ctx.fillStyle = "rgba(199,249,255,0.25)";
      ctx.fillRect(-40, 2, 40, 2);
      ctx.restore();

      rafRef.current = requestAnimationFrame(animate);
    }

    function handlePointer(e) {
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX ?? e.touches?.[0]?.clientX) - rect.left;
      const y = (e.clientY ?? e.touches?.[0]?.clientY) - rect.top;
      spawnShootingStar(x - 60, y + 120);
    }

    function handleResize() {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    }

    window.addEventListener("pointerdown", handlePointer);
    window.addEventListener("resize", handleResize);
    animate();

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("pointerdown", handlePointer);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return <canvas ref={canvasRef} className="star-canvas" />;
}

// ---- Main App component ----
export default function App() {
  // media & connection refs
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteContainerRef = useRef(null);

  // app state
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

  // draggable local preview state (position relative to remote container)
  const [localPos, setLocalPos] = useState({ x: null, y: null }); // pixels from top-left of remote container
  const draggingRef = useRef(false);
  const dragStartRef = useRef({ sx: 0, sy: 0, lx: 0, ly: 0 });
  const localSize = { w: 120, h: 80 };

  // socket listeners
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

  // initialize default localPos once remote container size is available
  useEffect(() => {
    function setDefaultPos() {
      const container = remoteContainerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const x = rect.width - localSize.w - 16;
      const y = rect.height - localSize.h - 16;
      setLocalPos({ x, y });
    }
    // call after small delay to allow layout
    const t = setTimeout(setDefaultPos, 200);
    window.addEventListener("resize", setDefaultPos);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", setDefaultPos);
    };
  }, []);

  async function startLocalStream() {
    if (localStreamRef.current) return localStreamRef.current;
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = s;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = s;
        localVideoRef.current.muted = true;
        await localVideoRef.current.play().catch(() => {});
      }
      // reflect mic/cam flags
      s.getAudioTracks().forEach((t) => (t.enabled = micOn));
      s.getVideoTracks().forEach((t) => (t.enabled = camOn));
      return s;
    } catch (err) {
      console.error("getUserMedia failed", err);
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
    const audioTracks = s.getAudioTracks();
    if (audioTracks.length === 0) return;
    const willEnable = !audioTracks[0].enabled;
    audioTracks.forEach((t) => (t.enabled = willEnable));
    setMicOn(willEnable);
  }

  function toggleCam() {
    const s = localStreamRef.current;
    if (!s) return;
    const videoTracks = s.getVideoTracks();
    if (videoTracks.length === 0) return;
    const willEnable = !videoTracks[0].enabled;
    videoTracks.forEach((t) => (t.enabled = willEnable));
    setCamOn(willEnable);
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

  // Drag handlers
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
      ly: localPos.y ?? rect.height - localSize.h - 16,
      cw: rect.width,
      ch: rect.height,
    };
    // listeners
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
    // constrain
    nx = Math.max(6, Math.min(nx, cw - localSize.w - 6));
    ny = Math.max(6, Math.min(ny, ch - localSize.h - 6));
    setLocalPos({ x: nx, y: ny });
  }

  function onLocalPointerUp() {
    draggingRef.current = false;
    window.removeEventListener("pointermove", onLocalPointerMove);
    window.removeEventListener("pointerup", onLocalPointerUp);
  }

  // render typing bubble (as a "theirs" bubble with animated dots)
  function TypingBubble({ text }) {
    if (!text) return null;
    return (
      <div className="chat-bubble theirs typing-bubble">
        <div className="dots">
          <span /><span /><span />
        </div>
      </div>
    );
  }

  // Render
  if (!joined) {
    return (
      <div className="page">
        <Starfield />
        <div className="center-card">
          <div className="landing-header">
            <div style={{ width: 96, height: 64, background: "linear-gradient(90deg,#16a34a,#06b6d4)", borderRadius: 8, marginRight: 12 }} />
            <div className="landing-title">
              <h1>Omegle</h1>
              <div className="sub">Online: {onlineCount}</div>
            </div>
          </div>

          <input className="input" placeholder="Enter your name" value={name} onChange={(e) => setName(e.target.value)} />

          <div className="gender-vertical">
            <div className={`gender-option-vertical ${gender === "male" ? "active" : ""}`} onClick={() => setGender("male")}>♂️ Male</div>
            <div className={`gender-option-vertical ${gender === "female" ? "active" : ""}`} onClick={() => setGender("female")}>♀️ Female</div>
            <div className={`gender-option-vertical ${gender === "other" ? "active" : ""}`} onClick={() => setGender("other")}>⚧️ Other</div>
          </div>

          <button className="primary" onClick={async () => {
            await startLocalStream();
            socket.emit("join", { name, gender });
            setJoined(true);
            // ensure mic/cam flags applied
            if (localStreamRef.current) {
              localStreamRef.current.getAudioTracks().forEach((t) => (t.enabled = micOn));
              localStreamRef.current.getVideoTracks().forEach((t) => (t.enabled = camOn));
            }
          }}>Connect to a stranger</button>
        </div>
      </div>
    );
  }

  // compute inline style for local preview
  const localStyle = {};
  if (localPos.x !== null && localPos.y !== null) {
    localStyle.left = `${localPos.x}px`;
    localStyle.top = `${localPos.y}px`;
  } else {
    localStyle.right = "16px";
    localStyle.bottom = "16px";
  }

  return (
    <div className="page">
      <Starfield />
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
            style={localStyle}
          />

          <div className="controls centered">
            <button className={`control ${micOn ? "active" : "inactive"}`} onClick={toggleMic} title={micOn ? "Mute" : "Unmute"}>
              <MicIcon />
              <div className="label">Mute</div>
            </button>

            <button className={`control ${camOn ? "active" : "inactive"}`} onClick={toggleCam} title={camOn ? "Turn camera off" : "Turn camera on"}>
              <CameraIcon />
              <div className="label">Camera</div>
            </button>

            <button className="control active" onClick={leaveAndNext}>
              <NextIcon />
              <div className="label">Next</div>
            </button>

            <button className="control stop" onClick={stopAndLeave}>
              <StopIcon />
              <div className="label">Stop</div>
            </button>
          </div>
        </div>

        <div className="chat-card">
          <div className="chat-window" ref={chatWindowRef}>
            {messages.map((m, i) => (
              <div key={i} className={`chat-bubble ${m.mine ? "mine" : "theirs"}`}>{m.message}</div>
            ))}
            {typingIndicator && <TypingBubble text={typingIndicator} />}
          </div>

          <div className="chat-input modern">
            <input value={input} onChange={handleTyping} placeholder="Type a message..." onKeyDown={(e) => { if (e.key === "Enter") sendChat(); }} />
            <button onClick={sendChat}>Send</button>
          </div>
        </div>
      </div>
    </div>
  );
}
