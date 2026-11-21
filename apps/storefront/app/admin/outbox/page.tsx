/**
 * The outbox page.
 *
 * Every message the shop writes is recorded with its outcome. When nothing can
 * send mail, the outcome is `skipped` — a true record of a message a customer
 * never received — and until this page existed those rows were visible only by
 * querying Postgres by hand. The shop looked configured; the customers heard
 * nothing.
 *
 * Read-only on purpose. A "resend" button here would fail for exactly the reason
 * the row already gives, and offering it would imply the shop can send mail when
 * it cannot.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/app/admin/actions";
import { emailStatus } from "@/lib/config-status";
import { emptyOutboxMeans, listUndelivered } from "@/lib/outbox";

export const dynamic = "force-dynamic";

function when(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function OutboxPage() {
  if (!(await requireAdmin())) redirect("/admin/login");

  const email = emailStatus();
  const transportReady = email.level === "ready";

  let entries: Awaited<ReturnType<typeof listUndelivered>> = [];
  let failed = false;
  try {
    entries = await listUndelivered(100);
  } catch (error) {
    console.error("Could not read the outbox", error);
    failed = true;
  }

  const missing = entries.filter((entry) => entry.reason === "no-transport");
  const broken = entries.filter((entry) => entry.reason === "transport-error");

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-serif text-2xl font-semibold text-deep-ink">Outbox</h1>
        <p className="mt-1 max-w-2xl font-sans text-sm text-muted-ink">
          Messages this shop tried to send and could not. Each row says what it
          was, who it was for, and why it did not leave — so a customer can be
          written to by hand.
        </p>
      </header>

      {!transportReady && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4">
          <p className="font-sans text-sm text-amber-900">{email.detail}</p>
          <p className="mt-1 font-sans text-xs text-amber-900">{email.impact}</p>
          <Link
            href="/admin/settings"
            className="mt-2 inline-block font-sans text-xs text-amber-900 underline"
          >
            Which settings are missing
          </Link>
        </div>
      )}

      {failed && (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          The outbox could not be read. This page shows nothing because of an
          error, not because everything was delivered.
        </p>
      )}

      {!failed && entries.length === 0 && (
        <div className="rounded-xl border border-sand-border bg-surface p-6">
          <p className="font-sans text-sm text-muted-ink">
            {emptyOutboxMeans({ transportReady })}
          </p>
        </div>
      )}

      {entries.length > 0 && (
        <>
          <p className="font-sans text-xs text-muted-ink">
            {entries.length} undelivered
            {missing.length > 0 ? ` · ${missing.length} waiting on a mail transport` : ""}
            {broken.length > 0 ? ` · ${broken.length} rejected by the transport` : ""}
          </p>

          <ul className="divide-y divide-sand-border rounded-xl border border-sand-border bg-surface">
            {entries.map((entry) => (
              <li key={entry.id} className="p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-sans text-sm text-deep-ink">
                    {entry.what}
                    <span className="ml-2 rounded-full bg-paper px-2 py-0.5 font-sans text-[11px] uppercase tracking-wide text-muted-ink">
                      {entry.status}
                    </span>
                  </p>
                  <p className="font-sans text-xs text-muted-ink">
                    {when(entry.createdAt)}
                  </p>
                </div>
                <p className="mt-1 font-sans text-xs text-muted-ink">
                  {entry.to ? `to ${entry.to}` : "no address recorded"}
                  {entry.source === "cart-reminder" ? " · from an unfinished cart" : ""}
                </p>
                <p className="mt-1 font-sans text-xs text-muted-ink">{entry.detail}</p>
                {entry.link && (
                  <Link
                    href={entry.link}
                    className="mt-1 inline-block font-sans text-xs text-terracotta underline"
                  >
                    Open what it was about
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
