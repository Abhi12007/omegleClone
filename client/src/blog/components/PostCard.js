// src/blog/components/PostCard.js
import React from "react";
import { Link } from "react-router-dom";

export default function PostCard({ post }) {
  return (
    <article className="post-card">
      {post.coverImage && (
        <div className="post-card-image">
          <img src={post.coverImage} alt={post.title} />
        </div>
      )}
      <div className="post-card-body">
        <h2><Link to={`/blog/${post.slug}`}>{post.title}</Link></h2>
        <div className="post-meta">
          <span>{post.date}</span>
          <span> • {post.readTime} min read</span>
        </div>
        <p className="post-excerpt">{post.excerpt}</p>
        <Link className="read-more" to={`/blog/${post.slug}`}>Read more →</Link>
      </div>
    </article>
  );
}
