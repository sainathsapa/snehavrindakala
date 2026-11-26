import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/routing";
import { getLocale } from "next-intl/server";
import { listRooms, roomBySlug } from "@/lib/rooms-news";
import { listCatalogueFor } from "@/lib/catalogue";
import { localeAlternates } from "@/lib/seo";

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const room = await roomBySlug(slug, locale);
  if (!room) return { title: "Room not found" };
  return {
    title: `${room.title} · SnehaVrinda Kala`,
    description: room.subtitle || room.body.slice(0, 160),
    alternates: localeAlternates(`/rooms/${slug}`),
  };
}

/**
 * One room.
 *
 * A room is a wall, so the page is a wall text followed by what hangs on it. The
 * work is matched by collection handle, and a room with nothing in it says so
 * rather than rendering an empty grid — an exhibition being assembled is a real
 * state, not an error.
 */
export default async function RoomPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const room = await roomBySlug(slug, locale);
  if (!room) notFound();

  const works = room.collection ? await listCatalogueFor([room.collection], locale) : [];
  const paragraphs = room.body.split(/\n{2,}/).filter(Boolean);

  return (
    <main className="bg-rang-paper pb-24">
      <header className="relative border-b border-sand-border">
        {room.image ? (
          <div className="relative h-[42vh] min-h-[16rem] w-full overflow-hidden bg-surface sm:h-[52vh]">
            <Image
              src={room.image}
              alt=""
              fill
              priority
              sizes="100vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-deep-ink/70 via-deep-ink/20 to-transparent" />
          </div>
        ) : null}

        <div className={`mx-auto max-w-3xl px-5 sm:px-8 ${room.image ? "-mt-24 relative" : "pt-14"}`}>
          {room.kicker ? (
            <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.3em] text-rang-paper sm:text-haldi">
              {room.kicker}
            </p>
          ) : null}
          <h1
            className={`mt-3 font-serif text-3xl leading-tight sm:text-5xl ${
              room.image ? "text-rang-paper" : "text-deep-ink"
            }`}
          >
            {room.title}
          </h1>
          {room.subtitle ? (
            <p
              className={`mt-3 max-w-xl font-serif text-lg italic ${
                room.image ? "text-rang-paper/85" : "text-muted-ink"
              }`}
            >
              {room.subtitle}
            </p>
          ) : null}
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-5 pt-12 sm:px-8">
        {paragraphs.length > 0 ? (
          <div className="space-y-5 font-sans text-[17px] leading-[1.75] text-deep-ink/90">
            {paragraphs.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
        ) : null}

        <div className="mt-14 border-t border-sand-border pt-8">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="font-serif text-2xl text-deep-ink">In this room</h2>
            <span className="font-sans text-xs uppercase tracking-[0.16em] text-muted-ink">
              {works.length} {works.length === 1 ? "work" : "works"}
            </span>
          </div>

          {works.length === 0 ? (
            <p className="mt-5 font-sans text-sm leading-relaxed text-muted-ink">
              The room is being hung. Work for it is either still at the bench or not yet
              photographed —{" "}
              <Link href="/contact" className="text-sindoor underline underline-offset-4">
                write to the studio
              </Link>{" "}
              if you would like to be told when it opens.
            </p>
          ) : (
            <ul className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3">
              {works.map((work) => (
                <li key={work.handle}>
                  <Link href={`/shop/${work.handle}`} className="group block">
                    <div className="relative aspect-[4/5] overflow-hidden bg-surface ring-1 ring-sand-border/50">
                      {work.image ? (
                        <Image
                          src={work.image}
                          alt={work.title}
                          fill
                          sizes="(max-width: 640px) 45vw, 240px"
                          className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                        />
                      ) : null}
                    </div>
                    <p className="mt-2 font-serif text-sm leading-snug text-deep-ink group-hover:text-kumkum">
                      {work.title}
                    </p>
                    {work.price ? (
                      <p className="font-sans text-xs text-muted-ink">
                        {new Intl.NumberFormat(locale === "hi" ? "hi-IN" : "en-IN", {
                          style: "currency",
                          currency: work.currency || "INR",
                          maximumFractionDigits: 0,
                        }).format(work.price / 100)}
                      </p>
                    ) : (
                      <p className="font-sans text-xs text-muted-ink">Enquire</p>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="mt-12 font-sans text-sm">
          <Link href="/rooms" className="text-sindoor underline underline-offset-4">
            ← All rooms
          </Link>
        </p>
      </div>
    </main>
  );
}
