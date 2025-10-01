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
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" aria-hidden>
      <g stroke="#1e3a8a" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M5 19V5l14 7-14 7z" />
      </g>
      <filter id="glow">
        <feDropShadow dx="0" dy="0" stdDeviation="2" floodColor="#1e3a8a" floodOpacity="1" />
      </filter>
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

/* ✅ FIXED Reload Icon */
function ReloadIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="#ffffff" strokeWidth="2.5" />
      <path d="M12 5v4l3-2" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ---------- App ---------- */
export default function App() {
  // ... [UNCHANGED: WebRTC, socket, chat, state, drag logic, cleanup, etc.]

  /* ---------- Render ---------- */
  return (
    <Router>
      <Routes>
        <Route path="/about" element={<About />} />
        <Route path="/blog" element={<Blog />} />
        <Route path="/contact" element={<Contact />} />
        <Route
          path="/*"
          element={
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
                  {/* ✅ Banner left, Text right */}
                  <div className="landing-header" style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                    <img src="/banner.png" alt="Banner" className="landing-banner" style={{ maxWidth: "120px" }} />
                    <div className="landing-title">
                      <h1>Omegle</h1>
                      <div className="sub">Online: {onlineCount}</div>
                    </div>
                  </div>

                  {/* ✅ White name input */}
                  <input
                    className="input"
                    placeholder="Enter your name"
                    style={{ color: "white" }}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />

                  <div className="gender-vertical">
                    <div className={`gender-option-vertical ${gender === "male" ? "active" : ""}`} onClick={() => setGender("male")}>
                      ♂️ Male
                    </div>
                    <div className={`gender-option-vertical ${gender === "female" ? "active" : ""}`} onClick={() => setGender("female")}>
                      ♀️ Female
                    </div>
                    <div className={`gender-option-vertical ${gender === "other" ? "active" : ""}`} onClick={() => setGender("other")}>
                      ⚧️ Other
                    </div>
                  </div>

                  <button
                    className="primary"
                    onClick={async () => {
                      await startLocalStream(true);
                      socket.emit("join", { name, gender });
                      setJoined(true);
                      setStatus("searching");
                    }}
                  >
                    Connect to a stranger
                  </button>

                  {/* Info section + Footer unchanged */}
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
                  <div className="topbar">
                    Online: {onlineCount} • Status: {status}
                  </div>

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

                      {/* ✅ Reload inside preview */}
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

                        {/* ✅ Bright glowing Next */}
                        <button className="control next glowing" onClick={handleNext} title="Next">
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
                            <strong style={{ display: m.mine ? "none" : "inline" }}>{m.from}: </strong>
                            {m.message}
                          </div>
                        ))}

                        {typingIndicator && <TypingBubble />}
                      </div>

                      {/* ✅ Removed plus sign */}
                      <div className="chat-input modern">
                        <input
                          value={input}
                          onChange={handleTyping}
                          placeholder="Type your message"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") sendChat();
                          }}
                        />
                        <button onClick={sendChat}>Send</button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          }
        />
      </Routes>
    </Router>
  );
}
