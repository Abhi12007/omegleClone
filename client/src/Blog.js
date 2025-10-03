// client/src/Blog.js
import React from "react";

export default function Blog() {
  return (
    <div style={{ padding: "40px", color: "white", maxWidth: "800px", margin: "auto" }}>
      <h1>Wakiee Blog</h1>
      <p>Read our latest articles on online communication, language learning, and safety.</p>

      <article style={{ margin: "30px 0" }}>
        <h2>🌍 How to Make Friends Online Safely</h2>
        <p>Meeting strangers online can be fun, but safety should always come first. Learn how to protect your privacy and enjoy positive conversations.</p>
      </article>

      <article style={{ margin: "30px 0" }}>
        <h2>🗣️ 5 Tips for Practicing Languages with Strangers</h2>
        <p>Want to improve your English, Spanish, or French? Wakiee connects you with global learners. Here’s how to make the most of it.</p>
      </article>

      <article style={{ margin: "30px 0" }}>
        <h2>🤝 Why Respect Matters in Online Conversations</h2>
        <p>Respect is the foundation of Wakiee. Discover how kindness and empathy can make online chats more meaningful.</p>
      </article>
    </div>
  );
}
