// src/blog/BlogPost.js
import React from "react";
import { useParams } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import "./blog.css";

export default function BlogPost({ posts }) {
  const { slug } = useParams();
  const post = posts.find((p) => p.slug === slug);
  if (!post) return <div className="not-found">Post not found</div>;

  return (
    <div className="blog-page">
      <div className="blog-layout single">
        <main className="post-main">
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
        <aside className="blog-sidebar">
          <Sidebar posts={posts} />
        </aside>
      </div>
    </div>
  );
}
