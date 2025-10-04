// src/blog/BlogIndex.js
import React from "react";
import PostCard from "./components/PostCard";
import Sidebar from "./components/Sidebar";
import "./blog.css";

export default function BlogIndex({ posts }) {
  return (
    <div className="blog-page">
      <header className="blog-hero">
        <h1>Wakiee Blog</h1>
        <p>Stories, updates & behind-the-scenes</p>
      </header>

      <div className="blog-layout">
        <main className="blog-main">
          {posts.map((post) => (
            <PostCard key={post.slug} post={post} />
          ))}
        </main>
        <aside className="blog-sidebar">
          <Sidebar posts={posts} />
        </aside>
      </div>
    </div>
  );
}

