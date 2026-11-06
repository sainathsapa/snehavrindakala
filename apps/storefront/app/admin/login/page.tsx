"use client";

import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (res.ok) {
        window.location.href = "/admin";
      } else {
        setError("Invalid email or password");
        setLoading(false);
      }
    } catch {
      setError("Login failed");
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-rang-paper">
      <div className="max-w-md px-6 py-8 rounded-xl border border-sand-border bg-surface shadow-lg">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-serif font-semibold text-deep-ink tracking-tight">
            Admin Login
          </h1>
          <p className="text-muted-ink font-sans mt-2">
            Sign in to your admin account
          </p>
        </div>
        {error && (
          <div className="mb-6 p-3 rounded-md bg-sindoor/10 border border-sindoor/20 text-sindoor text-sm">
            {error}
          </div>
        )}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-sans font-medium text-deep-ink mb-2">
              Email Address
            </label>
            <input
              type="email"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-md border border-sand-border bg-surface text-sm font-sans focus:ring-2 focus:ring-sindoor"
              placeholder="sneha@sainath.com"
            />
          </div>
          <div>
            <label className="block text-sm font-sans font-medium text-deep-ink mb-2">
              Password
            </label>
            <input
              type="password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-md border border-sand-border bg-surface text-sm font-sans focus:ring-2 focus:ring-sindoor"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-sindoor text-rang-paper rounded-xl font-semibold hover:bg-sindoor/90 focus:outline-none focus:ring-2 focus:ring-sindoor focus:ring-offset-2 transition-colors disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </main>
  );
}