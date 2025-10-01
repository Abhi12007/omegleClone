import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";

const socket = io();

export default function App() {
  // refs
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);

  // user / UI state
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

  useEffect(() => {
    // online count (listen for both possible server event names)
    socket.on("online-count", (c) => setOnlineCount(c));
    socket.on("online-users", (c) => setOnlineCount(c));

    socket.on("waiting", () => {
      setStatus("waiting");
    });

    socket.on("paired", ({ partnerId, initiator, partnerInfo }) => {
      setPartnerId(partnerId);
      setPartnerInfo(partnerInfo || { name: "Stranger", gender: "other" });
      setStatus("paired");
      // ensure local stream exists, then setup pc
      startLocalStream().then(() => {
        createPeerConnection(partnerId, initiator);
      }).catch(()=>{});
    });

    socket.on("offer", async ({ from, sdp }) => {
      // non-initiator will receive offer
      if (!pcRef.current) {
        await startLocalStream();
        await createPeerConnection(from, false, sdp);
      } else {
        // if pc exists, directly set remote
        try {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(sdp));
        } catch (e) {/* ignore */}
      }
    });

    socket.on("answer", async ({ from, sdp }) => {
      try {
        if (pcRef.current) {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(sdp));
          setStatus("in-call");
        }
      } catch (e) {
        console.error("answer handling error", e);
      }
    });

    socket.on("ice-candidate", async ({ from, candidate }) => {
      try {
        if (candidate && pcRef.current) {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } catch (e) {
        console.warn("addIceCandidate error", e);
      }
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
  }, []);

  // start local camera + mic
  async function startLocalStream() {
    if (localStreamRef.current) return localStreamRef.current;
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = s;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = s;
        localVideoRef.current.play().catch(() => {});
      }
      // respect current mic/cam toggles
      applyTrackToggles(s);
      return s;
    } catch (err) {
      console.error("getUserMedia error", err);
      throw err;
    }
  }

  function applyTrackToggles(stream) {
    if (!stream) return;
    stream.getAudioTracks().forEach((t) => (t.enabled = micOn));
    stream.getVideoTracks().forEach((t) => (t.enabled = camOn));
  }

  // Create RTCPeerConnection and handle signaling
  async function createPeerConnection(partnerSocketId, initiator = false, remoteOffer = null) {
    if (pcRef.current) {
      // if an existing pc exists, close first
      try { pcRef.current.close(); } catch (e) {}
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

    // when remote track arrives
    pc.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
        remoteVideoRef.current.play().catch(() => {});
      }
      setStatus("in-call");
    };

    // ICE candidates -> send to partner
    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        socket.emit("ice-candidate", { to: partnerSocketId, candidate: ev.candidate });
      }
    };

    // add local tracks (if already obtained)
    const localStream = localStreamRef.current;
    if (localStream) {
      localStream.getTracks().forEach((track) => {
        try {
          pc.addTrack(track, localStream);
        } catch (e) { /* ignore addTrack errors */ }
      });
    }

    // initiator creates offer
    if (initiator) {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("offer", { to: partnerSocketId, sdp: pc.localDescription });
      } catch (e) {
        console.error("createOffer error", e);
      }
    } else if (remoteOffer) {
      // non-initiator with offer already provided
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(remoteOffer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("answer", { to: partnerSocketId, sdp: pc.localDescription });
      } catch (e) {
        console.error("handle remote offer error", e);
      }
    }
  }

  // cleanup tracks and pc
  function cleanupCall() {
    if (pcRef.current) {
      try { pcRef.current.close(); } catch (e) {}
      pcRef.current = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    // stop local tracks but keep local stream for re-join? We'll stop when leaving fully
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    setMessages([]);
  }

  // Join button handler (landing -> join queue)
  async function handleJoin() {
    if (!name || !gender) {
      alert("Enter name and choose a gender.");
      return;
    }
    try {
      await startLocalStream();
      socket.emit("join", { name, gender });
      setJoined(true);
      setStatus("joining");
    } catch (e) {
      // user denied; do nothing
    }
  }

  // Leave current partner and immediately rejoin queue
  function leaveAndNext() {
    if (partnerId) socket.emit("leave");
    // clean and re-join
    cleanupCall();
    socket.emit("join", { name, gender });
    setStatus("waiting");
    setPartnerId(null);
    setPartnerInfo(null);
  }

  // Stop completely and return to landing page
  function stopAndLeave() {
    if (partnerId) socket.emit("leave");
    cleanupCall();
    setJoined(false);
    setPartnerId(null);
    setPartnerInfo(null);
    setStatus("init");
    setMessages([]);
    socket.emit("leave");
  }

  // Chat send
  function sendChat() {
    if (!input.trim()) return;
    if (partnerId) {
      socket.emit("chat-message", { to: partnerId, message: input });
      setMessages((prev) => [...prev, { from: "Me", message: input }]);
      setInput("");
    } else {
      alert("Not connected to a stranger yet.");
    }
  }

  // toggle mic/cam
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

  // UI rendering
  if (!joined) {
    return (
      <div style={{ textAlign: "center", paddingTop: 60 }}>
        <h1>Omegle Clone 🚀</h1>
        <div>Online: {onlineCount}</div>
        <div style={{ marginTop: 20 }}>
          <input
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ padding: 8, marginRight: 8 }}
          />
          <select value={gender} onChange={(e) => setGender(e.target.value)} style={{ padding: 8 }}>
            <option value="">Select gender</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div style={{ marginTop: 20 }}>
          <button onClick={handleJoin} style={{ padding: "10px 20px" }}>
            Connect to a stranger
          </button>
        </div>
      </div>
    );
  }

  // joined view (call screen)
  return (
    <div style={{ textAlign: "center", padding: 12 }}>
      <div style={{ position: "absolute", top: 8, right: 12 }}>Online: {onlineCount}</div>

      <div style={{ display: "flex", justifyContent: "center", gap: 24, marginTop: 28 }}>
        {/* remote bigger */}
        <div style={{ position: "relative" }}>
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            style={{ width: 640, height: 480, backgroundColor: "black" }}
          />
          {!partnerId && (
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                color: "white",
                fontSize: 18,
              }}
            >
              Waiting for user...
            </div>
          )}
          {partnerInfo && (
            <div
              style={{
                position: "absolute",
                top: 8,
                left: 8,
                background: "rgba(0,0,0,0.6)",
                color: "#fff",
                padding: "4px 8px",
                borderRadius: 4,
              }}
            >
              {partnerInfo.name} ({partnerInfo.gender})
            </div>
          )}

          {/* Buttons under remote video */}
          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 8 }}>
            <button onClick={toggleMic} style={{ padding: "8px 12px" }}>
              {micOn ? "Mute" : "Unmute"}
            </button>
            <button onClick={toggleCam} style={{ padding: "8px 12px" }}>
              {camOn ? "Camera Off" : "Camera On"}
            </button>
            <button
              onClick={() => {
                leaveAndNext();
              }}
              style={{ padding: "8px 12px" }}
            >
              Next Stranger
            </button>
            <button
              onClick={() => {
                stopAndLeave();
              }}
              style={{ padding: "8px 12px" }}
            >
              Stop
            </button>
          </div>
        </div>

        {/* local small / PiP */}
        <div style={{ position: "relative", width: 220 }}>
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            style={{ width: 220, height: 165, backgroundColor: "black", border: "2px solid #fff" }}
          />
          <div
            style={{
              position: "absolute",
              top: 6,
              left: 6,
              background: "rgba(0,0,0,0.6)",
              color: "#fff",
              padding: "4px 6px",
              borderRadius: 4,
            }}
          >
            {name} ({gender})
          </div>

          {/* CHAT just below local camera */}
          <div style={{ marginTop: 12 }}>
            <div
              style={{
                width: 220,
                height: 200,
                border: "1px solid #ccc",
                overflowY: "auto",
                textAlign: "left",
                padding: 6,
                background: "#fafafa",
              }}
            >
              {messages.map((m, i) => (
                <div key={i} style={{ marginBottom: 6 }}>
                  <b>{m.from}:</b> {m.message || m.text}
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                style={{ flex: 1, padding: 6 }}
                placeholder="Type a message..."
              />
              <button onClick={sendChat} style={{ padding: "6px 10px" }}>
                Send
              </button>
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <small>Status: {status}</small>
      </div>
    </div>
  );

  // helper for Send button bound in JSX
  function sendChat() {
    if (!input.trim()) return;
    if (partnerId) {
      socket.emit("chat-message", { to: partnerId, message: input });
      setMessages((prev) => [...prev, { from: "Me", message: input }]);
      setInput("");
    } else {
      alert("Not connected to a partner yet.");
    }
  }
}
