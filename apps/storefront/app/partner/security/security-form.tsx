"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function SecurityForm() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/partner/security/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // No partner_id: the server always derives the tenant from the session.
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(data.error || "Could not change the password.");
      } else {
        setMessage(data.message || "Password changed. Please sign in again.");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        // The session is now stale (token_version bumped): go to sign-in.
        setTimeout(() => {
          router.replace("/partner/login");
          router.refresh();
        }, 1500);
      }
    } catch {
      setError("We could not reach the service. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <h2 className="text-xl font-serif font-semibold text-deep-ink">
        Change password
      </h2>
      {error && (
        <div role="alert" className="rounded-md border border-sindoor/20 bg-sindoor/10 p-3 text-sm font-sans text-sindoor">
          {error}
        </div>
      )}
      {message && (
        <div role="status" className="rounded-md border border-green-700/20 bg-green-700/10 p-3 text-sm font-sans text-green-800">
          {message}
        </div>
      )}

      <div>
        <label htmlFor="current-password" className="mb-2 block text-sm font-sans font-medium text-deep-ink">
          Current password
        </label>
        <input
          id="current-password"
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
          autoComplete="current-password"
          className="w-full rounded-md border border-sand-border bg-surface px-3 py-2 text-sm font-sans text-deep-ink focus:ring-2 focus:ring-sindoor"
        />
      </div>
      <div>
        <label htmlFor="new-password" className="mb-2 block text-sm font-sans font-medium text-deep-ink">
          New password (12+ characters)
        </label>
        <input
          id="new-password"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          minLength={12}
          autoComplete="new-password"
          className="w-full rounded-md border border-sand-border bg-surface px-3 py-2 text-sm font-sans text-deep-ink focus:ring-2 focus:ring-sindoor"
        />
      </div>
      <div>
        <label htmlFor="confirm-password" className="mb-2 block text-sm font-sans font-medium text-deep-ink">
          Confirm new password
        </label>
        <input
          id="confirm-password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          minLength={12}
          autoComplete="new-password"
          className="w-full rounded-md border border-sand-border bg-surface px-3 py-2 text-sm font-sans text-deep-ink focus:ring-2 focus:ring-sindoor"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="rounded-xl bg-sindoor px-5 py-3 font-sans font-semibold text-rang-paper transition-colors hover:bg-sindoor/90 focus:outline-none focus:ring-2 focus:ring-sindoor focus:ring-offset-2 disabled:opacity-50"
      >
        {loading ? "Updating…" : "Change password"}
      </button>
    </form>
  );
}
