// client/src/About.js
import React from "react";

export default function About() {
  return (
    <div style={{ padding: "40px", color: "white", textAlign: "center" }}>
      {/* Banner */}
      <img
        src="/banner.png"
        alt="Wakiee Banner"
        style={{ maxWidth: "320px", margin: "0 auto 30px", display: "block" }}
      />

      {/* Introduction */}
      <h1>About Wakiee</h1>
      <p style={{ maxWidth: "700px", margin: "20px auto", lineHeight: "1.7", fontSize: "18px" }}>
        Have you ever been excited to talk to a foreigner, learn about their culture, or practice a new language?  
        <strong> Wakiee</strong> makes it possible.
      </p>
      <p style={{ maxWidth: "700px", margin: "0 auto 40px", lineHeight: "1.7" }}>
        Our aim is to connect people from around the world for:
      </p>
      <ul style={{ listStyle: "none", padding: 0, maxWidth: "600px", margin: "0 auto 40px", textAlign: "left", lineHeight: "1.8" }}>
        <li>🌍 Learning different languages</li>
        <li>🤝 Knowing each other’s culture</li>
        <li>😊 Overcoming shyness</li>
        <li>🎭 Recreation and sharing thoughts</li>
        <li>👨‍👩‍👧‍👦 Making new online friends</li>
      </ul>

      {/* Why Choose Wakiee */}
      <h2>Why Choose Wakiee?</h2>
      <p style={{ maxWidth: "700px", margin: "20px auto", lineHeight: "1.7" }}>
        We built Wakiee with simplicity and safety at its core. Here’s what makes us different:
      </p>
      <ul style={{ listStyle: "none", padding: 0, maxWidth: "600px", margin: "0 auto 40px", textAlign: "left", lineHeight: "1.8" }}>
        <li>✅ <strong>No registration or profiles</strong> – connect instantly</li>
        <li>✅ <strong>Privacy first</strong> – we don’t keep your personal data</li>
        <li>✅ <strong>Global community</strong> – meet people from anywhere</li>
        <li>✅ <strong>Moderated calls & chats</strong> – safe and respectful space</li>
        <li>✅ <strong>User-friendly</strong> – works smoothly on both PC & mobile</li>
        <li>✅ <strong>Superfast connections</strong> – no waiting, just start talking</li>
      </ul>

      {/* Core Values */}
      <h2>Our Core Values</h2>
      <ul style={{ listStyle: "none", padding: 0, maxWidth: "600px", margin: "0 auto 40px", textAlign: "left", lineHeight: "1.8" }}>
        <li>💙 Respect & kindness for everyone</li>
        <li>🔒 Privacy & anonymity guaranteed</li>
        <li>🛡️ Safety first – protecting our users</li>
        <li>🌎 Equality – everyone is welcome</li>
      </ul>

      {/* Safety Commitment */}
      <h2>Commitment to Safety</h2>
      <p style={{ maxWidth: "700px", margin: "20px auto", lineHeight: "1.7" }}>
        Wakiee is designed to be a <strong>positive and safe space</strong> for everyone.  
        We have built-in tools to make sure your experience stays enjoyable:
      </p>
      <ul style={{ listStyle: "none", padding: 0, maxWidth: "600px", margin: "0 auto 40px", textAlign: "left", lineHeight: "1.8" }}>
        <li>⚠️ Easy-to-use <strong>reporting system</strong> – flag any inappropriate behavior instantly</li>
        <li>🚫 <strong>Zero tolerance</strong> for nudity, harassment, or abusive behavior</li>
        <li>⛔ Violators are <strong>instantly banned</strong> to keep our community safe</li>
      </ul>

      <p style={{ maxWidth: "700px", margin: "30px auto", fontWeight: "bold", lineHeight: "1.7" }}>
        At Wakiee, we believe conversations can build bridges across the world.  
        Join us, stay kind, and be part of a safe and welcoming global community. 🌟
      </p>
    </div>
  );
}
