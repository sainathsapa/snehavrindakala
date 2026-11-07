"use client";

import { useState, useEffect, useCallback } from "react";

interface User {
  id: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
}

const ROLES = ["super_admin", "manager", "support", "viewer"];

const emptyForm = { email: "", password: "", role: "viewer" };

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentEmail, setCurrentEmail] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const loadUsers = useCallback(() => {
    fetch("/api/admin/users?limit=100", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: any) => {
        setUsers(
          (data.users || []).map((u: any) => ({
            id: u.id || "",
            email: u.email || "",
            role: u.role || "",
            status: u.is_active === false ? "inactive" : "active",
            created_at: u.created_at || "",
          }))
        );
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadUsers();
    fetch("/api/admin/session", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.email) setCurrentEmail(data.email);
      })
      .catch(() => {});
  }, [loadUsers]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create user");
      setForm(emptyForm);
      setShowForm(false);
      loadUsers();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function patchUser(user: User, patch: { role?: string; is_active?: boolean }) {
    setActionId(user.id);
    setError("");
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: user.id, ...patch }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update user");
      loadUsers();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionId(null);
    }
  }

  async function removeUser(user: User) {
    if (!confirm(`Delete admin user ${user.email}?`)) return;
    setActionId(user.id);
    setError("");
    try {
      const res = await fetch(`/api/admin/users?id=${encodeURIComponent(user.id)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete user");
      loadUsers();
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
          <p className="text-muted-ink font-sans">Loading users...</p>
        </div>
      </main>
    );
  }

  const userRows =
    users.length > 0
      ? users.map((u: User) => {
          const isSelf = !!currentEmail && u.email === currentEmail;
          return (
            <tr key={u.id} className="hover:bg-rang-paper/50 transition-colors">
              <td className="px-6 py-4 font-sans text-sm text-deep-ink">
                {u.email}
                {isSelf && (
                  <span className="ml-2 rounded bg-rang-paper px-2 py-0.5 text-xs text-muted-ink">
                    you
                  </span>
                )}
              </td>
              <td className="px-6 py-4 font-sans text-sm">
                <select
                  value={u.role}
                  disabled={actionId === u.id}
                  onChange={(e) => patchUser(u, { role: e.target.value })}
                  className="rounded-md border border-sand-border bg-white px-2 py-1 font-sans text-sm text-deep-ink disabled:opacity-50"
                >
                  {ROLES.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-6 py-4 font-sans text-sm">
                <span
                  className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                    u.status === "active"
                      ? "bg-green-100 text-green-800"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {u.status}
                </span>
              </td>
              <td className="px-6 py-4 font-sans text-sm text-muted-ink">
                {new Date(u.created_at).toLocaleDateString()}
              </td>
              <td className="px-6 py-4 font-sans text-sm">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() =>
                      patchUser(u, { is_active: u.status !== "active" })
                    }
                    disabled={actionId === u.id || isSelf}
                    className="text-sindoor font-medium hover:underline disabled:opacity-50"
                  >
                    {u.status === "active" ? "Deactivate" : "Activate"}
                  </button>
                  <button
                    onClick={() => removeUser(u)}
                    disabled={actionId === u.id || isSelf}
                    className="text-red-600 font-medium hover:underline disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          );
        })
      : (
          <tr>
            <td colSpan={5} className="px-6 py-12 text-center">
              <p className="text-muted-ink font-sans">No users found.</p>
            </td>
          </tr>
        );

  return (
    <main className="py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-serif font-semibold text-deep-ink tracking-tight">
              Users &amp; Roles
            </h1>
            <p className="text-muted-ink font-sans">
              Manage admin users and roles.
            </p>
          </div>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="rounded-md bg-sindoor px-4 py-2 text-sm font-sans font-medium text-white hover:bg-sindoor/90 transition-colors"
          >
            {showForm ? "Cancel" : "New User"}
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
              Create Admin User
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <label className="block">
                <span className="mb-1 block text-xs font-sans font-medium uppercase tracking-wider text-muted-ink">
                  Email *
                </span>
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="manager@svk.local"
                  className="w-full rounded-md border border-sand-border bg-white px-3 py-2 font-sans text-sm text-deep-ink"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-sans font-medium uppercase tracking-wider text-muted-ink">
                  Password *
                </span>
                <input
                  required
                  type="password"
                  minLength={8}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Minimum 8 characters"
                  className="w-full rounded-md border border-sand-border bg-white px-3 py-2 font-sans text-sm text-deep-ink"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-sans font-medium uppercase tracking-wider text-muted-ink">
                  Role
                </span>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full rounded-md border border-sand-border bg-white px-3 py-2 font-sans text-sm text-deep-ink"
                >
                  {ROLES.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-5 flex items-center gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-md bg-sindoor px-4 py-2 text-sm font-sans font-medium text-white hover:bg-sindoor/90 transition-colors disabled:opacity-50"
              >
                {submitting ? "Creating..." : "Create User"}
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
                  Email
                </th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                  Role
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
            <tbody className="divide-y divide-sand-border">{userRows}</tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
