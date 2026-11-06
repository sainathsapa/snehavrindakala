import { medusa } from "@/lib/medusa";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ArtistProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  let artist: any = null;
  try {
    const { artist: artistData } = await medusa.getArtist(slug);
    artist = artistData;
  } catch (err) {
    notFound();
  }

  if (!artist) {
    notFound();
  }

  return (
    <main className="py-10">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <nav className="mb-8 text-sm text-muted-ink font-sans">
          <Link href="/artists" className="text-sindoor transition-colors">
            ← Back to artists
          </Link>
        </nav>

        <div className="flex flex-col lg:flex-row gap-12">
          <div className="lg:w-1/3">
            <div className="relative aspect-square rounded-xl border border-sand-border bg-surface overflow-hidden mb-6">
              {artist.portrait_media_id ? (
                <img
                  src={`/images/artists/${artist.portrait_media_id}.jpg`}
                  alt={artist.display_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-rang-paper flex items-center justify-center">
                  <span className="text-muted-ink">Artist portrait</span>
                </div>
              )}
            </div>

            {artist.commission_available && (
              <div className="px-3 py-1 rounded-full bg-terracotta/10 text-terracotta text-xs font-medium border border-terracotta/20 mb-6">
                Available for commissions
              </div>
            )}

            {artist.is_verified && (
              <div className="px-3 py-1 rounded-full bg-indigo/10 text-indigo text-xs font-medium border border-indigo/20 mb-6">
                Verified artist
              </div>
            )}
          </div>

          <div className="flex-1">
            <h1 className="text-4xl md:text-5xl font-serif font-semibold text-deep-ink tracking-tight mb-2">
              {artist.display_name}
            </h1>
            {artist.bio && (
              <p className="text-lg text-muted-ink font-sans leading-relaxed mb-6">
                {artist.bio}
              </p>
            )}

            <div className="space-y-6">
              {artist.disciplines && artist.disciplines.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-deep-ink uppercase tracking-wider mb-3">
                    Disciplines
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {artist.disciplines.map((d: string) => (
                      <span
                        key={d}
                        className="px-3 py-1 rounded-md border border-sand-border bg-rang-paper text-sm text-muted-ink"
                      >
                        {d}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {artist.techniques && artist.techniques.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-deep-ink uppercase tracking-wider mb-3">
                    Techniques
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {artist.techniques.map((t: string) => (
                      <span
                        key={t}
                        className="px-3 py-1 rounded-md border border-sand-border bg-rang-paper text-sm text-muted-ink"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
