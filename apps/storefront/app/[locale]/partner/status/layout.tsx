import type { Metadata } from "next";
import { localeAlternates } from "@/lib/seo";

/**
 * Metadata for the application-status page.
 *
 * The page itself is a client component — it polls the status endpoint — and a
 * client component cannot export `metadata`. Without this file the route
 * inherited the root layout's title and description, so someone checking their
 * application saw the shop's home title in the tab, and a search engine saw a
 * second page competing with the homepage for it. The page is also kept out of
 * the index: it is a lookup screen, not a destination.
 */
/**
 * Per-locale metadata.
 *
 * A static `metadata` object cannot see the locale, so the canonical was
 * always the English URL — on a Hindi page that says "index the English
 * version instead", and the Hindi page never ranks despite correct
 * hreflang. Reading `params` fixes it.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return {
      title: "Application status · SnehaVrinda Kala",
      description:
        "Check where your partnership application stands using the reference we sent you. The page updates itself while the studio reviews your details.",
      alternates: localeAlternates("/partner/status", locale),
      robots: { index: false, follow: true },
  };
}

export default function PartnerStatusLayout({ children }: { children: React.ReactNode }) {
  return children;
}
