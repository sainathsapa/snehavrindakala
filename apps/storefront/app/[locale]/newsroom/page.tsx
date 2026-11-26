import type { Metadata } from "next";
import Image from "next/image";
import { getLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { listNews, safeExternalUrl } from "@/lib/rooms-news";
import { PageHeader } from "@/components/page-header";
import { BotanicalRule } from "@/components/ornaments";
import { localeAlternates } from "@/lib/seo";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Newsroom · SnehaVrinda Kala",
  description:
    "Press releases, coverage and announcements from the studio — each one with the outlet it appeared in and a link to the original.",
  alternates: localeAlternates("/newsroom"),
};

const KIND_LABEL: Record<string, string> = {
  press: "Press release",
  coverage: "Coverage",
  announcement: "Announcement",
};

function dateLabel(value: string, locale: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale === "hi" ? "hi-IN" : "en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export default async function NewsroomPage() {
  const locale = await getLocale();
  const items = await listNews(locale);
  const [lead, ...rest] = items;

  return (
    <main className="bg-rang-paper pb-24">
      <PageHeader
        eyebrow="Newsroom"
        title="What has been written, and what we have said"
        intro="Coverage keeps its outlet and a link to the original. Announcements are the studio's own words."
        breadcrumb={[{ label: "Home", href: "/" }, { label: "Newsroom" }]}
      />

      <div className="mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-12">
        {!lead ? (
          <div className="flex flex-col items-center py-20 text-center">
            <BotanicalRule className="mb-6 text-terracotta" />
            <p className="max-w-md font-serif text-xl leading-relaxed text-deep-ink">
              The newsroom is quiet for now.
            </p>
            <p className="mt-2 max-w-md font-sans text-sm leading-relaxed text-muted-ink">
              Press enquiries are answered by the studio directly — the address on the
              contact page reaches a person, not a form queue.
            </p>
            <Link
              href="/contact"
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-kumkum px-6 py-3 font-sans text-sm font-medium text-rang-paper transition-colors hover:bg-sindoor"
            >
              Press enquiries <span aria-hidden>→</span>
            </Link>
          </div>
        ) : (
          <>
            {/* The lead item gets a plate; everything else is a dated line list. */}
            <article className="border-b border-sand-border pb-10">
              <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-center">
                {lead.image ? (
                  <div className="relative aspect-[16/10] overflow-hidden bg-surface ring-1 ring-sand-border/50">
                    <Image
                      src={lead.image}
                      alt=""
                      fill
                      priority
                      sizes="(max-width: 1024px) 92vw, 640px"
                      className="object-cover"
                    />
                  </div>
                ) : null}
                <div>
                  <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.24em] text-sindoor">
                    {KIND_LABEL[lead.kind] || "News"}
                    {lead.outlet ? ` · ${lead.outlet}` : ""}
                  </p>
                  <h2 className="mt-3 font-serif text-3xl leading-tight text-deep-ink sm:text-4xl">
                    <Link href={`/newsroom/${lead.slug}`} className="hover:text-kumkum">
                      {lead.title}
                    </Link>
                  </h2>
                  {lead.summary ? (
                    <p className="mt-3 font-sans text-[15px] leading-relaxed text-muted-ink">
                      {lead.summary}
                    </p>
                  ) : null}
                  <p className="mt-4 font-sans text-xs uppercase tracking-[0.16em] text-muted-ink">
                    {dateLabel(lead.published_at, locale)}
                  </p>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <Link
                      href={`/newsroom/${lead.slug}`}
                      className="font-sans text-sm text-sindoor underline underline-offset-4"
                    >
                      Read
                    </Link>
                    {safeExternalUrl(lead.url) ? (
                      <a
                        href={safeExternalUrl(lead.url) as string}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-sans text-sm text-muted-ink underline underline-offset-4 hover:text-sindoor"
                      >
                        {lead.outlet ? `Read at ${lead.outlet}` : "Read the original"} ↗
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>
            </article>

            {rest.length > 0 ? (
              <ul className="mt-10 divide-y divide-sand-border">
                {rest.map((item) => (
                  <li key={item.id} className="py-6">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:gap-6">
                      <p className="w-40 shrink-0 font-sans text-xs uppercase tracking-[0.16em] text-muted-ink">
                        {dateLabel(item.published_at, locale)}
                      </p>
                      <div className="min-w-0">
                        <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-sindoor">
                          {KIND_LABEL[item.kind] || "News"}
                          {item.outlet ? ` · ${item.outlet}` : ""}
                        </p>
                        <h3 className="mt-1 font-serif text-xl leading-snug text-deep-ink">
                          <Link href={`/newsroom/${item.slug}`} className="hover:text-kumkum">
                            {item.title}
                          </Link>
                        </h3>
                        {item.summary ? (
                          <p className="mt-1 max-w-2xl font-sans text-sm leading-relaxed text-muted-ink">
                            {item.summary}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}
