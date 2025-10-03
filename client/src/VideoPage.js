import React, { useState, useEffect, useRef } from "react";
import OnboardingModal from "./OnboardingModal";
import io from "socket.io-client";

const socket = io(); // same origin

export default function VideoPage({ name, gender }) {
  // All video call state (status, partnerId, messages, mic/cam, etc.)
  const [status, setStatus] = useState("init");
  const [partnerId, setPartnerId] = useState(null);
  const [partnerInfo, setPartnerInfo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [typingIndicator, setTypingIndicator] = useState("");
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);

  // Refs
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);

  // Onboarding
  const [showOnboarding, setShowOnboarding] = useState(false);
  useEffect(() => {
    const hasSeen = localStorage.getItem("hasSeenInstructions");
    if (!hasSeen) setShowOnboarding(true);
    else joinQueue();
  }, []);

  const handleOnboardingContinue = () => {
    localStorage.setItem("hasSeenInstructions", "true");
    setShowOnboarding(false);
    joinQueue();
  };

  const joinQueue = async () => {
    await startLocalStream(true);
    socket.emit("join", { name, gender });
    setStatus("searching");
  };

  async function startLocalStream(forceEnable = false) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.muted = true;
        await localVideoRef.current.play().catch(() => {});
      }
    } catch (err) {
      console.error("getUserMedia failed", err);
    }
  }

  return (
    <div className="inapp-wrapper">
      {showOnboarding && <OnboardingModal onContinue={handleOnboardingContinue} />}
      <div className="topbar">Status: {status}</div>
      <div className="content">
        <div className="video-container">
          <video ref={remoteVideoRef} className="remote-video" autoPlay playsInline />
          <video ref={localVideoRef} className="local-video-floating" autoPlay muted playsInline />
        </div>
        {/* Chat + controls go here */}
      </div>
    </div>
  );
}
