import React from "react";

export default function Home() {
  return (
    <div className="center-card">
      <div className="landing-header">
        <img src="/banner.png" alt="Banner" className="landing-banner" />
        <div className="landing-title">
          <h1>Omegle Clone</h1>
          <div className="sub">Meet strangers, make friends, stay safe.</div>
        </div>
      </div>

      <div className="info-section">
        <h2>Welcome to Omegle Clone</h2>
        <p>
          Connect instantly with strangers across the world using text and video chat.  
          We focus on safe, respectful interactions.  
        </p>
        <h3>Features</h3>
        <ul>
          <li>🎥 Video chat with strangers</li>
          <li>💬 Live chat messaging</li>
          <li>⚠️ Report system for safety</li>
          <li>📖 Blogs on respect & safety</li>
        </ul>
      </div>
    </div>
  );
}
