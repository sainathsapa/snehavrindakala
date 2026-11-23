"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/partner/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };

      if (!res.ok || !data.ok) {
        // The server returns one generic message for every failure.
        setError(data.error || "We could not sign you in. Please try again.");
        setLoading(false);
        return;
      }

      router.replace("/partner");
      router.refresh();
    } catch {
      setError("We could not reach the sign-in service. Please try again.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div
          role="alert"
          className="rounded-md border border-sindoor/20 bg-sindoor/10 p-3 text-sm font-sans text-sindoor"
        >
          {error}
        </div>
      )}

      <div>
        <label
          htmlFor="partner-email"
          className="mb-2 block text-sm font-sans font-medium text-deep-ink"
        >
          Email address
        </label>
        <input
          id="partner-email"
          name="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          autoComplete="username"
          placeholder="you@yourstudio.in"
          className="w-full rounded-md border border-sand-border bg-surface px-3 py-2 text-sm font-sans text-deep-ink focus:ring-2 focus:ring-sindoor"
        />
      </div>

      <div>
        <label
          htmlFor="partner-password"
          className="mb-2 block text-sm font-sans font-medium text-deep-ink"
        >
          Password
        </label>
        <input
          id="partner-password"
          name="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          autoComplete="current-password"
          className="w-full rounded-md border border-sand-border bg-surface px-3 py-2 text-sm font-sans text-deep-ink focus:ring-2 focus:ring-sindoor"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-sindoor px-4 py-3 font-sans font-semibold text-rang-paper transition-colors hover:bg-sindoor/90 focus:outline-none focus:ring-2 focus:ring-sindoor focus:ring-offset-2 disabled:opacity-50"
      >
        {loading ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
