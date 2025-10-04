// src/blog/BlogPost.js
import React from "react";
import { useParams } from "react-router-dom";
import "./blog.css";

export default function BlogPost({ posts = [] }) {
  const { slug } = useParams();

  // ✅ Defensive: handle missing or empty posts array
  if (!posts || posts.length === 0) {
    return (
      <div className="blog-page">
        <p style={{ textAlign: "center", marginTop: "100px" }}>
          ⚠️ No blog posts found. Please add blog data or check your posts prop.
        </p>
      </div>
    );
  }

  const post = posts.find((p) => p.slug === slug);

  if (!post) {
    return (
      <div className="blog-page">
        <p style={{ textAlign: "center", marginTop: "100px" }}>
          ❌ Post not found.
        </p>
      </div>
    );
  }

  return (
    <div className="blog-page">
      <main className="post-main single">
        <article className="post-detail">
          {post.coverImage && (
            <img className="post-cover" src={post.coverImage} alt={post.title} />
          )}
          <h1 className="post-title">{post.title}</h1>
          <div className="post-meta-detail">
            <span>{post.date}</span>
            <span> • {post.readTime} min read</span>
          </div>
          <div
            className="post-body"
            dangerouslySetInnerHTML={{ __html: post.content }}
          />
        </article>
      </main>
    </div>
  );
}
