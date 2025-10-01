// client/src/App.js
import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import "./App.css";

const socket = io();

// SVG icons
function MicIcon({ active }) {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
      <g stroke={active ? "#ffffff" : "#ffffff"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3z" />
        <path d="M19 11v1a7 7 0 0 1-14 0v-1" />
        <path d="M12 19v3" />
      </g>
      {!active && (<line x1="4" y1="20" x2="20" y2="4" stroke="#ff4040" strokeWidth="2.2" strokeLinecap="round" />)}
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
      {!active && (<line x1="4" y1="20" x2="20" y2="4" stroke="#ff4040" strokeWidth="2.2" strokeLinecap="round" />)}
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

export default function App() {
  // refs
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteContainerRef = useRef(null);

  // state
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

  // store preferences for Next (preserved)
  const storedPrefsRef = useRef({ micOn: true, camOn: true, localPos: null });

  const chatWindowRef = useRef(null);

  // draggable preview
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

  // default pos set on layout; top-right by default for initial connect
  useEffect(() => {
    function setDefault() {
      const cont = remoteContainerRef.current;
      if (!cont) return;
      const rect = cont.getBoundingClientRect();
      const x = rect.width - localSize.w - 16;
      const y = 16;
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
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      if (localVideoRef.current) localVideoRef.current.srcObject = null;
    } else if (localStreamRef.current && localVideoRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
    setMessages([]);
  }

  // Connect flow: force mic/cam ON and default top-right
  async function handleConnect() {
    setMicOn(true);
    setCamOn(true);
    storedPrefsRef.current.micOn = true;
    storedPrefsRef.current.camOn = true;

    await startLocalStream(true);

    // ensure default top-right
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

  // Next keeps prefs & position
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

  // Stop clears info and stored prefs
  function handleStop() {
    if (partnerId) socket.emit("leave");
    cleanupCall(true);
    storedPrefsRef.current = { micOn: true, camOn: true, localPos: null };
    setMicOn(true);
    setCamOn(true);
    setLocalPos({ x: null, y: null });
    setName("");
    setGender("male");
    setJoined(false);
    setPartnerId(null);
    setPartnerInfo(null);
    setStatus("init");
    socket.emit("leave");
  }

  // Toggle mic/cam
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

  // reload local stream: reacquire and replace tracks in active pc
  async function reloadLocalStream() {
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      // apply stored prefs
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
        // replace audio
        const audioTrack = newStream.getAudioTracks()[0];
        const videoTrack = newStream.getVideoTracks()[0];

        const audioSender = senders.find((s) => s.track && s.track.kind === "audio");
        const videoSender = senders.find((s) => s.track && s.track.kind === "video");

        if (audioSender && audioTrack) {
          await audioSender.replaceTrack(audioTrack);
        } else if (audioTrack) {
          pcRef.current.addTrack(audioTrack, newStream);
        }

        if (videoSender && videoTrack) {
          await videoSender.replaceTrack(videoTrack);
        } else if (videoTrack) {
          pcRef.current.addTrack(videoTrack, newStream);
        }
      }

      // update UI flags
      setMicOn(newStream.getAudioTracks().some((t) => t.enabled));
      setCamOn(newStream.getVideoTracks().some((t) => t.enabled));
      storedPrefsRef.current.micOn = micOn;
      storedPrefsRef.current.camOn = camOn;
    } catch (err) {
      console.error("reloadLocalStream error", err);
      alert("Unable to access camera/microphone. Check browser permissions.");
    }
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

  // drag handlers - with constraint that preview can't go into bottom controls area
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

    // constrain: don't overlap controls area (reserve bottom 120px)
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

  function TypingBubble() {
    if (!typingIndicator) return null;
    return (
      <div className="chat-bubble theirs typing-bubble">
        <div className="dots"><span /><span /><span /></div>
      </div>
    );
  }

  if (!joined) {
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

          {/* reload button positioned relative to small preview */}
          <button
            className="preview-reload"
            onClick={reloadLocalStream}
            style={{
              left: localPos.x !== null ? `${localPos.x + localSize.w - 18}px` : undefined,
              top: localPos.y !== null ? `${localPos.y - 10}px` : undefined,
              right: localPos.x === null ? "8px" : undefined,
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
