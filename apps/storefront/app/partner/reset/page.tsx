"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";

const inputClass =
  "w-full rounded-md border border-sand-border bg-surface px-3 py-2 text-sm font-sans text-deep-ink focus:ring-2 focus:ring-sindoor";
const labelClass =
  "mb-2 block text-sm font-sans font-medium text-deep-ink";
const buttonClass =
  "w-full rounded-xl bg-sindoor px-4 py-3 font-sans font-semibold text-rang-paper transition-colors hover:bg-sindoor/90 focus:outline-none focus:ring-2 focus:ring-sindoor focus:ring-offset-2 disabled:opacity-50";

export default function PartnerResetPage() {
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function requestReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);
    try {
      const res = await fetch("/api/partner/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "request", email }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        message?: string;
        token?: string | null;
        mode?: string;
      };
      if (!res.ok || !data.ok) {
        setError(data.error || "We could not record your request.");
        return;
      }
      setMessage(data.message || "Your request has been recorded.");
      // Development only: the API hands back a usable token because no SES
      // transport is configured. Production never returns one.
      if (data.mode === "development" && data.token) {
        setToken(data.token);
      }
    } catch {
      setError("We could not reach the service. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (password !== confirmPassword) {
      setError("The two passwords do not match.");
      return;
    }
    if (password.length < 12) {
      setError("Use a password of at least 12 characters.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/partner/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirm", token, password }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        message?: string;
      };
      if (!res.ok || !data.ok) {
        setError(data.error || "We could not reset your password.");
        return;
      }
      setMessage(
        data.message ||
          "Password updated. Existing sessions have been revoked."
      );
      setToken("");
      setPassword("");
      setConfirmPassword("");
    } catch {
      setError("We could not reach the service. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-rang-paper px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <p className="text-xs font-sans uppercase tracking-[0.2em] text-sindoor">
            SnehaVrinda Kala
          </p>
          <h1 className="mt-2 text-3xl font-serif font-semibold text-deep-ink tracking-tight">
            Reset your password
          </h1>
          <p className="mt-2 text-sm font-sans text-muted-ink">
            Partner portal access for your membership.
          </p>
        </div>

        <div className="space-y-6 rounded-xl border border-sand-border bg-surface p-6 shadow-lg sm:p-8">
          {error && (
            <div
              role="alert"
              className="rounded-md border border-sindoor/20 bg-sindoor/10 p-3 text-sm font-sans text-sindoor"
            >
              {error}
            </div>
          )}
          {message && (
            <div
              role="status"
              className="rounded-md border border-sand-border bg-rang-paper p-3 text-sm font-sans text-deep-ink"
            >
              {message}
            </div>
          )}

          <section>
            <h2 className="mb-4 text-lg font-serif font-semibold text-deep-ink">
              1. Request a reset
            </h2>
            <form onSubmit={requestReset} className="space-y-4">
              <div>
                <label htmlFor="reset-email" className={labelClass}>
                  Email address
                </label>
                <input
                  id="reset-email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  autoComplete="email"
                  placeholder="you@yourstudio.in"
                  className={inputClass}
                />
              </div>
              <button type="submit" disabled={busy} className={buttonClass}>
                {busy ? "Sending…" : "Request reset"}
              </button>
            </form>
            <p className="mt-3 text-xs font-sans text-muted-ink">
              Email delivery requires a configured SES transport. In development
              a token is shown here instead; in production the request is only
              acknowledged.
            </p>
          </section>

          <hr className="border-sand-border" />

          <section>
            <h2 className="mb-4 text-lg font-serif font-semibold text-deep-ink">
              2. Set a new password
            </h2>
            <form onSubmit={confirmReset} className="space-y-4">
              <div>
                <label htmlFor="reset-token" className={labelClass}>
                  Reset token
                </label>
                <input
                  id="reset-token"
                  name="token"
                  type="text"
                  value={token}
                  onChange={(event) => setToken(event.target.value)}
                  required
                  placeholder="Paste the token from your reset link"
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="reset-password" className={labelClass}>
                  New password
                </label>
                <input
                  id="reset-password"
                  name="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  minLength={12}
                  autoComplete="new-password"
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="reset-confirm" className={labelClass}>
                  Confirm new password
                </label>
                <input
                  id="reset-confirm"
                  name="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                  minLength={12}
                  autoComplete="new-password"
                  className={inputClass}
                />
              </div>
              <button type="submit" disabled={busy} className={buttonClass}>
                {busy ? "Updating…" : "Set new password"}
              </button>
            </form>
            <p className="mt-3 text-xs font-sans text-muted-ink">
              Completing a reset bumps your token version, which revokes every
              existing session for this membership.
            </p>
          </section>
        </div>

        <p className="mt-6 text-center text-sm font-sans text-muted-ink">
          Remembered it?{" "}
          <Link
            href="/partner/login"
            className="font-medium text-sindoor hover:underline"
          >
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
