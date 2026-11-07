"use client";

import { useState, useEffect, useCallback } from "react";

interface Post {
  id: string;
  title: string;
  slug: string;
  author: string;
  status: string;
  created_at: string;
}

const emptyForm = {
  title: "",
  slug: "",
  author: "",
  excerpt: "",
  content: "",
  status: "draft",
};

export default function JournalPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const loadPosts = useCallback(() => {
    fetch("/api/admin/journal", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: any) => {
        setPosts(
          (data.posts || []).map((p: any) => ({
            id: p.id || "",
            title: p.title || "",
            slug: p.slug || "",
            author: p.author || "",
            status: p.status || "",
            created_at: p.created_at || "",
          }))
        );
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/admin/journal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create post");
      setForm(emptyForm);
      setShowForm(false);
      loadPosts();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function updateStatus(post: Post, status: string) {
    setActionId(post.id);
    setError("");
    try {
      const res = await fetch(`/api/admin/journal/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update post");
      loadPosts();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionId(null);
    }
  }

  async function removePost(post: Post) {
    if (!confirm(`Delete post "${post.title}"?`)) return;
    setActionId(post.id);
    setError("");
    try {
      const res = await fetch(`/api/admin/journal/${post.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete post");
      loadPosts();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionId(null);
    }
  }

  if (loading) {
    return (
      <main className="py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="text-muted-ink font-sans">Loading journal...</p>
        </div>
      </main>
    );
  }

  const postRows =
    posts.length > 0
      ? posts.map((p: Post) => (
          <tr key={p.id} className="hover:bg-rang-paper/50 transition-colors">
            <td className="px-6 py-4 font-sans text-sm text-deep-ink">
              {p.title}
            </td>
            <td className="px-6 py-4 font-sans text-sm text-muted-ink">
              {p.slug}
            </td>
            <td className="px-6 py-4 font-sans text-sm text-muted-ink">
              {p.author || "—"}
            </td>
            <td className="px-6 py-4 font-sans text-sm">
              <span
                className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                  p.status === "published"
                    ? "bg-green-100 text-green-800"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {p.status}
              </span>
            </td>
            <td className="px-6 py-4 font-sans text-sm text-muted-ink">
              {new Date(p.created_at).toLocaleDateString()}
            </td>
            <td className="px-6 py-4 font-sans text-sm">
              <div className="flex items-center gap-3">
                <button
                  onClick={() =>
                    updateStatus(
                      p,
                      p.status === "published" ? "draft" : "published"
                    )
                  }
                  disabled={actionId === p.id}
                  className="text-sindoor font-medium hover:underline disabled:opacity-50"
                >
                  {p.status === "published" ? "Unpublish" : "Publish"}
                </button>
                <button
                  onClick={() => removePost(p)}
                  disabled={actionId === p.id}
                  className="text-red-600 font-medium hover:underline disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </td>
          </tr>
        ))
      : (
          <tr>
            <td colSpan={6} className="px-6 py-12 text-center">
              <p className="text-muted-ink font-sans">No journal posts found.</p>
            </td>
          </tr>
        );

  return (
    <main className="py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-serif font-semibold text-deep-ink tracking-tight">
              Journal
            </h1>
            <p className="text-muted-ink font-sans">
              Manage journal entries and stories.
            </p>
          </div>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="rounded-md bg-sindoor px-4 py-2 text-sm font-sans font-medium text-white hover:bg-sindoor/90 transition-colors"
          >
            {showForm ? "Cancel" : "New Post"}
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 font-sans text-sm text-red-700">
            {error}
          </div>
        )}

        {showForm && (
          <form
            onSubmit={handleCreate}
            className="mb-6 rounded-xl border border-sand-border bg-surface p-6"
          >
            <h2 className="mb-4 text-lg font-serif font-semibold text-deep-ink">
              Create Journal Post
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-sans font-medium uppercase tracking-wider text-muted-ink">
                  Title *
                </span>
                <input
                  required
                  value={form.title}
                  onChange={(e) => {
                    const title = e.target.value;
                    setForm((f) => ({
                      ...f,
                      title,
                      slug:
                        f.slug ||
                        title
                          .toLowerCase()
                          .replace(/[^a-z0-9]+/g, "-")
                          .replace(/^-|-$/g, ""),
                    }));
                  }}
                  className="w-full rounded-md border border-sand-border bg-white px-3 py-2 font-sans text-sm text-deep-ink"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-sans font-medium uppercase tracking-wider text-muted-ink">
                  Slug *
                </span>
                <input
                  required
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  className="w-full rounded-md border border-sand-border bg-white px-3 py-2 font-sans text-sm text-deep-ink"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-sans font-medium uppercase tracking-wider text-muted-ink">
                  Author
                </span>
                <input
                  value={form.author}
                  onChange={(e) => setForm({ ...form, author: e.target.value })}
                  className="w-full rounded-md border border-sand-border bg-white px-3 py-2 font-sans text-sm text-deep-ink"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-sans font-medium uppercase tracking-wider text-muted-ink">
                  Status
                </span>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full rounded-md border border-sand-border bg-white px-3 py-2 font-sans text-sm text-deep-ink"
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </select>
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-xs font-sans font-medium uppercase tracking-wider text-muted-ink">
                  Excerpt
                </span>
                <input
                  value={form.excerpt}
                  onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
                  className="w-full rounded-md border border-sand-border bg-white px-3 py-2 font-sans text-sm text-deep-ink"
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-xs font-sans font-medium uppercase tracking-wider text-muted-ink">
                  Content
                </span>
                <textarea
                  rows={5}
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  className="w-full rounded-md border border-sand-border bg-white px-3 py-2 font-sans text-sm text-deep-ink"
                />
              </label>
            </div>
            <div className="mt-5 flex items-center gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-md bg-sindoor px-4 py-2 text-sm font-sans font-medium text-white hover:bg-sindoor/90 transition-colors disabled:opacity-50"
              >
                {submitting ? "Creating..." : "Create Post"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-md border border-sand-border px-4 py-2 text-sm font-sans font-medium text-deep-ink hover:bg-rang-paper transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="rounded-xl border border-sand-border bg-surface overflow-hidden">
          <table className="w-full text-left divide-y divide-sand-border">
            <thead>
              <tr className="bg-surface">
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                  Title
                </th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                  Slug
                </th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                  Author
                </th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-border">{postRows}</tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
