/**
 * All marketplace partners — platform-wide, with status, verification state and
 * the admin-assisted link to a public maker profile.
 */

import Link from "next/link";
import { getAdminIdentity, requirePermission } from "@/app/admin/actions";
import { listAllPartners } from "@/lib/admin-marketplace/overview";

export const dynamic = "force-dynamic";

async function canView(): Promise<boolean> {
  const identity = await getAdminIdentity();
  if (!identity || identity.role === "partner") return false;
  return requirePermission("partners:read");
}

function AccessDenied() {
  return (
    <main className="py-8">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-xl border border-sand-border bg-surface p-8 text-center">
          <h1 className="font-serif text-2xl font-semibold text-deep-ink">Not available</h1>
          <p className="mt-2 font-sans text-sm text-muted-ink">
            You do not have permission to view the platform marketplace.
          </p>
        </div>
      </div>
    </main>
  );
}

function when(value: string): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default async function MarketplacePartnersPage() {
  if (!(await canView())) return <AccessDenied />;

  let partners: Awaited<ReturnType<typeof listAllPartners>> = [];
  let failed = false;
  try {
    partners = await listAllPartners();
  } catch (error) {
    console.error("Could not load marketplace partners", error);
    failed = true;
  }

  return (
    <main className="py-8">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <header className="mb-6">
          <nav className="mb-3 font-sans text-sm text-sindoor">
            <Link href="/admin/marketplace" className="hover:underline">← Marketplace</Link>
          </nav>
          <h1 className="font-serif text-3xl font-semibold tracking-tight text-deep-ink">
            Marketplace partners
          </h1>
          <p className="mt-2 font-sans text-sm text-muted-ink">
            Every partner account on the platform. A blank maker link means no
            public artist profile has been attached yet.
          </p>
        </header>

        {failed && (
          <div className="mb-6 rounded-xl border border-sand-border bg-surface p-6 font-sans text-sm text-muted-ink">
            The partner list could not be loaded. Please try again later.
          </div>
        )}

        <div className="rounded-xl border border-sand-border bg-surface overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-rang-paper/40">
                <th className="px-6 py-4 text-xs font-sans font-medium uppercase tracking-wider text-muted-ink">Partner</th>
                <th className="px-6 py-4 text-xs font-sans font-medium uppercase tracking-wider text-muted-ink">Contact</th>
                <th className="px-6 py-4 text-xs font-sans font-medium uppercase tracking-wider text-muted-ink">Status</th>
                <th className="px-6 py-4 text-xs font-sans font-medium uppercase tracking-wider text-muted-ink">Verification</th>
                <th className="px-6 py-4 text-xs font-sans font-medium uppercase tracking-wider text-muted-ink">Linked maker</th>
                <th className="px-6 py-4 text-xs font-sans font-medium uppercase tracking-wider text-muted-ink">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-border">
              {partners.length ? (
                partners.map((partner) => (
                  <tr key={partner.id} className="hover:bg-rang-paper/50">
                    <td className="px-6 py-4 font-sans text-sm text-deep-ink">
                      {partner.display_name}
                      <span className="block text-xs text-muted-ink">{partner.legal_name}</span>
                    </td>
                    <td className="px-6 py-4 font-sans text-sm text-muted-ink">{partner.contact_email}</td>
                    <td className="px-6 py-4 font-sans text-sm text-deep-ink">{partner.account_status}</td>
                    <td className="px-6 py-4 font-sans text-sm text-deep-ink">{partner.verification_status}</td>
                    <td className="px-6 py-4 font-sans text-sm">
                      {partner.artist_name ? (
                        <span className="text-deep-ink">{partner.artist_name}</span>
                      ) : (
                        <span className="text-muted-ink">Not linked</span>
                      )}
                    </td>
                    <td className="px-6 py-4 font-sans text-sm text-muted-ink">{when(partner.created_at)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <p className="font-sans text-sm text-muted-ink">
                      {failed ? "Partner data is unavailable right now." : "No partners found."}
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
