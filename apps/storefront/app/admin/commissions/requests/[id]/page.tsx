/**
 * One commission, and its studio updates.
 *
 * The buyer's page is the destination; this is the only place the updates are
 * written, so the two cannot drift apart.
 */

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAdmin } from "@/app/admin/actions";
import { queryResult } from "@/lib/db";
import { isUuid, listMilestones } from "@/lib/commission-progress";
import { StudioUpdateForm } from "@/components/studio-update-form";
import { removeUpdateAction } from "../actions";

export const dynamic = "force-dynamic";

interface RequestDetail {
  id: string;
  reference_id: string;
  art_form: string;
  brief: string;
  status: string;
  budget_range: string;
  created_at: string;
}

export default async function CommissionRequestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await requireAdmin())) redirect("/admin/login");

  const { id } = await params;
  if (!isUuid(id)) notFound();

  let request: RequestDetail | null = null;
  try {
    const result = await queryResult<RequestDetail>(
      `SELECT id, reference_id, COALESCE(art_form,'') AS art_form,
              COALESCE(brief,'') AS brief, status,
              COALESCE(budget_range,'') AS budget_range, created_at
         FROM commission_request WHERE id=$1 AND deleted_at IS NULL`,
      [id]
    );
    request = result.rows[0] ?? null;
  } catch (error) {
    console.error("Could not read the commission request", error);
  }

  if (!request) notFound();

  const updates = await listMilestones(id).catch(() => []);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl text-ink">
            Commission {request.reference_id}
          </h1>
          <p className="mt-1 font-sans text-sm text-ink/60">
            {request.art_form || "Tradition not stated"} · {request.status}
            {request.budget_range ? ` · ${request.budget_range}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href={`/commission-status/${request.reference_id}`}
            target="_blank"
            rel="noreferrer"
            className="font-sans text-[11px] uppercase tracking-wider text-terracotta underline-offset-2 hover:underline"
          >
            Buyer&rsquo;s page
          </Link>
          <Link
            href="/admin/commissions/requests"
            className="font-sans text-[11px] uppercase tracking-wider text-ink/50 underline-offset-2 hover:underline"
          >
            All requests
          </Link>
        </div>
      </header>

      {request.brief && (
        <section className="rounded border border-sand-border bg-white/60 p-4">
          <p className="font-sans text-[10px] uppercase tracking-wider text-ink/50">
            Brief
          </p>
          <p className="mt-1 whitespace-pre-wrap font-sans text-sm text-ink/80">
            {request.brief}
          </p>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="font-serif text-lg text-ink">Studio updates</h2>
        <p className="max-w-2xl font-sans text-sm text-ink/60">
          Only what is written here appears on the buyer&rsquo;s page. Nothing is
          generated, so an empty list means the buyer sees no updates rather than a
          sentence nobody wrote.
        </p>

        {updates.length === 0 ? (
          <p className="rounded border border-dashed border-sand-border p-4 font-sans text-sm text-ink/60">
            No updates published yet.
          </p>
        ) : (
          <ol className="space-y-3">
            {updates.map((update) => (
              <li
                key={update.id}
                className="rounded border border-sand-border bg-white/60 p-4"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-serif text-base text-ink">{update.name}</p>
                  <p className="font-sans text-xs text-ink/50">
                    {new Date(update.created_at).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
                {update.description && (
                  <p className="mt-1 whitespace-pre-wrap font-sans text-sm text-ink/70">
                    {update.description}
                  </p>
                )}
                {update.proof_url && (
                  <p className="mt-2 font-sans text-xs text-ink/50">
                    Photograph: <code>{update.proof_url}</code>
                  </p>
                )}
                <form action={removeUpdateAction} className="mt-3">
                  <input type="hidden" name="milestone" value={update.id} />
                  <input type="hidden" name="commission" value={request.id} />
                  <button
                    type="submit"
                    className="font-sans text-[11px] uppercase tracking-wider text-ink/40 underline-offset-2 hover:text-[#8a2c14] hover:underline"
                  >
                    Withdraw
                  </button>
                </form>
              </li>
            ))}
          </ol>
        )}

        <StudioUpdateForm commissionId={request.id} />
      </section>
    </div>
  );
}
