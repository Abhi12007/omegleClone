// client/src/Privacy.js
import React from "react";

export default function Privacy() {
  return (
    <div style={{ padding: "40px", color: "white", maxWidth: "800px", margin: "auto" }}>
      <h1>Privacy Policy</h1>
      <p><strong>Last updated:</strong> {new Date().getFullYear()}</p>

      <p>
        At <strong>Wakiee</strong>, your privacy is very important to us.  
        We are committed to protecting your personal information and ensuring your online experience is safe.
      </p>

      <h2>Information We Collect</h2>
      <ul>
        <li>No registration or profile creation is required.</li>
        <li>We may collect non-personal technical data (browser type, device info, IP address).</li>
        <li>We never sell or share personally identifiable information.</li>
      </ul>

      <h2>How We Use Information</h2>
      <ul>
        <li>To connect you with other users for video calls and chats.</li>
        <li>To improve our platform’s performance and safety.</li>
        <li>To prevent abuse and inappropriate behavior.</li>
      </ul>

      <h2>Cookies</h2>
      <p>We may use cookies for functionality and advertising. You can disable cookies in your browser settings.</p>

      <h2>Third-Party Ads</h2>
      <p>
        We may use Google AdSense. These networks may use cookies to serve personalized ads.  
        Learn more at <a href="https://policies.google.com/technologies/ads" target="_blank" rel="noreferrer">Google Advertising Policies</a>.
      </p>

      <h2>Contact</h2>
      <p>For privacy questions, contact us at: {/* contact@wakiee.com */}</p>
    </div>
  );
}
