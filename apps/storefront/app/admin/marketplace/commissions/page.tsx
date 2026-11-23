/**
 * Commission policies — list + validation checklist.
 *
 * Platform-wide (never partner-scoped). Access is gated on `finance:read`.
 * The page reports configured/UNCONFIGURED honestly: a draft or a policy with
 * missing business inputs can never be described as settlement-ready.
 */

import Link from "next/link";
import { getAdminIdentity, requirePermission } from "@/app/admin/actions";
import { query } from "@/lib/db";
import {
  policyConfigured,
  validatePolicy,
} from "@/lib/finance/commission-policy";
import type { CommissionPolicy } from "@/lib/finance/types";

export const dynamic = "force-dynamic";

async function canView(): Promise<boolean> {
  const identity = await getAdminIdentity();
  if (!identity || identity.role === "partner") return false;
  return requirePermission("finance:read");
}

function AccessDenied() {
  return (
    <main className="py-8">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-xl border border-sand-border bg-surface p-8 text-center">
          <h1 className="font-serif text-2xl font-semibold text-deep-ink">Not available</h1>
          <p className="mt-2 font-sans text-sm text-muted-ink">
            You do not have permission to view commission policies.
          </p>
        </div>
      </div>
    </main>
  );
}

function when(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value as string);
  return Number.isNaN(date.getTime())
    ? "Invalid date"
    : date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
}

function rateLabel(policy: CommissionPolicy): string {
  if (policy.rate_percent !== null && policy.rate_percent !== undefined && policy.rate_percent !== "") {
    return `${policy.rate_percent}%`;
  }
  if (policy.fixed_amount !== null && policy.fixed_amount !== undefined && policy.fixed_amount !== "") {
    return `${policy.currency} ${policy.fixed_amount} / item`;
  }
  return "No rate configured";
}

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-sand-border/40 text-muted-ink border-sand-border",
  approved: "bg-leaf/10 text-leaf border-leaf/20",
  active: "bg-leaf/10 text-leaf border-leaf/20",
  archived: "bg-sindoor/10 text-sindoor border-sindoor/20",
};

export default async function CommissionPoliciesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!(await canView())) return <AccessDenied />;
  const params = await searchParams;

  let policies: CommissionPolicy[] = [];
  let failed = false;
  try {
    policies = (await query(
      "SELECT * FROM commission_policy ORDER BY created_at DESC LIMIT 200"
    )) as CommissionPolicy[];
  } catch (error) {
    console.error("Could not load commission policies", error);
    failed = true;
  }

  const configured = policyConfigured(policies);
  const hasActive = policies.some((p) => p.status === "active");

  return (
    <main className="py-8">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <header className="mb-6">
          <nav className="mb-3 font-sans text-sm text-sindoor">
            <Link href="/admin/marketplace" className="hover:underline">
              ← Marketplace
            </Link>
          </nav>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="font-serif text-3xl font-semibold tracking-tight text-deep-ink">
                Commission policies
              </h1>
              <p className="mt-2 max-w-2xl font-sans text-sm text-muted-ink">
                Versioned rules for how partner earnings are calculated. Creating
                a policy here produces a draft only — approval and activation
                are separate, authorised steps.
              </p>
            </div>
            <Link
              href="/admin/marketplace/commissions/new"
              className="rounded-md bg-sindoor px-4 py-2 font-sans text-sm font-medium text-white transition-colors hover:bg-sindoor/90"
            >
              New policy
            </Link>
          </div>
        </header>

        {params.created === "1" && (
          <div className="mb-6 rounded-md border border-green-200 bg-green-50 px-4 py-3 font-sans text-sm text-green-700">
            Draft policy saved. It is not active and cannot settle anything until
            it is approved and activated.
          </div>
        )}

        {/* Honest configuration status: nothing settles until a valid, approved,
            active policy exists inside its effective window. */}
        <section
          aria-labelledby="config-heading"
          className="mb-6 rounded-xl border border-sand-border bg-surface p-6"
        >
          <div className="flex flex-wrap items-center gap-3">
            <h2
              id="config-heading"
              className="font-serif text-lg font-semibold text-deep-ink"
            >
              Settlement configuration
            </h2>
            <span
              className={`rounded-full border px-2 py-0.5 font-sans text-[10px] uppercase tracking-[0.14em] ${
                configured
                  ? "bg-leaf/10 text-leaf border-leaf/20"
                  : "bg-sindoor/10 text-sindoor border-sindoor/20"
              }`}
            >
              {configured ? "configured" : "unconfigured"}
            </span>
          </div>
          <p className="mt-2 font-sans text-sm text-muted-ink">
            {configured
              ? "At least one valid, approved, active policy is inside its effective window."
              : "No effective policy is active, so partner earnings cannot be calculated or settled. " +
                (hasActive
                  ? "An active policy exists but is not currently usable — check its validation below."
                  : "Create a draft, confirm it against the signed agreement, then approve and activate it.")}
          </p>
          {!configured && (
            <ol className="mt-4 list-decimal space-y-1 pl-5 font-sans text-sm text-muted-ink">
              <li>Create a draft with exactly one explicit rate and all business fields.</li>
              <li>Confirm it matches the signed partner agreement and name an approver.</li>
              <li>Approve the draft, then activate the approved policy.</li>
              <li>Ensure the effective-from date has passed and effective-to has not.</li>
            </ol>
          )}
          {failed && (
            <p className="mt-3 font-sans text-xs text-sindoor">
              Policy data could not be loaded; configuration status is reported
              as UNCONFIGURED until it can be verified.
            </p>
          )}
        </section>

        <div className="overflow-hidden rounded-xl border border-sand-border bg-surface">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-rang-paper/40">
                <th className="px-4 py-3 text-xs font-sans font-medium uppercase tracking-wider text-muted-ink">Policy</th>
                <th className="px-4 py-3 text-xs font-sans font-medium uppercase tracking-wider text-muted-ink">Scope</th>
                <th className="px-4 py-3 text-xs font-sans font-medium uppercase tracking-wider text-muted-ink">Rate</th>
                <th className="px-4 py-3 text-xs font-sans font-medium uppercase tracking-wider text-muted-ink">Effective</th>
                <th className="px-4 py-3 text-xs font-sans font-medium uppercase tracking-wider text-muted-ink">Status</th>
                <th className="px-4 py-3 text-xs font-sans font-medium uppercase tracking-wider text-muted-ink">Version</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-border">
              {policies.length ? (
                policies.map((policy) => {
                  const validation = validatePolicy(policy);
                  return (
                    <tr key={policy.id} className="align-top hover:bg-rang-paper/50">
                      <td className="px-4 py-4">
                        <span className="font-sans text-sm font-medium text-deep-ink">
                          {policy.name || "Unnamed policy"}
                        </span>
                        {/* Validation checklist of missing business inputs. */}
                        <ul className="mt-2 space-y-1" aria-label={`Validation for ${policy.name}`}>
                          {validation.valid ? (
                            <li className="font-sans text-xs text-leaf">
                              ✓ All required business inputs present
                            </li>
                          ) : (
                            validation.errors.map((error) => (
                              <li key={error} className="font-sans text-xs text-sindoor">
                                ✗ {error}
                              </li>
                            ))
                          )}
                        </ul>
                      </td>
                      <td className="px-4 py-4 font-sans text-sm text-muted-ink">
                        {policy.scope}
                        {policy.scope !== "global" && (
                          <span className="block font-mono text-[11px] text-muted-ink/70">
                            {policy.scope_ref || "missing scope_ref"}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4 font-sans text-sm text-deep-ink">
                        {rateLabel(policy)}
                        <span className="block text-xs text-muted-ink">
                          {policy.rate_basis.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-4 py-4 font-sans text-sm text-muted-ink">
                        {when(policy.effective_from)} – {when(policy.effective_to)}
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`rounded-full border px-2 py-0.5 font-sans text-[10px] uppercase tracking-[0.14em] ${
                            STATUS_STYLE[policy.status] ?? STATUS_STYLE.draft
                          }`}
                        >
                          {policy.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 font-sans text-sm text-muted-ink">
                        v{policy.version}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <p className="font-sans text-sm text-muted-ink">
                      {failed
                        ? "Policy data is unavailable right now."
                        : "No commission policies yet. Create a draft to begin."}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
