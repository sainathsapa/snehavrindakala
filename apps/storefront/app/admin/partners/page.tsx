import { requireAdmin, listArtists } from "../actions";
import { hasPermission } from "@/lib/rbac";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PartnerActionButtons } from "./partner-action-buttons";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Partners | SnehaVrinda Kala Admin",
  robots: { index: false, follow: false },
};

export default async function PartnersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  await requireAdmin();
  const { q, page } = await searchParams;
  const userRole = "super_admin";

  if (!hasPermission(userRole as any, "artists:read")) {
    redirect("/admin?error=unauthorized");
  }

  let artists: any[] = [];
  let count = 0;
  try {
    const res = await listArtists({
      limit: 20,
      offset: ((parseInt(page || "1") - 1) * 20) || 0,
      q: q || undefined,
    });
    artists = res.artists;
    count = res.count;
  } catch (err) {
    console.error("Failed to load artists", err);
  }

  return (
    <main className="py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-serif font-semibold text-deep-ink tracking-tight">
              Partners & Artists
            </h1>
            <p className="text-muted-ink font-sans">
              Manage platform partners and artists.
            </p>
          </div>
          {hasPermission(userRole as any, "artists:write") && (
            <Link
              href="/admin/partners/new"
              className="px-4 py-2 bg-sindoor text-rang-paper rounded-md font-medium hover:bg-sindoor/90 transition-colors"
            >
              + Add Partner
            </Link>
          )}
        </div>

        <div className="rounded-xl border border-sand-border bg-surface overflow-hidden">
          <table className="w-full text-left divide-y divide-sand-border">
            <thead>
              <tr className="bg-surface">
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                  Partner
                </th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                  Disciplines
                </th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                  Commission
                </th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-border">
              {artists.length > 0 ? (
                artists.map((artist: any) => {
                  const isApproved = artist.status === "approved";
                  return (
                    <tr key={artist.id} className="hover:bg-rang-paper/50">
                      <td className="px-6 py-4 font-sans text-sm text-deep-ink">
                        {artist.display_name}
                      </td>
                      <td className="px-6 py-4 font-sans text-sm text-muted-ink">
                        {(artist.disciplines || []).join(", ") || "—"}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium font-sans ${
                            isApproved
                              ? "bg-leaf/10 text-leaf border border-leaf/20"
                              : "bg-sindoor/10 text-sindoor border border-sindoor/20"
                          }`}
                        >
                          {artist.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium font-sans ${
                            artist.commission_available
                              ? "bg-terracotta/10 text-terracotta border border-terracotta/20"
                              : "bg-muted-ink/10 text-muted-ink border border-muted-ink/20"
                          }`}
                        >
                          {artist.commission_available ? "Available" : "Not Available"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <PartnerActionButtons
                          artistId={artist.id}
                          isApproved={isApproved}
                          canWrite={hasPermission(userRole as any, "artists:write")}
                          canDelete={hasPermission(userRole as any, "artists:delete")}
                        />
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <p className="text-muted-ink font-sans">
                      No partners found.
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
