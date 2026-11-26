import type { Metadata } from "next";
import { Link } from "@/i18n/routing";
import { SectionHeading, Card, CardContent } from "@snehavrinda-kala/ui";
import { Badge } from "@snehavrinda-kala/ui";
import { getPlatformModeFromEnv } from "@/lib/settings";
import { localeAlternates } from "@/lib/seo";
import { sellCopy } from "@/lib/page-copy";
import { getLocale } from "next-intl/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const c = sellCopy(locale);
  // The title and description were English in both languages, so /hi/sell showed
  // a Hindi page under an English tab title and an English search snippet.
  return {
    title:
      getPlatformModeFromEnv() === "platform"
        ? locale === "hi"
          ? "स्नेहवृंद कला के साथ बेचिए"
          : "Sell with SnehaVrinda Kala"
        : c.title,
    description:
      getPlatformModeFromEnv() === "platform"
        ? locale === "hi"
          ? "भारतीय कारीगरों के हाथ से बने, ऑर्डर पर बने और कमीशन किए काम के लिए एक चुना हुआ ठिकाना।"
          : "A curated home for handmade, made-to-order and commissioned work by Indian makers."
        : c.intro,
    alternates: localeAlternates("/sell", locale),
  };
}

export default async function SellPage() {
  // In marketplace mode this is the seller pitch. In single-brand mode there is
  // no roster to join, but a house that says "sell with us" nowhere is a house
  // that never hears from a maker — so the same URL answers the question a
  // craftsman actually has: how do I work with you?
  if (getPlatformModeFromEnv() !== "platform") {
    const c = sellCopy(await getLocale());

    return (
      <main className="bg-rang-paper py-12">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <p className="font-sans text-[11px] uppercase tracking-[0.3em] text-sindoor">
            {c.eyebrow}
          </p>
          <h1 className="mt-4 font-serif text-4xl leading-tight text-deep-ink">
            {c.title}
          </h1>
          <p className="mt-4 font-sans text-base leading-relaxed text-muted-ink">
            {c.intro}
          </p>

          <div className="mt-8 space-y-4 border-t border-sand-border pt-6 font-sans text-[15px] leading-relaxed text-deep-ink/90">
            <p>
              <strong className="font-serif text-lg">{c.makerHeading}</strong>{" "}
              {c.makerBody}
            </p>
            <p>
              <strong className="font-serif text-lg">{c.galleryHeading}</strong>{" "}
              {c.galleryBody}
            </p>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/partner/apply"
              className="rounded-full bg-sindoor px-6 py-3 font-sans text-sm font-medium text-rang-paper transition-colors hover:bg-sindoor/90"
            >
              {c.apply}
            </Link>
            <Link
              href="/contact"
              className="rounded-full border border-sand-border px-6 py-3 font-sans text-sm text-deep-ink transition-colors hover:border-sindoor hover:text-sindoor"
            >
              {c.contact}
            </Link>
            <Link
              href="/learn"
              className="rounded-full px-4 py-3 font-sans text-sm text-muted-ink transition-colors hover:text-sindoor"
            >
              {c.learn} →
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="py-10">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="For creators"
          title="Make art with us, reach collectors who care"
          description="SnehaVrinda Kala is a curated home for handmade, made-to-order, and commissioned work. We partner with makers whose process, quality, and story deserve a wider audience."
        />

        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              title: "Curated visibility",
              body: "Your work is presented with artist attribution, process stories, and collection context.",
            },
            {
              title: "Fair terms",
              body: "Clear review, pricing, lead-time, and payout records before anything goes live.",
            },
            {
              title: "Commission flow",
              body: "High-intent custom requests are triaged, quoted, and tracked end to end.",
            },
          ].map((item) => (
            <Card key={item.title} elevated>
              <CardContent className="p-6">
                <Badge variant="peacock">Creator benefit</Badge>
                <h3 className="mt-4 font-serif text-xl font-semibold text-deep-ink">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm text-muted-ink font-sans">{item.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-10 rounded-xl border border-border bg-surface p-8">
          <h2 className="text-2xl font-serif font-semibold text-deep-ink">
            How it works
          </h2>
          <ol className="mt-4 grid gap-4 md:grid-cols-4 text-sm text-muted-ink font-sans">
            <li>1. Submit your studio profile and portfolio.</li>
            <li>2. Our team reviews quality, capacity, and fit.</li>
            <li>3. Approved creators list products and receive commissions.</li>
            <li>4. Orders, proofs, and payouts are tracked transparently.</li>
          </ol>
          <div className="mt-8">
            <Link
              href="/seller"
              className="inline-flex items-center gap-2 px-6 py-3 bg-sindoor text-white rounded-md font-medium hover:bg-sindoor/90 transition-colors"
            >
              Start your application
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
