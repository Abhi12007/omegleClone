// client/src/VideoPage.js
import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import "./App.css";

const socket = io(); // same origin

/* ---------- SVG Icons ---------- */
function MicIcon({ active }) {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
      <g stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
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
      <g stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
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
      <g stroke="none" fill="#ff5252">
        <rect x="5.5" y="5.5" width="13" height="13" rx="2" />
      </g>
    </svg>
  );
}

/* ---------- Typing Bubble ---------- */
function TypingBubble() {
  return (
    <div className="chat-bubble theirs typing-bubble">
      <div className="dots">
        <span></span><span></span><span></span>
      </div>
    </div>
  );
}

/* ---------- Video Page ---------- */
export default function VideoPage({ name, gender, setJoined }) {
  const [status, setStatus] = useState("init");
  const [partnerId, setPartnerId] = useState(null);
  const [partnerInfo, setPartnerInfo] = useState(null);
  const [onlineCount, setOnlineCount] = useState(0);

  // Chat
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [typingIndicator, setTypingIndicator] = useState("");

  // Controls
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);

  // Reporting / Block
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockCountdown, setBlockCountdown] = useState(60);
  const countdownInterval = useRef(null);
  const [blockedUsers, setBlockedUsers] = useState([]);

  // Refs
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteContainerRef = useRef(null);
  const chatWindowRef = useRef(null);

  // Drag local preview
  const localSize = { w: 120, h: 80 };
  const [localPos, setLocalPos] = useState({ x: null, y: null });
  const draggingRef = useRef(false);
  const dragStartRef = useRef({});

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

    socket.on("reported", () => {
      setIsBlocked(true);
      setBlockCountdown(60);
      countdownInterval.current = setInterval(() => {
        setBlockCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownInterval.current);
            setIsBlocked(false);
            socket.emit("join", { name, gender });
            setStatus("searching");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    });

    return () => socket.removeAllListeners();
  }, [name, gender]);

  useEffect(() => {
    if (chatWindowRef.current)
      chatWindowRef.current.scrollTop = chatWindowRef.current.scrollHeight;
  }, [messages, typingIndicator]);

  /* ---------- Media & Peer ---------- */
  async function startLocalStream(forceEnable = false) {
    if (localStreamRef.current) return localStreamRef.current;
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
    localStreamRef.current.getAudioTracks().forEach((t) => (t.enabled = micOn));
    localStreamRef.current.getVideoTracks().forEach((t) => (t.enabled = camOn));
  }

  async function createPeerConnection(partnerSocketId, initiator = false, remoteOffer = null) {
    if (pcRef.current) { try { pcRef.current.close(); } catch {} pcRef.current = null; }
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
    if (pcRef.current) { try { pcRef.current.close(); } catch {} pcRef.current = null; }
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    if (stopCamera && localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    setMessages([]);
  }

  /* ---------- Controls ---------- */
  function toggleMic() {
    const tracks = localStreamRef.current?.getAudioTracks();
    if (tracks?.length) {
      const willEnable = !tracks[0].enabled;
      tracks.forEach((t) => (t.enabled = willEnable));
      setMicOn(willEnable);
    }
  }

  function toggleCam() {
    const tracks = localStreamRef.current?.getVideoTracks();
    if (tracks?.length) {
      const willEnable = !tracks[0].enabled;
      tracks.forEach((t) => (t.enabled = willEnable));
      setCamOn(willEnable);
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
      if (pcRef.current) {
        const senders = pcRef.current.getSenders();
        const audioTrack = newStream.getAudioTracks()[0];
        const videoTrack = newStream.getVideoTracks()[0];
        const audioSender = senders.find((s) => s.track?.kind === "audio");
        const videoSender = senders.find((s) => s.track?.kind === "video");
        if (audioSender && audioTrack) await audioSender.replaceTrack(audioTrack);
        if (videoSender && videoTrack) await videoSender.replaceTrack(videoTrack);
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

  /* ---------- Drag local preview ---------- */
  function onLocalPointerDown(e) {
    e.preventDefault();
    draggingRef.current = true;
    const container = remoteContainerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    dragStartRef.current = {
      sx: (e.clientX ?? e.touches?.[0]?.clientX) - rect.left,
      sy: (e.clientY ?? e.touches?.[0]?.clientY) - rect.top,
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
    nx = Math.max(6, Math.min(nx, cw - localSize.w - 6));
    ny = Math.max(6, Math.min(ny, ch - localSize.h - 120));
    setLocalPos({ x: nx, y: ny });
  }

  function onLocalPointerUp() {
    draggingRef.current = false;
    window.removeEventListener("pointermove", onLocalPointerMove);
    window.removeEventListener("pointerup", onLocalPointerUp);
  }

  const previewStyle = {
    left: localPos.x ? `${localPos.x}px` : "auto",
    top: localPos.y ? `${localPos.y}px` : "16px",
    right: localPos.x ? "auto" : "16px",
    position: "absolute",
  };

  /* ---------- Render ---------- */
  return (
    <div className="inapp-wrapper">
      <div className="topbar">Online: {onlineCount} • Status: {status}</div>

      <div className="content">
        <div className="video-container" ref={remoteContainerRef}>
          <video ref={remoteVideoRef} className="remote-video" autoPlay playsInline />
          {!partnerId && <div className="waiting-overlay">Waiting for user...</div>}
          {partnerInfo && <div className="overlay green-glow">{partnerInfo.name} ({partnerInfo.gender})</div>}

          <video ref={localVideoRef} className="local-video-floating green-glow" autoPlay muted playsInline onPointerDown={onLocalPointerDown} style={previewStyle} />

          {/* Reload button */}
          <button className="preview-reload" onClick={reloadLocalStream}
            style={{
              left: localPos.x !== null ? `${localPos.x + localSize.w - 20}px` : undefined,
              top: localPos.y !== null ? `${localPos.y - 10}px` : undefined,
              right: localPos.x === null ? "18px" : undefined,
              position: "absolute",
            }}
            title="Reload camera"
          >
            ↻
          </button>

          <div className="controls centered">
            <button className={`control ${micOn ? "active" : "inactive"}`} onClick={toggleMic}><MicIcon active={micOn} /><div className="label">Mute</div></button>
            <button className={`control ${camOn ? "active" : "inactive"}`} onClick={toggleCam}><CameraIcon active={camOn} /><div className="label">Camera</div></button>
            <button className="control next"><NextIcon /><div className="label">Next</div></button>
            <button className="control stop"><StopIcon /><div className="label">Stop</div></button>
            {partnerId && !isBlocked && (
              <button className="report-btn" onClick={() => setShowReportModal(true)} title="Report User">
                <div style={{ fontSize: "22px" }}>⚠️</div><div className="label">Report</div>
              </button>
            )}
          </div>
        </div>

        <div className="chat-card">
          <div className="chat-window" ref={chatWindowRef}>
            {messages.map((m, i) => (
              <div key={i} className={`chat-bubble ${m.mine ? "mine" : "theirs"}`}>
                <strong style={{ display: m.mine ? "none" : "inline" }}>{m.from}: </strong>
                {m.message}
              </div>
            ))}
            {typingIndicator && <TypingBubble />}
          </div>
          <div className="chat-input modern">
            <input value={input} onChange={handleTyping} placeholder="Type your message" onKeyDown={(e) => { if (e.key === "Enter") sendChat(); }} />
            <button onClick={sendChat}>Send</button>
          </div>
        </div>
      </div>

      {/* Report Modal */}
      {showReportModal && (
        <div className="report-overlay">
          <div className="report-box">
            <h3>Report User</h3>
            <p>Select a reason:</p>
            <ul>
              {["Nudity", "Harassment", "Spam", "Other"].map((reason) => (
                <li key={reason}>
                  <label>
                    <input type="radio" name="reportReason" value={reason} onChange={(e) => setReportReason(e.target.value)} />
                    {reason}
                  </label>
                </li>
              ))}
            </ul>
            <div className="report-actions">
              <button onClick={() => setShowReportModal(false)}>Cancel</button>
              <button
                onClick={() => {
                  if (!reportReason) return alert("Please select a reason");
                  socket.emit("report", { partnerId, reason: reportReason });
                  socket.emit("leave");
                  cleanupCall(true);
                  setBlockedUsers((prev) => [...prev, partnerId]);
                  socket.emit("join", { name, gender, blocked: blockedUsers });
                  setStatus("searching");
                  setShowReportModal(false);
                }}
              >
                Submit Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Blocked Overlay */}
      {isBlocked && (
        <div className="blocked-overlay">
          <div className="blocked-box">
            <h2>🚫 You have been reported</h2>
            <p>Avoid Nudity, Harassment, Spam, or Other violations.</p>
            <p>Please wait <strong>{blockCountdown}</strong> seconds before reconnecting.</p>
            <div className="or-divider">— OR —</div>
            <button className="blog-btn" onClick={() => { setIsBlocked(false); setBlockCountdown(60); if (countdownInterval.current) clearInterval(countdownInterval.current); window.location.href = "/blog"; }}>
              Click here to read blogs
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
