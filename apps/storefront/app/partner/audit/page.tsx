import { redirect } from "next/navigation";
import { requirePartnerPermission } from "@/lib/partner/context";
import { listPartnerAudit, type PartnerAuditRow } from "@/lib/partner-audit/audit";
import { formatAuditActionLabel } from "@/lib/partner-audit/labels";

export const metadata = {
  title: "Audit trail — Partner portal — SnehaVrinda Kala",
};

export const dynamic = "force-dynamic";

function formatTime(value: string | Date): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  });
}

function entityLabel(row: PartnerAuditRow): string {
  const type = row.entity_type || "—";
  return row.entity_id ? `${type} · ${row.entity_id}` : type;
}

export default async function PartnerAuditPage() {
  // Server-side gate. The partner id used by the scoped read below comes only
  // from this verified context — never from a query string, header or body.
  const ctx = await requirePartnerPermission("profile:read");
  if (!ctx) redirect("/partner/login");

  let rows: PartnerAuditRow[] = [];
  let loadError = false;
  try {
    rows = await listPartnerAudit(ctx);
  } catch (err) {
    console.error("[partner audit] page load failed", err);
    loadError = true;
  }

  return (
    <main className="min-h-screen bg-rang-paper px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <p className="text-xs font-sans uppercase tracking-[0.2em] text-sindoor">
          Partner portal
        </p>
        <h1 className="mt-2 text-3xl font-serif font-semibold text-deep-ink">
          Audit trail
        </h1>
        <p className="mt-2 text-sm font-sans text-muted-ink">
          A read-only record of actions taken in your partner account.
        </p>

        <section
          aria-label="Audit trail scope notice"
          className="mt-6 mb-6 rounded-lg border border-sand-border bg-surface p-4 text-sm font-sans text-muted-ink"
        >
          <span className="font-medium text-deep-ink">Your activity only.</span> This trail shows
          only actions performed by members of <em>your</em> partner account. It does not include
          activity from any other partner or from the platform.
        </section>

        {loadError && (
          <p
            role="alert"
            className="mb-5 rounded-lg border border-sand-border bg-surface p-4 text-sm font-sans text-sindoor"
          >
            The audit trail could not be loaded right now. Please try again shortly.
          </p>
        )}

        {rows.length === 0 ? (
          <section
            role="status"
            className="rounded-xl border border-sand-border bg-surface p-10 text-center shadow-sm"
          >
            <h2 className="text-lg font-serif font-semibold text-deep-ink">
              No activity recorded yet
            </h2>
            <p className="mx-auto mt-2 max-w-sm text-sm font-sans text-muted-ink">
              Actions such as profile updates, product submissions and team changes will appear
              here as they happen.
            </p>
          </section>
        ) : (
          <div className="overflow-hidden rounded-xl border border-sand-border bg-surface">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm font-sans">
                <thead className="text-xs uppercase tracking-wide text-muted-ink">
                  <tr>
                    <th className="px-5 py-3">Action</th>
                    <th className="px-5 py-3">Entity</th>
                    <th className="px-5 py-3">Time (UTC)</th>
                    <th className="px-5 py-3">Actor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sand-border">
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td className="px-5 py-3 font-medium text-deep-ink">
                        {formatAuditActionLabel(row.action)}
                      </td>
                      <td className="px-5 py-3 text-deep-ink">{entityLabel(row)}</td>
                      <td className="px-5 py-3 text-muted-ink">
                        <time dateTime={new Date(row.created_at).toISOString()}>
                          {formatTime(row.created_at)}
                        </time>
                      </td>
                      <td className="px-5 py-3 text-muted-ink">
                        <span className="block text-deep-ink">{row.actor_email || "—"}</span>
                        <span className="block text-xs">{row.actor_role || "—"}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <p className="mt-6 text-xs font-sans text-muted-ink">
          The trail is append-only and read-only from this portal. It shows the most recent 200
          entries for your account only.
        </p>
      </div>
    </main>
  );
}
