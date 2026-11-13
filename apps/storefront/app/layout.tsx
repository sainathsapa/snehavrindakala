import type { Metadata } from "next";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { SiteInteractions } from "@/components/site-interactions";
import { getPlatformModeFromEnv } from "@/lib/settings";
import { artFormSlugs } from "@/lib/slugs";
import { listCatalogueCollections } from "@/lib/catalogue";
import { listArtForms, listFeaturedCategories } from "@/lib/site-content";

// Absolute origin for structured data. Schema.org requires fully-qualified
// URLs, and a relative one silently invalidates the whole graph.
const SITE_URL = (
  process.env.NEXT_PUBLIC_STOREFRONT_URL || "http://localhost:3000"
).replace(/\/$/, "");
import "./globals.css";

const serif = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-serif",
  weight: ["400", "500", "600", "700"],
});

const sans = Manrope({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
});

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

  // Nav menus are built on the server: the header is a client component, and
  // fetching catalogue collections per-open would flash an empty menu.
  let fallbackCollections: { label: string; href: string }[] = [];
  try {
    fallbackCollections = (await listCatalogueCollections()).map((entry) => ({
      label: entry.name,
      href: `/shop/${entry.name
        .toLowerCase()
        .replace(/&/g, "and")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")}`,
    }));
  } catch {
    // A nav menu must never take the page down.
  }

  // The nav is driven by the same admin-managed rows as the homepage, so
  // renaming an art form in /admin/content updates the menu too.
  let navArtForms: { label: string; href: string }[] = [];
  let navCollections: { label: string; href: string }[] = [];
  try {
    const [forms, featured] = await Promise.all([
      listArtForms(),
      listFeaturedCategories(),
    ]);
    navArtForms = forms.map((form) => ({
      label: form.name,
      href: `/shop/${form.slug}`,
    }));
    navCollections = featured.map((category) => ({
      label: category.label,
      href: category.href,
    }));
  } catch {
    navArtForms = artFormSlugs.map((form) => ({
      label: form.name,
      href: `/shop/${form.slug}`,
    }));
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${serif.variable} ${sans.variable} font-sans antialiased`}>
        <SiteInteractions />
        <Header
          platformMode={getPlatformModeFromEnv()}
          artForms={navArtForms}
          collections={navCollections.length > 0 ? navCollections : fallbackCollections}
        />
        {children}
        <Footer platformMode={getPlatformModeFromEnv() === "platform"} />
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
