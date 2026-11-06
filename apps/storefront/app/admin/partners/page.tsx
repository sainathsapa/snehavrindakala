import { requireAdmin, listArtists } from "./actions";
import Link from "next/link";
import { ToggleArtistButton } from "./toggle-artist-button";

export const dynamic = "force-dynamic";

export default async function PartnersAdminPage() {
  await requireAdmin();

  const artists = await listArtists();

  return (
    <main className="py-12">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-10">
          <div>
            <p className="text-sm font-medium text-sindoor tracking-wider uppercase font-sans">
              Partner admin
            </p>
            <h1 className="text-3xl md:text-4xl font-serif font-semibold text-deep-ink tracking-tight">
              Artists &amp; partners
            </h1>
            <p className="mt-2 text-muted-ink font-sans">
              Enable or disable partners. Disabled partners are hidden from
              public discovery and cannot accept new commissions.
            </p>
          </div>
          <Link
            href="/sell"
            className="inline-flex items-center gap-2 px-6 py-3 bg-sindoor text-rang-paper rounded-xl font-semibold hover:bg-sindoor/90 focus:outline-none focus:ring-2 focus:ring-sindoor focus:ring-offset-2 transition-colors"
          >
            View public partner page
          </Link>
        </div>

        <div className="rounded-xl border border-sand-border bg-surface overflow-hidden shadow-soft">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-sand-border bg-rang-paper">
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                  Partner
                </th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                  Disciplines
                </th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider text-right">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-border">
              {artists.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    <p className="text-muted-ink font-sans">
                      No partners found. Create artist records from the Medusa
                      admin or via the API.
                    </p>
                  </td>
                </tr>
              ) : (
                artists.map((artist) => (
                  <tr
                    key={artist.id}
                    className="hover:bg-rang-paper/50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="font-sans font-medium text-deep-ink">
                        {artist.display_name}
                      </div>
                      <p className="text-xs text-muted-ink">
                        @{artist.slug}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2">
                        {(artist.disciplines ?? []).map((d) => (
                          <span
                            key={d}
                            className="px-2 py-0.5 rounded-md border border-sand-border bg-rang-paper text-xs text-deep-ink font-sans"
                          >
                            {d}
                          </span>
                        ))}
                        {!artist.disciplines?.length && (
                          <span className="text-xs text-muted-ink font-sans italic">
                            —
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium font-sans ${
                          artist.status === "approved"
                            ? "bg-leaf/10 text-leaf border border-leaf/20"
                            : artist.status === "suspended"
                              ? "bg-sindoor/10 text-sindoor border border-sindoor/20"
                              : "bg-muted-ink/10 text-muted-ink border border-muted-ink/20"
                        }`}
                      >
                        {artist.status === "approved" ? "Enabled" : "Disabled"}
                        {artist.is_verified && (
                          <span className="w-1.5 h-1.5 rounded-full bg-sindoor" />
                        )}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <ToggleArtistButton
                        id={artist.id}
                        enabled={artist.status === "approved"}
                        name={artist.display_name}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <p className="mt-6 text-xs text-muted-ink font-sans">
          Tip: Enabled partners appear in the public artist directory and can
          receive commission requests. Disabled partners are hidden from
          discovery but their existing records are preserved.
        </p>
      </div>
    </main>
  );
}
