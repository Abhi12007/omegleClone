// client/src/OnboardingModal.js
import React from "react";

function OnboardingModal({ onContinue }) {
  return (
    <div style={{
      position: "fixed",
      top: 0, left: 0,
      width: "100%", height: "100%",
      backgroundColor: "rgba(0,0,0,0.85)", // darker overlay
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1000
    }}>
      <div style={{
        background: "#1c1c1c", // dark background box
        color: "#f1f1f1",      // light text
        padding: "30px",
        borderRadius: "12px",
        maxWidth: "600px",
        textAlign: "center",
        boxShadow: "0 0 25px rgba(0,0,0,0.5)"
      }}>
        <h2>👋 Welcome to Wakiee</h2>
        <p>
          Before you start your first video call, please remember:
        </p>
        <ul style={{ textAlign: "left", margin: "20px auto", maxWidth: "450px", lineHeight: "1.6" }}>
          <li>⚡ Instant, anonymous video chats</li>
          <li>🚫 No nudity, harassment, or abusive behaviour (permanent ban)</li>
          <li>🔒 Stay safe — never share personal info</li>
          <li>🤝 Respect others — keep the community positive</li>
        </ul>
        <button 
          onClick={onContinue} 
          style={{
            marginTop: "20px",
            padding: "12px 24px",
            background: "#007bff",
            color: "white",
            border: "none",
            borderRadius: "8px",
            fontSize: "16px",
            cursor: "pointer"
          }}
        >
          Continue
        </button>
      </div>
    </div>
  );
}

export default OnboardingModal;
