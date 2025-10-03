// client/src/Terms.js
import React from "react";

export default function Terms() {
  return (
    <div style={{ padding: "40px", color: "white", maxWidth: "800px", margin: "auto" }}>
      <h1>Terms of Service</h1>
      <p><strong>Last updated:</strong> {new Date().getFullYear()}</p>

      <h2>Acceptance of Terms</h2>
      <p>By using Wakiee, you agree to these terms. If you do not agree, please stop using our platform.</p>

      <h2>Eligibility</h2>
      <p>You must be at least 18 years old (or legal age in your country) to use Wakiee.</p>

      <h2>Prohibited Behavior</h2>
      <ul>
        <li>No nudity, vulgarity, or sexual content.</li>
        <li>No harassment, bullying, or hate speech.</li>
        <li>No spamming, ads, or illegal activity.</li>
        <li>No sharing of personal data like phone numbers, addresses, or bank info.</li>
      </ul>

      <h2>Enforcement</h2>
      <p>Violations may result in immediate bans without warning.</p>

      <h2>Disclaimer</h2>
      <p>Wakiee is not responsible for user behavior. Please use the report feature to help us keep the community safe.</p>
    </div>
  );
}
