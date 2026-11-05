import { medusa } from "@/lib/medusa";
import Link from "next/link";

export default async function ArtistsPage() {
  let artists: any[] = [];
  try {
    const { artists: artistsData } = await medusa.listArtists({ limit: 100 });
    artists = artistsData;
  } catch (err) {
    console.error("Failed to load artists", err);
  }

  return (
    <main className="py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl md:text-4xl font-serif font-semibold text-ink mb-8">
          Artists &amp; makers
        </h1>
        <p className="mb-8 text-lg text-muted font-sans leading-relaxed">
          Meet the artists and craft partners behind SnehaVrinda Kala. Each
          artist profile shows their work, techniques, and commission
          availability.
        </p>

        {artists.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {artists.map((artist) => (
              <Link
                key={artist.id}
                href={`/artists/${artist.slug}`}
                className="block rounded-xl border border-border bg-surface p-6 hover:shadow-md transition-shadow"
              >
                <div className="mb-4">
                  {artist.portrait_media_id ? (
                    <img
                      src={`/images/artists/${artist.portrait_media_id}.jpg`}
                      alt={artist.display_name}
                      className="w-full h-48 object-cover rounded-lg"
                    />
                  ) : (
                    <div className="w-full h-48 bg-paper rounded-lg flex items-center justify-center">
                      <span className="text-muted">Portrait</span>
                    </div>
                  )}
                </div>
                <h3 className="text-xl font-serif font-semibold text-ink mb-2">
                  {artist.display_name}
                </h3>
                <p className="text-sm text-muted font-sans mb-4">
                  {(artist.disciplines || []).slice(0, 3).join(", ")}
                </p>
                <div className="flex items-center gap-2 text-xs font-medium">
                  {artist.commission_available ? (
                    <span className="px-2 py-0.5 rounded bg-terracotta/10 text-terracotta">
                      Commissions open
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-paper text-muted">
                      Not accepting
                    </span>
                  )}
                  {artist.is_verified && (
                    <span className="px-2 py-0.5 rounded bg-indigo/10 text-indigo">
                      Verified
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-lg text-muted font-sans mb-6">
              No artists found. Connect the Medusa backend to load artist data.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
