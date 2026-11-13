import type { Metadata } from "next";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { SiteInteractions } from "@/components/site-interactions";
import { getPlatformModeFromEnv } from "@/lib/settings";
import { artFormSlugs } from "@/lib/slugs";
import { listArtForms } from "@/lib/site-content";

// Absolute origin for structured data. Schema.org requires fully-qualified
// URLs, and a relative one silently invalidates the whole graph.
const SITE_URL = (
  process.env.NEXT_PUBLIC_STOREFRONT_URL || "http://localhost:3000"
).replace(/\/$/, "");
import "./globals.css";

// The typefaces are self-hosted (see the @font-face block at the top of
// globals.css). They used to be loaded here with next/font/google, which turns
// a third-party network call into a build-time dependency: when Google's CSS
// endpoint hiccuped the build failed outright and wrote no BUILD_ID.

export const metadata: Metadata = {
  title: {
    template: "%s | SnehaVrinda Kala",
    default: "SnehaVrinda Kala — Art made, curated, personalized, and shared",
  },
  description:
    "A home for art in all its forms—ready-to-ship artwork, made-to-order pieces, custom commissions, artist stories, and creative kits.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_STOREFRONT_URL || "http://localhost:3000"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_IN",
    siteName: "SnehaVrinda Kala",
    title: "SnehaVrinda Kala — Art made, curated, personalized, and shared",
    description:
      "Ready-to-ship artwork, made-to-order pieces, custom commissions, artist profiles, and creative kits from Indian makers.",
    // Absolute path via metadataBase; without an og:image, shares render as a
    // bare text link with no artwork, which for an art site is a real loss.
    images: [
      {
        url: "/images/hero/hero-art.jpg",
        width: 1200,
        height: 630,
        alt: "Handmade Indian artwork from SnehaVrinda Kala",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "SnehaVrinda Kala",
    description:
      "Ready-to-ship artwork, made-to-order pieces, custom commissions, artist profiles, and creative kits.",
    images: ["/images/hero/hero-art.jpg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  keywords: [
    "Indian art",
    "handmade Indian artwork",
    "Madhubani painting",
    "Warli art",
    "Pattachitra",
    "Gond art",
    "Kalamkari",
    "folk art India",
    "original paintings",
    "custom art commission India",
    "handloom textiles",
    "Indian artisans",
  ],
  category: "art",
  authors: [{ name: "SnehaVrinda Kala" }],
  creator: "SnehaVrinda Kala",
  publisher: "SnehaVrinda Kala",
  formatDetection: { telephone: false, email: false, address: false },
  other: {
    // Points answer engines at the curated summary rather than making them
    // infer facts from rendered markup.
    "llms-txt": "/llms.txt",
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const gaMeasurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

  // The nav menu is built on the server: the header is a client component, and
  // fetching traditions per-open would flash an empty menu.
  //
  // The nav is driven by the same admin-managed rows as the homepage, so
  // renaming an art form in /admin/content updates the menu too.
  let navArtForms: {
    label: string;
    href: string;
    image?: string;
    meta?: string;
    description?: string;
  }[] = [];
  // The footer closes on a strip of the traditions, so it needs the same rows.
  let navTraditions: { name: string; slug: string; image: string }[] = [];
  try {
    const forms = await listArtForms();
    // The nav menu shows each tradition with its image and one line of origin,
    // so the menu is a small gallery rather than a list of words.
    //
    // This is the ONLY browse menu. "Discover" and "Art Forms" used to be two
    // dropdowns over the same six-part taxonomy — one linking to /shop/<cat>,
    // one to /art-forms/<slug> — which gave a visitor two near-identical menus
    // of the same pictures. They are merged here: Discover is the gallery (and
    // links to the shop, because the point of browsing is the work), and Art
    // Forms is a plain link to the traditions index, where you read instead.
    navArtForms = forms.map((form) => ({
      label: form.name,
      href: `/shop/${form.slug}`,
      image: form.image,
      meta: form.origin?.split("·")[0]?.trim() || undefined,
      description: form.description,
    }));
    navTraditions = forms.map((form) => ({
      name: form.name,
      slug: form.slug,
      image: form.image,
    }));
  } catch {
    navArtForms = artFormSlugs.map((form) => ({
      label: form.name,
      href: `/shop/${form.slug}`,
    }));
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <SiteInteractions />
        <Header
          platformMode={getPlatformModeFromEnv()}
          artForms={navArtForms}
        />
        {children}
        <Footer
          platformMode={getPlatformModeFromEnv() === "platform"}
          traditions={navTraditions}
        />
        <script
          id="schema-organization"
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              // ArtGallery is the closest schema.org type to an art house: it
              // tells search engines this is a place selling original art, not
              // a generic store.
              "@type": "ArtGallery",
              "@id": `${SITE_URL}/#organization`,
              name: "SnehaVrinda Kala",
              alternateName: "SnehaVrinda Kala — Indian Art House",
              url: SITE_URL,
              description:
                "An Indian art house selling handmade and hand-painted artwork from artists across India, with commissioned work available.",
              slogan: "Art · Culture · Conscious Living",
              logo: {
                "@type": "ImageObject",
                url: `${SITE_URL}/images/brand-mark.svg`,
              },
              image: `${SITE_URL}/images/hero/hero-art.jpg`,
              priceRange: "₹₹",
              currenciesAccepted: "INR",
              knowsAbout: [
                "Madhubani painting",
                "Warli art",
                "Pattachitra",
                "Gond art",
                "Kalamkari",
                "handloom textiles",
                "custom art commissions",
              ],
              areaServed: { "@type": "Country", name: "India" },
              sameAs: [],
            }),
          }}
        />
        <script
          id="schema-website"
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              "@id": `${SITE_URL}/#website`,
              url: SITE_URL,
              name: "SnehaVrinda Kala",
              publisher: { "@id": `${SITE_URL}/#organization` },
              inLanguage: "en-IN",
              // Lets search engines expose a search box for the site.
              potentialAction: {
                "@type": "SearchAction",
                target: {
                  "@type": "EntryPoint",
                  urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
                },
                "query-input": "required name=search_term_string",
              },
            }),
          }}
        />
        {gaMeasurementId && (
          <>
            <script
              async
              src={`https://www.googletagmanager.com/gtag/js?id=${gaMeasurementId}`}
            />
            <script
              dangerouslySetInnerHTML={{
                __html: `
                  window.dataLayer = window.dataLayer || [];
                  function gtag(){dataLayer.push(arguments);}
                  gtag('js', new Date());
                  gtag('config', '${gaMeasurementId}');
                `,
              }}
            />
          </>
        )}
      </body>
    </html>
  );
}
