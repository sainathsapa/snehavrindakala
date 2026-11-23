"use client";

/**
 * Review one partner onboarding application.
 *
 * Submitted data is shown verbatim — the admin confirms the legal identity
 * rather than the system inventing one. Approve / request more info / reject
 * are Server Actions; the clicked button supplies its own `decision` value.
 */

import {
  useCallback,
  useEffect,
  useState,
  useActionState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  reviewApplicationAction,
  type ReviewActionState,
} from "../actions";

interface Application {
  id: string;
  legal_name: string;
  display_name: string;
  contact_email: string;
  contact_phone: string | null;
  business_details: Record<string, unknown>;
  artist_information: Record<string, unknown>;
  product_categories: unknown[];
  document_keys: unknown[];
  review_status: string;
  review_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_partner_id: string | null;
  created_at: string;
}

function pretty(value: unknown): string {
  try {
    return JSON.stringify(value ?? {}, null, 2);
  } catch {
    return String(value);
  }
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
        {label}
      </dt>
      <dd className="mt-1 font-sans text-sm text-deep-ink">{value || "—"}</dd>
    </div>
  );
}

export default function ReviewApplicationPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const [application, setApplication] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [state, formAction, pending] = useActionState<
    ReviewActionState | null,
    FormData
  >(reviewApplicationAction, null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/partner-applications/${id}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        setApplication(data.application ?? null);
      }
    } catch (err) {
      console.error("Failed to load partner application", err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <main className="py-8">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <p className="text-muted-ink font-sans">Loading application…</p>
        </div>
      </main>
    );
  }

  if (!application) {
    return (
      <main className="py-8">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <Link
            href="/admin/partner-applications"
            className="text-sindoor font-sans font-medium hover:underline"
          >
            ← Back to Applications
          </Link>
          <p className="mt-4 text-muted-ink font-sans">
            Application not found.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="py-8">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <Link
            href="/admin/partner-applications"
            className="inline-block mb-4 text-sindoor font-sans font-medium hover:underline"
          >
            ← Back to Applications
          </Link>
          <h1 className="text-3xl font-serif font-semibold text-deep-ink tracking-tight">
            Review Application
          </h1>
          <p className="text-muted-ink font-sans">
            #{application.id.slice(-8)} · status:{" "}
            {application.review_status.replace("_", " ")}
          </p>
        </div>

        <section className="mb-6 rounded-xl border border-sand-border bg-surface p-6">
          <h2 className="mb-4 text-lg font-serif font-semibold text-deep-ink">
            Submitted details
          </h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Legal name" value={application.legal_name} />
            <Field label="Display name" value={application.display_name} />
            <Field label="Contact email" value={application.contact_email} />
            <Field label="Contact phone" value={application.contact_phone} />
            <Field
              label="Submitted"
              value={
                application.created_at
                  ? new Date(application.created_at).toLocaleString()
                  : null
              }
            />
            <Field
              label="Created partner"
              value={application.created_partner_id}
            />
          </dl>
        </section>

        <section className="mb-6 space-y-4">
          {[
            ["Business details", application.business_details],
            ["Artist information", application.artist_information],
            ["Product categories", application.product_categories],
            ["Documents", application.document_keys],
          ].map(([label, value]) => (
            <details
              key={String(label)}
              className="rounded-xl border border-sand-border bg-surface p-4"
            >
              <summary className="cursor-pointer font-sans text-sm font-medium text-deep-ink">
                {String(label)}
              </summary>
              <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words rounded-md bg-rang-paper p-3 font-sans text-xs text-muted-ink">
                {pretty(value)}
              </pre>
            </details>
          ))}
        </section>

        {(application.reviewed_by || application.review_notes) && (
          <section className="mb-6 rounded-xl border border-sand-border bg-rang-paper p-4">
            <h2 className="font-serif text-base font-semibold text-deep-ink">
              Previous review
            </h2>
            <p className="mt-1 font-sans text-sm text-muted-ink">
              {application.reviewed_by || "Unknown reviewer"}
              {application.reviewed_at
                ? ` · ${new Date(application.reviewed_at).toLocaleString()}`
                : ""}
            </p>
            {application.review_notes && (
              <p className="mt-2 whitespace-pre-wrap font-sans text-sm text-deep-ink">
                {application.review_notes}
              </p>
            )}
          </section>
        )}

        <section className="rounded-xl border border-sand-border bg-surface p-6">
          <h2 className="mb-4 text-lg font-serif font-semibold text-deep-ink">
            Record a decision
          </h2>
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="id" value={application.id} />
            <div>
              <label
                htmlFor="review-notes"
                className="block text-sm font-sans font-medium text-deep-ink mb-2"
              >
                Review notes
              </label>
              <textarea
                id="review-notes"
                name="notes"
                rows={4}
                placeholder="Confirm the legal identity, or state what is missing…"
                className="w-full px-3 py-2 rounded-md border border-sand-border bg-surface text-sm font-sans text-deep-ink focus:ring-2 focus:ring-sindoor"
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                name="decision"
                value="approved"
                disabled={pending}
                className="rounded-md bg-leaf px-4 py-2 text-sm font-sans font-medium text-white hover:bg-leaf/90 disabled:opacity-50 transition-colors"
              >
                Approve
              </button>
              <button
                type="submit"
                name="decision"
                value="more_info"
                disabled={pending}
                className="rounded-md border border-sindoor px-4 py-2 text-sm font-sans font-medium text-sindoor hover:bg-sindoor/10 disabled:opacity-50 transition-colors"
              >
                Request more info
              </button>
              <button
                type="submit"
                name="decision"
                value="rejected"
                disabled={pending}
                className="rounded-md border border-terracotta px-4 py-2 text-sm font-sans font-medium text-terracotta hover:bg-terracotta/10 disabled:opacity-50 transition-colors"
              >
                Reject
              </button>
            </div>
          </form>

          {state && (
            <div
              role={state.ok ? "status" : "alert"}
              className={`mt-4 rounded-md p-4 font-sans text-sm ${
                state.ok
                  ? "bg-leaf/10 text-leaf"
                  : "bg-sindoor/10 text-sindoor"
              }`}
            >
              <p>{state.message}</p>
              {state.temporaryPassword && (
                <div className="mt-3 rounded-md border border-sand-border bg-surface p-3">
                  <p className="font-medium text-deep-ink">
                    Temporary owner password — shown once
                  </p>
                  <code className="mt-1 block break-all font-mono text-sm text-deep-ink">
                    {state.temporaryPassword}
                  </code>
                  <p className="mt-2 text-xs text-muted-ink">
                    Copy this now and hand it to the partner securely. It is
                    stored only as a hash and cannot be retrieved again.
                  </p>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
