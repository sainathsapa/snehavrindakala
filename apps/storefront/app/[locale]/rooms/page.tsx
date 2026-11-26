import type { Metadata } from "next";
import Image from "next/image";
import { getLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { listRooms } from "@/lib/rooms-news";
import { PageHeader } from "@/components/page-header";
import { BotanicalRule } from "@/components/ornaments";
import { localeAlternates } from "@/lib/seo";
import { roomsCopy } from "@/lib/page-copy";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Rooms · SnehaVrinda Kala",
  description:
    "The rooms of the house: work gathered by season and theme, with the wall text that explains why these pieces were made together.",
  alternates: localeAlternates("/rooms"),
};

export default async function RoomsIndex() {
  const locale = await getLocale();
  const rooms = await listRooms(locale);
  const c = roomsCopy(locale);

  return (
    <main className="bg-rang-paper pb-24">
      <PageHeader
        eyebrow={c.eyebrow}
        title={c.title}
        intro={c.intro}
        breadcrumb={[{ label: c.crumbHome, href: "/" }, { label: c.crumbRooms }]}
      />

      <div className="mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-12">
        {rooms.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-center">
            <BotanicalRule className="mb-6 text-terracotta" />
            <p className="max-w-md font-serif text-xl leading-relaxed text-deep-ink">
              {c.emptyTitle}
            </p>
            <p className="mt-2 max-w-sm font-sans text-sm text-muted-ink">
              {c.emptyBody}
            </p>
            <Link
              href="/shop"
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-kumkum px-6 py-3 font-sans text-sm font-medium text-rang-paper transition-colors hover:bg-sindoor"
            >
              {c.browse} <span aria-hidden>→</span>
            </Link>
          </div>
        ) : (
          <ul className="grid gap-x-8 gap-y-14 sm:grid-cols-2">
            {rooms.map((room) => (
              <li key={room.id}>
                <Link href={`/rooms/${room.slug}`} className="group block">
                  <div className="relative aspect-[16/10] overflow-hidden bg-surface ring-1 ring-sand-border/50">
                    {room.image ? (
                      <Image
                        src={room.image}
                        alt=""
                        fill
                        sizes="(max-width: 640px) 92vw, 620px"
                        className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <span className="font-serif text-sm italic text-muted-ink/60">
                          {c.roomToOpen}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="mt-4 border-t border-sand-border/60 pt-3">
                    {room.kicker ? (
                      <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.22em] text-sindoor">
                        {room.kicker}
                      </p>
                    ) : null}
                    <h2 className="mt-1 font-serif text-2xl leading-tight text-deep-ink transition-colors group-hover:text-kumkum">
                      {room.title}
                    </h2>
                    {room.subtitle ? (
                      <p className="mt-1 font-serif text-sm italic text-muted-ink">
                        {room.subtitle}
                      </p>
                    ) : null}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
