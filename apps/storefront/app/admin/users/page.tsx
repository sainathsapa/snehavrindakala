"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ROLE_LABELS } from "@/lib/rbac";

interface AdminUser {
  id: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

export default function UsersPage() {
  const [form, setForm] = useState({ email: "", password: "", role: "viewer" as string });
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    try {
      const res = await fetch("/api/admin/users", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch (err) {
      console.error("Failed to load users", err);
    } finally {
      setLoading(false);
    }
  }

  // Load users on mount
  if (typeof window !== "undefined") {
    loadUsers();
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setMessage({ ok: true, text: "User created successfully." });
        setForm({ email: "", password: "", role: "viewer" });
        loadUsers();
      } else {
        const err = await res.json();
        setMessage({ ok: false, text: err.error || "Failed to create user." });
      }
    } catch {
      setMessage({ ok: false, text: "Error creating user." });
    }
  }

  async function handleUpdate(id: string, updates: { role?: string; is_active?: boolean }) {
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...updates }),
      });
      if (res.ok) {
        setMessage({ ok: true, text: "User updated." });
        loadUsers();
      } else {
        setMessage({ ok: false, text: "Failed to update user." });
      }
    } catch {
      setMessage({ ok: false, text: "Error updating user." });
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this user?")) return;
    try {
      const res = await fetch(`/api/admin/users?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setMessage({ ok: true, text: "User deleted." });
        loadUsers();
      }
    } catch {
      setMessage({ ok: false, text: "Error deleting user." });
    }
  }

  return (
    <main className="py-8">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-serif font-semibold text-deep-ink tracking-tight">
            Users & Roles
          </h1>
          <p className="text-muted-ink font-sans">
            Manage admin users and role-based access control.
          </p>
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
          <h2 className="text-lg font-serif font-semibold text-deep-ink mb-4">
            Add Admin User
          </h2>
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <input
              name="email"
              type="email"
              placeholder="Email address"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              className="px-3 py-2 rounded-md border border-sand-border bg-surface text-sm font-sans"
            />
            <input
              name="password"
              type="password"
              placeholder="Password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              className="px-3 py-2 rounded-md border border-sand-border bg-surface text-sm font-sans"
            />
            <select
              name="role"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="px-3 py-2 rounded-md border border-sand-border bg-surface text-sm font-sans"
            >
              <option value="super_admin">Super Admin</option>
              <option value="manager">Manager</option>
              <option value="support">Support</option>
              <option value="viewer">Viewer</option>
            </select>
            <button
              type="submit"
              className="px-4 py-2 bg-sindoor text-rang-paper rounded-md font-medium hover:bg-sindoor/90 transition-colors"
            >
              Create User
            </button>
          </form>
        </div>

        <div className="rounded-xl border border-sand-border bg-surface overflow-hidden">
          <table className="w-full text-left divide-y divide-sand-border">
            <thead>
              <tr className="bg-surface">
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">Email</th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">Role</th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">Joined</th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-border">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <p className="text-muted-ink font-sans">Loading users...</p>
                  </td>
                </tr>
              ) : users.length > 0 ? (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-rang-paper/50">
                    <td className="px-6 py-4 font-sans text-sm text-deep-ink">{user.email}</td>
                    <td className="px-6 py-4 font-sans text-sm text-deep-ink capitalize">
                      {ROLE_LABELS[user.role as keyof typeof ROLE_LABELS] || user.role}
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={String(user.is_active)}
                        onChange={(e) =>
                          handleUpdate(user.id, { is_active: e.target.value === "true" })
                        }
                        className="text-xs font-sans text-deep-ink"
                      >
                        <option value="true">Active</option>
                        <option value="false">Inactive</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 font-sans text-sm text-muted-ink">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <select
                        value={user.role}
                        onChange={(e) => handleUpdate(user.id, { role: e.target.value })}
                        className="text-xs font-sans text-deep-ink"
                      >
                        <option value="super_admin">Super Admin</option>
                        <option value="manager">Manager</option>
                        <option value="support">Support</option>
                        <option value="viewer">Viewer</option>
                      </select>
                      <button
                        onClick={() => handleDelete(user.id)}
                        className="ml-2 text-xs font-medium text-sindoor hover:underline"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <p className="text-muted-ink font-sans">No users found.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-10 rounded-xl border border-sand-border bg-surface p-6">
          <h2 className="text-lg font-serif font-semibold text-deep-ink mb-4">
            Role Permissions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              { role: "super_admin", desc: "Full access to all features including user and role management." },
              { role: "manager", desc: "Manage orders, products, categories, and artists." },
              { role: "support", desc: "Manage support tickets and view orders/customers." },
              { role: "viewer", desc: "Read-only access to all admin resources." },
            ].map((r) => (
              <div key={r.role} className="p-4 rounded-lg border border-sand-border bg-rang-paper/50">
                <h3 className="font-sans font-semibold text-deep-ink capitalize">{r.role}</h3>
                <p className="text-sm text-muted-ink font-sans">{r.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
