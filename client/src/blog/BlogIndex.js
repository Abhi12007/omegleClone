// src/blog/BlogIndex.js
import React, { useState, useMemo } from "react";
import PostCard from "./components/PostCard";
import "./blog.css";

export default function BlogIndex({ posts }) {
  const [sortOrder, setSortOrder] = useState("recent"); // 'recent' | 'oldest'

  // 🧮 Sort posts based on selected order
  const sortedPosts = useMemo(() => {
    const sorted = [...posts];
    sorted.sort((a, b) => {
      const da = new Date(a.date);
      const db = new Date(b.date);
      return sortOrder === "recent" ? db - da : da - db;
    });
    return sorted;
  }, [posts, sortOrder]);

  return (
    <div className="blog-page">
      {/* Header Section */}
      <header className="blog-header-bar">
        <div className="header-left">
          <h1>Wakiee Blog</h1>
          <p>Stories, updates & behind-the-scenes</p>
        </div>

        {/* ✅ Top-right filter */}
        <div className="header-filter">
          <label htmlFor="sortOrder">Sort by:</label>
          <select
            id="sortOrder"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
          >
            <option value="recent">Recent Posts</option>
            <option value="oldest">Oldest Posts</option>
          </select>
        </div>
      </header>

      {/* Blog Cards Grid */}
      <main className="blog-grid">
        {sortedPosts.map((post) => (
          <PostCard key={post.slug} post={post} />
        ))}
      </main>
    </div>
  );
}
