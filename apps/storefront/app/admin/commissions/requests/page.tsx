/**
 * Commission requests — the queue behind the buyer's status page.
 *
 * There was no admin surface for a commission at all: staff could see payouts and
 * nothing else. A request arrived, and the only way to look at it was the
 * database.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/app/admin/actions";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

interface RequestRow {
  id: string;
  reference_id: string;
  art_form: string;
  status: string;
  created_at: string;
  updates: string;
}

export default async function CommissionRequestsPage() {
  if (!(await requireAdmin())) redirect("/admin/login");

  let rows: RequestRow[] = [];
  let failed = false;
  try {
    rows = await query<RequestRow>(`
      SELECT cr.id, cr.reference_id, COALESCE(cr.art_form, '') AS art_form,
             cr.status, cr.created_at,
             (SELECT COUNT(*) FROM commission_milestone m
               WHERE m.commission_request_id = cr.id AND m.deleted_at IS NULL) AS updates
        FROM commission_request cr
       WHERE cr.deleted_at IS NULL
       ORDER BY cr.created_at DESC
       LIMIT 100
    `);
  } catch (error) {
    console.error("Could not read commission requests", error);
    failed = true;
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-serif text-2xl text-ink">Commission requests</h1>
        <p className="mt-1 max-w-2xl font-sans text-sm text-ink/60">
          Each request has a status page the buyer can revisit. Open one to publish
          studio updates: a dated line and, if you have one, a photograph.
        </p>
      </header>

      {failed ? (
        <p className="rounded border border-sand-border p-4 font-sans text-sm text-ink/60">
          The requests could not be read right now.
        </p>
      ) : rows.length === 0 ? (
        <p className="rounded border border-dashed border-sand-border p-6 font-sans text-sm text-ink/60">
          No commission requests yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded border border-sand-border">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-sand-border bg-white/60">
                {["Reference", "Tradition", "Status", "Updates", "Received", ""].map(
                  (heading) => (
                    <th
                      key={heading}
                      className="px-3 py-2 font-sans text-[10px] uppercase tracking-wider text-ink/50"
                    >
                      {heading}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-sand-border/60 last:border-0">
                  <td className="px-3 py-2 font-mono text-xs text-ink">
                    {row.reference_id}
                  </td>
                  <td className="px-3 py-2 font-sans text-xs text-ink/70">
                    {row.art_form || "—"}
                  </td>
                  <td className="px-3 py-2 font-sans text-xs text-ink/70">{row.status}</td>
                  <td className="px-3 py-2 font-sans text-xs text-ink/70">
                    {Number(row.updates)}
                  </td>
                  <td className="px-3 py-2 font-sans text-xs text-ink/60">
                    {new Date(row.created_at).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      href={`/admin/commissions/requests/${row.id}`}
                      className="font-sans text-[11px] uppercase tracking-wider text-terracotta underline-offset-2 hover:underline"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
