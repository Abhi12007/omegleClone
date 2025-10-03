// client/src/OnboardingModal.js
import React from "react";

function OnboardingModal({ onContinue }) {
  return (
    <div
      style={{
        position: "fixed",
        top: 0, left: 0,
        width: "100%", height: "100%",
        backgroundColor: "rgba(0,0,0,0.75)", // semi-dark overlay
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000
      }}
    >
      <div
        style={{
          background: "#fff",
          color: "#000",
          padding: "24px 30px",
          borderRadius: "12px",
          maxWidth: "500px",
          textAlign: "left",
          boxShadow: "0 0 20px rgba(0,0,0,0.3)",
          fontFamily: "system-ui, sans-serif"
        }}
      >
        <h2 style={{ fontSize: "22px", marginBottom: "16px", textAlign: "center" }}>
          ⚠️ Attention
        </h2>

        <p style={{ marginBottom: "16px" }}>
          Welcome! Please read carefully before starting:
        </p>

        <ul style={{ listStyle: "none", padding: 0, lineHeight: "1.7" }}>
          <li>🎤 <strong>Mic Button:</strong> Mute or unmute your microphone.</li>
          <li>📷 <strong>Camera Button:</strong> Turn your camera on/off.</li>
          <li>🟥<strong>Stop Button:</strong> End the current call.</li>
          <li>⏭️ <strong>Next Button:</strong> Skip and connect to another user.</li>
          <li> ↻ <strong>Preview Video:</strong> The small preview video is draggable and can be reloaded by clicking the reload button on its top-right corner.</li>
          <li style={{ color: "red", marginTop: "12px" }}>
            🔒 <strong>Warning:</strong> Any vulgar or offensive activity will result in a permanent ban.
          </li>
        </ul>

        <div style={{ textAlign: "center", marginTop: "20px" }}>
          <button
            onClick={onContinue}
            style={{
              padding: "12px 28px",
              background: "#007bff",
              color: "white",
              border: "none",
              borderRadius: "8px",
              fontSize: "16px",
              fontWeight: "bold",
              cursor: "pointer"
            }}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}

export default OnboardingModal;
