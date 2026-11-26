import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { newsBySlug, safeExternalUrl } from "@/lib/rooms-news";
import { localeAlternates } from "@/lib/seo";
import { newsroomCopy } from "@/lib/page-copy";

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const item = await newsBySlug(slug, locale);
  if (!item) return { title: "Not found" };
  return {
    title: `${item.title} · SnehaVrinda Kala`,
    description: item.summary || item.body.slice(0, 160),
    alternates: localeAlternates(`/newsroom/${slug}`),
  };
}

/** Kind labels come from the page copy, so Hindi gets Hindi names. */
function kindLabel(kind: string, c: ReturnType<typeof newsroomCopy>): string {
  const map: Record<string, string> = {
    press: c.kinds.press,
    coverage: c.kinds.coverage,
    announcement: c.kinds.announcement,
  };
  return map[kind] ?? c.kinds.news;
}

export default async function NewsItemPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const item = await newsBySlug(slug, locale);
  if (!item) notFound();
  const c = newsroomCopy(locale);

  const paragraphs = item.body.split(/\n{2,}/).filter(Boolean);
  const external = safeExternalUrl(item.url);
  const date = new Date(item.published_at);
  const dateText = Number.isNaN(date.getTime())
    ? ""
    : new Intl.DateTimeFormat(locale === "hi" ? "hi-IN" : "en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(date);

  return (
    <main className="bg-rang-paper pb-24">
      <article className="mx-auto max-w-3xl px-5 pt-12 sm:px-8">
        <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.24em] text-sindoor">
          {kindLabel(item.kind, c)}
          {item.outlet ? ` · ${item.outlet}` : ""}
        </p>
        <h1 className="mt-3 font-serif text-3xl leading-tight text-deep-ink sm:text-5xl">
          {item.title}
        </h1>
        <p className="mt-4 font-sans text-xs uppercase tracking-[0.16em] text-muted-ink">
          {dateText}
        </p>

        {item.image ? (
          <div className="relative mt-8 aspect-[16/9] overflow-hidden bg-surface ring-1 ring-sand-border/50">
            <Image
              src={item.image}
              alt=""
              fill
              priority
              sizes="(max-width: 768px) 92vw, 720px"
              className="object-cover"
            />
          </div>
        ) : null}

        {item.summary ? (
          <p className="mt-8 border-l-2 border-sindoor pl-4 font-serif text-lg italic leading-relaxed text-deep-ink/85">
            {item.summary}
          </p>
        ) : null}

        {paragraphs.length > 0 ? (
          <div className="mt-8 space-y-5 font-sans text-[17px] leading-[1.75] text-deep-ink/90">
            {paragraphs.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
        ) : null}

        {external ? (
          <p className="mt-8 font-sans text-sm">
            <a
              href={external}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sindoor underline underline-offset-4"
            >
              {item.outlet ? `${c.readOriginal} · ${item.outlet}` : c.readOriginal} ↗
            </a>
          </p>
        ) : item.url ? (
          // A non-http "link" is never followed: it is shown as text so the record
          // of where something appeared is still complete.
          <p className="mt-8 font-sans text-xs text-muted-ink">{item.url}</p>
        ) : null}

        <p className="mt-12 border-t border-sand-border pt-6 font-sans text-sm">
          <Link href="/newsroom" className="text-sindoor underline underline-offset-4">
            ← {c.backToNewsroom}
          </Link>
        </p>
      </article>
    </main>
  );
}
