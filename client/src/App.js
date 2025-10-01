import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";

const socket = io();

function App() {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const [localStream, setLocalStream] = useState(null);
  const [pc, setPc] = useState(null);

  const [name, setName] = useState("");
  const [gender, setGender] = useState("");
  const [joined, setJoined] = useState(false);

  const [partnerInfo, setPartnerInfo] = useState(null);
  const [partnerId, setPartnerId] = useState(null);

  const [messages, setMessages] = useState([]);
  const [chatMessage, setChatMessage] = useState("");

  const [connected, setConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(0);

  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);

  // Join room with name/gender
  const handleJoin = async () => {
    if (!name || !gender) {
      alert("Please enter name and gender.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      socket.emit("join", { name, gender });
      setJoined(true);
    } catch (err) {
      console.error("Media access error:", err);
      alert("Could not access camera/microphone.");
    }
  };

  useEffect(() => {
    socket.on("connect", () => {
      setConnected(true);
    });
    socket.on("disconnect", () => {
      setConnected(false);
    });
    socket.on("online-users", (count) => {
      setOnlineUsers(count);
    });

    socket.on("paired", ({ partnerId, partnerInfo, initiator }) => {
      setPartnerId(partnerId);
      setPartnerInfo(partnerInfo);
      createPeerConnection(partnerId, initiator);
    });

    socket.on("offer", async ({ from, sdp }) => {
      if (pc) return;
      createPeerConnection(from, false, sdp);
    });

    socket.on("answer", async ({ sdp }) => {
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      }
    });

    socket.on("ice-candidate", async ({ candidate }) => {
      try {
        if (pc && candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } catch (e) {
        console.error("Error adding received ICE candidate", e);
      }
    });

    socket.on("chat-message", ({ fromName, message }) => {
      setMessages((prev) => [...prev, { from: fromName, text: message }]);
    });

    socket.on("partner-left", () => {
      cleanupConnection();
      setPartnerId(null);
      setPartnerInfo(null);
    });

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("paired");
      socket.off("offer");
      socket.off("answer");
      socket.off("ice-candidate");
      socket.off("chat-message");
      socket.off("partner-left");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createPeerConnection = async (partnerId, initiator, remoteOffer) => {
    const newPc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        {
          urls: "turn:relay1.expressturn.com:3480",
          username: "000000002074682235",
          credential: "tN/jre4jo0Rpoi0z5MXgby3QAqo=",
        },
      ],
    });

    newPc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("ice-candidate", { to: partnerId, candidate: event.candidate });
      }
    };

    newPc.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
        remoteVideoRef.current.play().catch(() => {});
      }
    };

    if (localStream) {
      localStream.getTracks().forEach((track) => newPc.addTrack(track, localStream));
    }

    if (initiator) {
      const offer = await newPc.createOffer();
      await newPc.setLocalDescription(offer);
      socket.emit("offer", { to: partnerId, sdp: offer });
    } else if (remoteOffer) {
      await newPc.setRemoteDescription(new RTCSessionDescription(remoteOffer));
      const answer = await newPc.createAnswer();
      await newPc.setLocalDescription(answer);
      socket.emit("answer", { to: partnerId, sdp: answer });
    }

    setPc(newPc);
  };

  const cleanupConnection = () => {
    if (pc) {
      pc.close();
      setPc(null);
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
  };

  const handleSendMessage = () => {
    if (chatMessage.trim() && partnerId) {
      socket.emit("chat-message", { to: partnerId, message: chatMessage });
      setMessages((prev) => [...prev, { from: "Me", text: chatMessage }]);
      setChatMessage("");
    }
  };

  const handleStop = () => {
    cleanupConnection();
    setPartnerId(null);
    setPartnerInfo(null);
    socket.emit("leave");
    setMessages([]);
  };

  const toggleMic = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setMicOn((prev) => !prev);
    }
  };

  const toggleCam = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setCamOn((prev) => !prev);
    }
  };

  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ position: "absolute", top: 10, right: 10 }}>
        Online users: {onlineUsers}
      </div>
      {!joined ? (
        <div style={{ marginTop: "20%" }}>
          <h1>Welcome to Omegle Clone 🚀</h1>
          <input
            placeholder="Enter your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ padding: "8px", margin: "5px" }}
          />
          <select
            value={gender}
            onChange={(e) => setGender(e.target.value)}
            style={{ padding: "8px", margin: "5px" }}
          >
            <option value="">Select Gender</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
          <br />
          <button onClick={handleJoin} style={{ padding: "10px 20px", marginTop: "10px" }}>
            Connect to a stranger
          </button>
        </div>
      ) : (
        <div>
          <div style={{ display: "flex", justifyContent: "center", marginTop: "20px" }}>
            {/* Remote video - Bigger */}
            <div style={{ margin: "10px", position: "relative" }}>
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                style={{ width: "600px", height: "400px", backgroundColor: "black" }}
              />
              {!partnerInfo && (
                <div
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    color: "white",
                  }}
                >
                  Waiting for user...
                </div>
              )}
              {partnerInfo && (
                <div
                  style={{
                    position: "absolute",
                    top: "5px",
                    left: "5px",
                    background: "rgba(0,0,0,0.5)",
                    color: "white",
                    padding: "2px 5px",
                    borderRadius: "5px",
                  }}
                >
                  {partnerInfo.name} ({partnerInfo.gender})
                </div>
              )}
            </div>

            {/* Local video - Smaller, corner */}
            <div style={{ margin: "10px", position: "relative" }}>
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                style={{
                  width: "200px",
                  height: "150px",
                  backgroundColor: "black",
                  border: "2px solid white",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  top: "5px",
                  left: "5px",
                  background: "rgba(0,0,0,0.5)",
                  color: "white",
                  padding: "2px 5px",
                  borderRadius: "5px",
                }}
              >
                {name} ({gender})
              </div>
            </div>
          </div>

          <div style={{ marginTop: "20px" }}>
            <button onClick={toggleMic} style={{ padding: "8px 20px", marginRight: "10px" }}>
              {micOn ? "Mute" : "Unmute"}
            </button>
            <button onClick={toggleCam} style={{ padding: "8px 20px", marginRight: "10px" }}>
              {camOn ? "Camera Off" : "Camera On"}
            </button>
            <button onClick={handleStop} style={{ padding: "8px 20px" }}>
              Stop
            </button>
          </div>

          <div style={{ marginTop: "20px", maxWidth: "600px", margin: "auto" }}>
            <div
              style={{
                border: "1px solid gray",
                height: "150px",
                overflowY: "scroll",
                padding: "5px",
                textAlign: "left",
              }}
            >
              {messages.map((msg, i) => (
                <div key={i}>
                  <b>{msg.from}:</b> {msg.text}
                </div>
              ))}
            </div>
            <div style={{ marginTop: "10px" }}>
              <input
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                style={{ padding: "5px", width: "70%" }}
                placeholder="Type a message"
              />
              <button onClick={handleSendMessage} style={{ padding: "5px 10px", marginLeft: "5px" }}>
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
