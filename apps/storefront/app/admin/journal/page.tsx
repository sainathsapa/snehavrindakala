"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@snehavrinda-kala/ui";

interface Post {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  cover_image: string;
  author: string;
  status: string;
  created_at: string;
}

export default function JournalPage() {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [form, setForm] = useState({
    title: "",
    slug: "",
    content: "",
    excerpt: "",
    cover_image: "",
    author: "",
    status: "draft",
  });

  useEffect(() => {
    loadPosts();
  }, []);

  async function loadPosts() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/journal", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setPosts(data.posts || []);
      }
    } catch (err) {
      console.error("Failed to load posts", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/journal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          slug: form.slug,
          content: form.content,
          excerpt: form.excerpt,
          cover_image: form.cover_image,
          author: form.author,
          status: form.status,
        }),
      });
      if (res.ok) {
        setMessage({ ok: true, text: "Post created." });
        setForm({ title: "", slug: "", content: "", excerpt: "", cover_image: "", author: "", status: "draft" });
        loadPosts();
      } else {
        const err = await res.json();
        setMessage({ ok: false, text: err.error || "Failed to create post." });
      }
    } catch {
      setMessage({ ok: false, text: "Error creating post." });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="py-8">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <p className="text-muted-ink font-sans">Loading posts...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-serif font-semibold text-deep-ink tracking-tight">
            Journal / Blog
          </h1>
          <p className="text-muted-ink font-sans">Manage blog posts.</p>
        </div>

        {message && (
          <p className={`mb-6 rounded-md p-3 text-sm font-sans ${
            message.ok
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}>
            {message.text}
          </p>
        )}

        <div className="rounded-xl border border-sand-border bg-surface p-6 mb-8">
          <h2 className="text-lg font-serif font-semibold text-deep-ink mb-4">Create Post</h2>
          <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-sans font-medium text-deep-ink">Title</label>
              <input name="title" type="text" value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required className="w-full px-3 py-2 rounded-md border border-sand-border bg-surface text-sm font-sans"/>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-sans font-medium text-deep-ink">Slug</label>
              <input name="slug" type="text" value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                placeholder="e.g. my-article" required
                className="w-full px-3 py-2 rounded-md border border-sand-border bg-surface text-sm font-sans"/>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-sans font-medium text-deep-ink">Author</label>
              <input name="author" type="text" value={form.author}
                onChange={(e) => setForm({ ...form, author: e.target.value })}
                className="w-full px-3 py-2 rounded-md border border-sand-border bg-surface text-sm font-sans"/>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-sans font-medium text-deep-ink">Status</label>
              <select name="status" value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full px-3 py-2 rounded-md border border-sand-border bg-surface text-sm font-sans">
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </div>
            <div className="col-span-full space-y-2">
              <label className="block text-sm font-sans font-medium text-deep-ink">Excerpt</label>
              <input name="excerpt" type="text" value={form.excerpt}
                onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
                className="w-full px-3 py-2 rounded-md border border-sand-border bg-surface text-sm font-sans"/>
            </div>
            <div className="col-span-full space-y-2">
              <label className="block text-sm font-sans font-medium text-deep-ink">Content</label>
              <textarea name="content" value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                rows={4} className="w-full px-3 py-2 rounded-md border border-sand-border bg-surface text-sm font-sans"/>
            </div>
            <div className="col-span-full space-y-2">
              <label className="block text-sm font-sans font-medium text-deep-ink">Cover Image URL</label>
              <input name="cover_image" type="text" value={form.cover_image}
                onChange={(e) => setForm({ ...form, cover_image: e.target.value })}
                placeholder="https://..." className="w-full px-3 py-2 rounded-md border border-sand-border bg-surface text-sm font-sans"/>
            </div>
            <button type="submit" disabled={saving}
              className="px-6 py-2 bg-sindoor text-rang-paper rounded-md font-medium hover:bg-sindoor/90 transition-colors disabled:opacity-50">
              {saving ? "Creating…" : "Create Post"}
            </button>
          </form>
        </div>

        <div className="rounded-xl border border-sand-border bg-surface overflow-hidden">
          <table className="w-full text-left divide-y divide-sand-border">
            <thead>
              <tr className="bg-surface">
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">Title</th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">Slug</th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">Author</th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-border">
              {posts.length > 0 ? (
                posts.map((p: any) => (
                  <tr key={p.id} className="hover:bg-rang-paper/50">
                    <td className="px-6 py-4 font-sans text-sm text-deep-ink">{p.title}</td>
                    <td className="px-6 py-4 font-sans text-sm text-muted-ink font-mono">{p.slug}</td>
                    <td className="px-6 py-4 font-sans text-sm text-muted-ink">{p.author}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium font-sans ${
                        p.status === "published" ? "bg-leaf/10 text-leaf border border-leaf/20" : "bg-terracotta/10 text-terracotta border border-terracotta/20"
                      }`}>{p.status}</span>
                    </td>
                    <td className="px-6 py-4 font-sans text-sm text-muted-ink">{new Date(p.created_at).toLocaleDateString()}</td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={5} className="px-6 py-12 text-center"><p className="text-muted-ink font-sans">No posts yet.</p></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}