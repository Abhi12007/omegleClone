// client/src/Contact.js
import React, { useState } from "react";

export default function Contact() {
  const [formData, setFormData] = useState({ name: "", email: "", message: "" });
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // For now we just simulate submission
    setSubmitted(true);
    setFormData({ name: "", email: "", message: "" });
  };

  return (
    <div style={{ padding: "40px", color: "white", textAlign: "center" }}>
      <h1>Contact Us</h1>
      <p style={{ maxWidth: "700px", margin: "20px auto", lineHeight: "1.7" }}>
        We’d love to hear from you! Whether it’s feedback, questions, or partnership opportunities — feel free to reach out.  
        Your voice helps us make <strong>Wakiee</strong> better every day.
      </p>

      {submitted ? (
        <div style={{ marginTop: "20px", padding: "15px", backgroundColor: "#28a745", borderRadius: "8px" }}>
          ✅ Thank you for contacting us! We’ll get back to you soon.
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          style={{
            maxWidth: "600px",
            margin: "30px auto",
            textAlign: "left",
            background: "rgba(255, 255, 255, 0.1)",
            padding: "20px",
            borderRadius: "12px",
          }}
        >
          <label style={{ display: "block", marginBottom: "10px" }}>
            Your Name:
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              style={{
                width: "100%",
                padding: "10px",
                marginTop: "6px",
                borderRadius: "6px",
                border: "1px solid #ccc",
              }}
            />
          </label>

          <label style={{ display: "block", marginBottom: "10px" }}>
            Your Email:
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              style={{
                width: "100%",
                padding: "10px",
                marginTop: "6px",
                borderRadius: "6px",
                border: "1px solid #ccc",
              }}
            />
          </label>

          <label style={{ display: "block", marginBottom: "10px" }}>
            Your Message:
            <textarea
              name="message"
              value={formData.message}
              onChange={handleChange}
              required
              rows="5"
              style={{
                width: "100%",
                padding: "10px",
                marginTop: "6px",
                borderRadius: "6px",
                border: "1px solid #ccc",
              }}
            />
          </label>

          <button
            type="submit"
            style={{
              display: "block",
              width: "100%",
              padding: "12px",
              marginTop: "15px",
              background: "#007bff",
              color: "white",
              border: "none",
              borderRadius: "8px",
              fontSize: "16px",
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            Send Message
          </button>
        </form>
      )}

      <div style={{ marginTop: "40px" }}>
        <p> ....... Change the email after buying domain ...... 📧 Or email us directly at: <a href="mailto:contact@wakiee.com" style={{ color: "#00c3ff" }}>contact@wakiee.com</a></p>
        <p>📍 Location: Online Global Platform 🌍</p>
      </div>
    </div>
  );
}
