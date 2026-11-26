import { getTranslations } from "next-intl/server";
import { medusa } from "@/lib/medusa";
import { localeAlternates } from "@/lib/seo";
import { Link } from "@/i18n/routing";
import { PageHeader } from "@/components/page-header";
import { BotanicalRule } from "@/components/ornaments";
import { getPlatformModeFromEnv } from "@/lib/settings";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Artists & Makers",
  description:
    "Meet the Indian artists and craft partners behind SnehaVrinda Kala — their traditions, techniques, and whether they are currently taking commissions.",
  alternates: localeAlternates("/artists"),
};

export default async function ArtistsPage() {
  const t = await getTranslations("artists");
  // This page used to 404 in single-brand mode on the argument that a house is
  // the only seller. That was wrong in practice: an art house that names its
  // makers cannot send people to a 404 from its own footer. The directory now
  // renders in both modes, and when no maker has a profile yet it says so
  // honestly instead of disappearing.
  const marketplace = getPlatformModeFromEnv() === "platform";

  let artists: any[] = [];
  try {
    const { artists: artistsData } = await medusa.listArtists({ limit: 100 });
    artists = artistsData;
  } catch (err) {
    console.error("Failed to load artists", err);
  }

  return (
    <main className="bg-rang-paper">
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        intro={t("intro")}
        breadcrumb={[{ label: t("home"), href: "/" }, { label: t("title") }]}
      />

      <section className="pb-20">
        <div className="mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-12">
          {artists.length > 0 ? (
            <div className="grid grid-cols-1 gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
              {artists.map((artist) => (
                <Link
                  key={artist.id}
                  href={`/artists/${artist.slug}`}
                  className="group block focus:outline-none"
                >
                  <div className="relative aspect-[4/5] overflow-hidden bg-surface ring-1 ring-sand-border/50">
                    {artist.portrait_media_id ? (
                      <img
                        src={`/images/artists/${artist.portrait_media_id}.jpg`}
                        alt={artist.display_name}
                        className="h-full w-full object-cover transition-opacity duration-500 group-hover:opacity-90"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <span className="font-serif text-sm italic text-muted-ink/60">
                          Portrait to follow
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Label under the plate, as on a gallery wall. */}
                  <div className="mt-4 border-t border-sand-border/60 pt-3">
                    <h3 className="font-serif text-xl font-semibold leading-tight text-deep-ink transition-colors group-hover:text-kumkum">
                      {artist.display_name}
                    </h3>
                    <p className="mt-1 font-sans text-xs italic text-muted-ink">
                      {(artist.disciplines || []).slice(0, 3).join(" · ")}
                    </p>
                    <p className="mt-2 font-sans text-[11px] uppercase tracking-[0.16em]">
                      {artist.commission_available ? (
                        <span className="text-kumkum">{t("commissionsOpen")}</span>
                      ) : (
                        <span className="text-muted-ink/70">{t("notAccepting")}</span>
                      )}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <BotanicalRule className="mb-6 text-terracotta" />
              <p className="max-w-sm font-serif text-xl leading-relaxed text-deep-ink">
                {t("empty")}
              </p>
              <p className="mt-2 font-sans text-sm text-muted-ink">
                {marketplace
                  ? "Makers join by application, and each profile is written with the artist."
                  : "The studio works with a small circle of makers across Rajasthan and beyond. Every work in the collection names the hands that made it."}
              </p>
              <Link
                href="/shop"
                className="mt-8 inline-flex items-center gap-2 rounded-full bg-kumkum px-6 py-3 font-sans text-sm font-medium text-rang-paper transition-colors hover:bg-sindoor"
              >
                Browse the collection
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
