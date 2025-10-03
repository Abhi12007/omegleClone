import React from "react";

function OnboardingModal({ onContinue }) {
  return (
    <div style={{
      position: "fixed",
      top: 0, left: 0,
      width: "100%", height: "100%",
      backgroundColor: "rgba(0,0,0,0.7)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1000
    }}>
      <div style={{
        background: "white",
        padding: "30px",
        borderRadius: "12px",
        maxWidth: "600px",
        textAlign: "center",
        boxShadow: "0 0 15px rgba(0,0,0,0.3)"
      }}>
        <h2>👋 Welcome to Wakiee</h2>
        <p>
          Wakiee connects you with strangers around the world instantly.  
          Please read carefully before you start:
        </p>
        <ul style={{ textAlign: "left", margin: "20px auto", maxWidth: "450px" }}>
          <li>⚡ Instant, anonymous video chats</li>
          <li>🚫 No nudity, harassment, or abusive behaviour (permanent ban!)</li>
          <li>🔒 Stay safe — do not share personal info</li>
          <li>🤝 Respect everyone — keep the community positive</li>
        </ul>
        <button 
          onClick={onContinue} 
          style={{
            marginTop: "20px",
            padding: "10px 20px",
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
