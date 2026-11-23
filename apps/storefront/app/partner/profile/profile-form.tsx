"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

interface InitialProfile {
  display_name: string;
  contact_email: string;
  contact_phone: string;
  business_profile: Record<string, unknown>;
}

export default function ProfileForm({
  initial,
  accountStatus,
  verificationStatus,
}: {
  initial: InitialProfile;
  accountStatus: string;
  verificationStatus: string;
}) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(initial.display_name);
  const [contactEmail, setContactEmail] = useState(initial.contact_email);
  const [contactPhone, setContactPhone] = useState(initial.contact_phone);
  const [description, setDescription] = useState(
    typeof initial.business_profile.description === "string"
      ? initial.business_profile.description
      : ""
  );
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const res = await fetch("/api/partner/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: displayName,
          contact_email: contactEmail,
          contact_phone: contactPhone,
          business_profile: { ...initial.business_profile, description },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(data.error || "Could not save the profile.");
      } else {
        setMessage("Profile saved.");
        router.refresh();
      }
    } catch {
      setError("We could not reach the service. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
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

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="display-name" className="mb-2 block text-sm font-sans font-medium text-deep-ink">
            Display name
          </label>
          <input
            id="display-name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            className="w-full rounded-md border border-sand-border bg-surface px-3 py-2 text-sm font-sans text-deep-ink focus:ring-2 focus:ring-sindoor"
          />
        </div>
        <div>
          <label htmlFor="contact-email" className="mb-2 block text-sm font-sans font-medium text-deep-ink">
            Contact email
          </label>
          <input
            id="contact-email"
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            required
            className="w-full rounded-md border border-sand-border bg-surface px-3 py-2 text-sm font-sans text-deep-ink focus:ring-2 focus:ring-sindoor"
          />
        </div>
      </div>

      <div>
        <label htmlFor="contact-phone" className="mb-2 block text-sm font-sans font-medium text-deep-ink">
          Contact phone
        </label>
        <input
          id="contact-phone"
          value={contactPhone}
          onChange={(e) => setContactPhone(e.target.value)}
          className="w-full rounded-md border border-sand-border bg-surface px-3 py-2 text-sm font-sans text-deep-ink focus:ring-2 focus:ring-sindoor"
        />
      </div>

      <div>
        <label htmlFor="business-description" className="mb-2 block text-sm font-sans font-medium text-deep-ink">
          Business description
        </label>
        <textarea
          id="business-description"
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded-md border border-sand-border bg-surface px-3 py-2 text-sm font-sans text-deep-ink focus:ring-2 focus:ring-sindoor"
        />
      </div>

      <dl className="grid gap-3 rounded-md bg-rang-paper p-4 text-sm font-sans sm:grid-cols-2">
        <div>
          <dt className="text-muted-ink">Account status</dt>
          <dd className="font-medium capitalize text-deep-ink">{accountStatus}</dd>
        </div>
        <div>
          <dt className="text-muted-ink">Verification</dt>
          <dd className="font-medium capitalize text-deep-ink">{verificationStatus}</dd>
        </div>
      </dl>

      <button
        type="submit"
        disabled={loading}
        className="rounded-xl bg-sindoor px-5 py-3 font-sans font-semibold text-rang-paper transition-colors hover:bg-sindoor/90 focus:outline-none focus:ring-2 focus:ring-sindoor focus:ring-offset-2 disabled:opacity-50"
      >
        {loading ? "Saving…" : "Save profile"}
      </button>
    </form>
  );
}
