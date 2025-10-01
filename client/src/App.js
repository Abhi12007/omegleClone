// client/src/App.js
import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import "./App.css";

const socket = io();

// SVG icons (white by default). If inactive (false) mic/camera show a red slash.
// Next: blue; Stop: red.
function MicIcon({ active }) {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
      <g stroke={active ? "#ffffff" : "#ffffff"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3z" />
        <path d="M19 11v1a7 7 0 0 1-14 0v-1" />
        <path d="M12 19v3" />
      </g>
      {!active && (
        <g>
          <line x1="4" y1="20" x2="20" y2="4" stroke="#ff4040" strokeWidth="2.2" strokeLinecap="round" />
        </g>
      )}
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
      {!active && (
        <g>
          <line x1="4" y1="20" x2="20" y2="4" stroke="#ff4040" strokeWidth="2.2" strokeLinecap="round" />
        </g>
      )}
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

export default function App() {
  // refs
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

  // chat
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [typingIndicator, setTypingIndicator] = useState("");

  // controls
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);

  // store preferences when searching (persist across Next)
  const storedPrefsRef = useRef({ micOn: true, camOn: true, localPos: null });

  // chat window ref
  const chatWindowRef = useRef(null);

  // draggable preview state
  const localSize = { w: 120, h: 80 };
  const [localPos, setLocalPos] = useState({ x: null, y: null });
  const draggingRef = useRef(false);
  const dragStartRef = useRef({ sx: 0, sy: 0, lx: 0, ly: 0 });

  // socket listeners
  useEffect(() => {
    socket.on("online-count", (c) => setOnlineCount(c));
    socket.on("online-users", (c) => setOnlineCount(c));
    socket.on("waiting", () => setStatus("waiting"));

    socket.on("paired", async ({ partnerId, initiator, partnerInfo }) => {
      setPartnerId(partnerId);
      setPartnerInfo(partnerInfo || { name: "Stranger", gender: "other" });
      setStatus("paired");
      // apply stored prefs for Next; if first connect (joined just became true from landing) then mic/cam were forced open in connect flow
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
      // when partner left while we are searching, if stored prefs exist re-emit join to queue
      if (name && gender) socket.emit("join", { name, gender });
    });

    return () => socket.removeAllListeners();
  }, [name, gender]);

  useEffect(() => {
    if (chatWindowRef.current) chatWindowRef.current.scrollTop = chatWindowRef.current.scrollHeight;
  }, [messages, typingIndicator]);

  // default preview pos: top-right inside remote after layout
  useEffect(() => {
    function setDefault() {
      const cont = remoteContainerRef.current;
      if (!cont) return;
      const rect = cont.getBoundingClientRect();
      const x = rect.width - localSize.w - 16;
      const y = 16; // top-right default
      // if stored position exists (from storedPrefsRef), use it
      const stored = storedPrefsRef.current.localPos;
      if (stored) {
        setLocalPos(stored);
      } else {
        setLocalPos({ x, y });
      }
    }
    const t = setTimeout(setDefault, 200);
    window.addEventListener("resize", setDefault);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", setDefault);
    };
  }, []);

  // getUserMedia
  async function startLocalStream(forceEnable = false) {
    if (localStreamRef.current) {
      // maybe re-enable tracks if needed
      if (forceEnable && localStreamRef.current) {
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
      // set tracks according to current state (micOn/camOn)
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
    // if stream present, apply stored prefs
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
    // apply stored localPos if exist
    if (storedPrefsRef.current.localPos) setLocalPos(storedPrefsRef.current.localPos);
  }

  // Peer connection
  async function createPeerConnection(partnerSocketId, initiator = false, remoteOffer = null) {
    if (pcRef.current) {
      try { pcRef.current.close(); } catch (e) {}
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
      try { pcRef.current.close(); } catch (e) {}
      pcRef.current = null;
    }
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;

    if (stopCamera && localStreamRef.current) {
      // fully stop and clear local stream
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      if (localVideoRef.current) localVideoRef.current.srcObject = null;
    } else {
      // keep preview active, apply local stream back to preview
      if (localStreamRef.current && localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current;
    }

    setMessages([]);
  }

  // Actions: connect (initial), next, stop
  async function handleConnect() {
    // initial connect should open mic & camera (force on)
    setMicOn(true);
    setCamOn(true);
    storedPrefsRef.current.micOn = true;
    storedPrefsRef.current.camOn = true;

    await startLocalStream(true); // force enable
    // ensure stored position exists (top-right by default)
    const cont = remoteContainerRef.current;
    if (cont && !storedPrefsRef.current.localPos) {
      const rect = cont.getBoundingClientRect();
      storedPrefsRef.current.localPos = { x: rect.width - localSize.w - 16, y: 16 };
      setLocalPos(storedPrefsRef.current.localPos);
    }
    socket.emit("join", { name, gender });
    setJoined(true);
    setStatus("searching");
  }

  function handleNext() {
    // keep prefs stored (micOn, camOn, localPos)
    storedPrefsRef.current.micOn = micOn;
    storedPrefsRef.current.camOn = camOn;
    storedPrefsRef.current.localPos = localPos;
    // leave current if any
    if (partnerId) socket.emit("leave");
    cleanupCall(false); // keep local camera running
    setPartnerId(null);
    setPartnerInfo(null);
    socket.emit("join", { name, gender });
    setStatus("searching");
  }

  function handleStop() {
    // stop and erase info (per your request)
    if (partnerId) socket.emit("leave");
    // fully stop media
    cleanupCall(true);
    // clear stored prefs
    storedPrefsRef.current = { micOn: true, camOn: true, localPos: null };
    setMicOn(true);
    setCamOn(true);
    setLocalPos({ x: null, y: null });
    // clear name/gender/joined
    setName("");
    setGender("male");
    setJoined(false);
    setPartnerId(null);
    setPartnerInfo(null);
    setStatus("init");
    socket.emit("leave");
  }

  // Toggle mic/cam reliably
  function toggleMic() {
    const s = localStreamRef.current;
    if (!s) {
      // update stored pref so when stream starts it will honor this
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

  // chat
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

  // Dragging logic for local preview
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

    // constrain within remote video and prevent overlapping the controls area.
    // We'll assume controls area occupies bottom 120px of container (safe margin).
    const controlsMargin = 120;
    nx = Math.max(6, Math.min(nx, cw - localSize.w - 6));
    ny = Math.max(6, Math.min(ny, ch - localSize.h - controlsMargin));
    setLocalPos({ x: nx, y: ny });
    // Also update stored prefs while moving so Next remembers position
    storedPrefsRef.current.localPos = { x: nx, y: ny };
  }

  function onLocalPointerUp() {
    draggingRef.current = false;
    window.removeEventListener("pointermove", onLocalPointerMove);
    window.removeEventListener("pointerup", onLocalPointerUp);
  }

  // computed style for preview
  const previewStyle = {};
  if (localPos.x !== null && localPos.y !== null) {
    previewStyle.left = `${localPos.x}px`;
    previewStyle.top = `${localPos.y}px`;
    previewStyle.right = "auto";
    previewStyle.bottom = "auto";
    previewStyle.position = "absolute";
  } else {
    previewStyle.right = "16px";
    previewStyle.bottom = "16px";
    previewStyle.position = "absolute";
  }

  // typing bubble component
  function TypingBubble() {
    if (!typingIndicator) return null;
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
    // Landing view (no starfield here — restored to previous simpler look)
    return (
      <div className="page">
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

          <button className="primary" onClick={handleConnect}>Connect to a stranger</button>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="topbar">Online: {onlineCount} • Status: {status}</div>

      <div className="content">
        <div className="video-container" ref={remoteContainerRef}>
          <video ref={remoteVideoRef} className="remote-video" autoPlay playsInline />
          {!partnerId && <div className="waiting-overlay">Waiting for user...</div>}
          {partnerInfo && <div className="overlay green-glow">{partnerInfo.name} ({partnerInfo.gender})</div>}

          <video
            ref={localVideoRef}
            className="local-video-floating green-glow"
            autoPlay
            muted
            playsInline
            onPointerDown={onLocalPointerDown}
            style={previewStyle}
          />

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
              <div key={i} className={`chat-bubble ${m.mine ? "mine" : "theirs"}`}>{m.message}</div>
            ))}

            {typingIndicator && <TypingBubble />}
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
