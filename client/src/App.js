// client/src/App.js
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, useLocation } from "react-router-dom";
import React, { useState, useEffect } from "react";
import io from "socket.io-client";

import About from "./About";
import Blog from "./Blog";
import Contact from "./Contact";
import "./App.css";
import VideoPage from "./VideoPage";

const socket = io(); // assumes same origin

/* ---------- NavBar Component ---------- */
function NavBar({ joined }) {
  const navigate = useNavigate();
  const location = useLocation();

  const showBack = location.pathname !== "/" && !joined;

  return (
    <header className="landing-header-nav">
      <nav style={{ display: "flex", alignItems: "center", gap: "14px" }}>
        {showBack && (
          <button
            onClick={() => navigate(-1)}
            style={{
              background: "transparent",
              border: "none",
              color: "white",
              fontSize: "30px",
              cursor: "pointer",
            }}
            title="Go Back"
          >
            ⬅
          </button>
        )}
        {!joined ? (
          <>
            <Link to="/about">About Us</Link>
            <Link to="/contact">Contact Us</Link>
            <Link to="/blog">Blog</Link>
          </>
        ) : (
          <>
            <Link to="/">Home</Link>
            <Link to="/about">About Us</Link>
            <Link to="/contact">Contact Us</Link>
            <Link to="/blog">Blog</Link>
          </>
        )}
      </nav>
    </header>
  );
}

/* ---------- App ---------- */
export default function App() {
  // Landing page state only
  const [name, setName] = useState("");
  const [gender, setGender] = useState("male");
  const [joined, setJoined] = useState(false);
  const [onlineCount, setOnlineCount] = useState(0);

  useEffect(() => {
    socket.on("online-count", (c) => setOnlineCount(c));
    socket.on("online-users", (c) => setOnlineCount(c));
    return () => socket.removeAllListeners();
  }, []);

  return (
    <Router>
      {/* ✅ Global Nav Bar */}
      <NavBar joined={joined} />

      <Routes>
        <Route path="/about" element={<About />} />
        <Route path="/blog" element={<Blog />} />
        <Route path="/contact" element={<Contact />} />

        {/* ✅ Video Calling Page */}
        <Route path="/video" element={<VideoPage name={name} gender={gender} />} />

        {/* ✅ Landing Page */}
        <Route
          path="/*"
          element={
            <div className="page">
              <div className="center-card">
                <div className="landing-header">
                  <img src="/banner.png" alt="Banner" className="landing-banner" />
                  <div className="landing-title">
                    <h1>Wakiee</h1>
                    <div className="sub">Online: {onlineCount}</div>
                  </div>
                </div>

                {/* User input */}
                <input
                  className="input"
                  placeholder="Enter your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />

                {/* Gender selection */}
                <div className="gender-vertical">
                  <div
                    className={`gender-option-vertical ${gender === "male" ? "active" : ""}`}
                    onClick={() => setGender("male")}
                  >
                    ♂️ Male
                  </div>
                  <div
                    className={`gender-option-vertical ${gender === "female" ? "active" : ""}`}
                    onClick={() => setGender("female")}
                  >
                    ♀️ Female
                  </div>
                  <div
                    className={`gender-option-vertical ${gender === "other" ? "active" : ""}`}
                    onClick={() => setGender("other")}
                  >
                    ⚧️ Other
                  </div>
                </div>

                {/* Connect button */}
                <ConnectButton />

                {/* Warning box */}
                <div
                  className="warning-box"
                  style={{
                    marginTop: "20px",
                    padding: "12px",
                    backgroundColor: "#ffe6e6",
                    border: "1px solid #ff4d4d",
                    borderRadius: "6px",
                    color: "#cc0000",
                    fontWeight: "bold",
                    textAlign: "center",
                    maxWidth: "600px",
                    marginLeft: "auto",
                    marginRight: "auto",
                  }}
                >
                  ⚠️ Important: Wakiee is a safe space for everyone. Any form of nudity, harassment,
                  or abusive behaviour is strictly prohibited and will result in a permanent ban without warning.
                </div>

                {/* Info sections */}
                <div className="info-section">
                  <section id="features" style={{ padding: "40px", textAlign: "center" }}>
                    <h2>🌟 Features of Wakiee</h2>
                    <ul style={{ listStyle: "none", padding: 0 }}>
                      <li>🔒 <strong>Moderated Calls & Chats</strong> – Safe and respectful with reporting tools.</li>
                      <li>🌍 <strong>Global Community</strong> – Meet people from all around the world.</li>
                      <li>⚡ <strong>Instant & Anonymous Connection</strong> – No sign-ups, just start talking.</li>
                      <li>🛡️ <strong>Report & Block</strong> – Stay in control of who you talk to.</li>
                      <li>🎓 <strong>Learn & Share</strong> – Practice languages or share new ideas.</li>
                      <li>🤝 <strong>Perfect for Introverts</strong> – A safe space to overcome shyness.</li>
                      <li>📱 <strong>Simple & Fast</strong> – Lightweight and mobile-friendly.</li>
                    </ul>
                  </section>

                  <section id="talk" style={{ padding: "40px", textAlign: "center" }}>
                    <h2>🗨️ Talk To Stranger</h2>
                    <p>
                      Welcome to <strong>Wakiee</strong>, the best alternative to Omegle for meeting new people online.  
                      Our idea is simple: <strong>connect the world and help people make friends without barriers.</strong>
                    </p>
                    <ul style={{ listStyle: "none", padding: 0 }}>
                      <li>👉 No registration required</li>
                      <li>👉 No profiles or sign-ups</li>
                      <li>👉 Just click and start talking instantly</li>
                      <li>👉 Learn a new language, discover cultures, or just make new friends</li>
                      <li>👉 A safe space for introverts to overcome shyness</li>
                    </ul>
                  </section>

                  <section id="guidelines" style={{ padding: "40px", textAlign: "center" }}>
                    <h3>📜 Communication Guidelines</h3>
                    <ul style={{ listStyle: "none", padding: 0 }}>
                      <li>✅ You must be 18+ to use Wakiee</li>
                      <li>🚫 Do not share personal info (phone, address, etc.)</li>
                      <li>🤝 Respect others — no bullying or hate speech</li>
                      <li>⚠️ Report inappropriate behaviour immediately</li>
                      <li>🛡️ Stay anonymous — that’s the fun of talking to strangers</li>
                      <li>💬 Be kind and open-minded — every conversation is unique</li>
                    </ul>
                  </section>
                </div>

                {/* Footer */}
                <footer className="landing-footer">
                  <div className="footer-left">
                    Follow us on
                    <a href="#" target="_blank" rel="noopener noreferrer" className="insta-icon" style={{ marginLeft: "8px" }}>
                      📸 Instagram
                    </a>
                  </div>

                  <div className="footer-center">© 2025 Wakiee - All rights reserved.</div>

                  <div className="footer-right">
                    <a href="#">Terms of Service</a>
                    <a href="#">Privacy Policy</a>
                    <a href="/about">About Us</a>
                    <a href="/contact">Contact Us</a>
                  </div>
                </footer>
              </div>
            </div>
          }
        />
      </Routes>
    </Router>
  );
}

/* ---------- Connect Button ---------- */
function ConnectButton() {
  const navigate = useNavigate();
  return (
    <button className="primary glow-button" onClick={() => navigate("/video")}>
      Connect to a stranger
    </button>
  );
}
