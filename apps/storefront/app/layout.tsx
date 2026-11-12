import type { Metadata } from "next";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { getPlatformModeFromEnv } from "@/lib/settings";
import { artFormSlugs } from "@/lib/slugs";
import { listCatalogueCollections } from "@/lib/catalogue";
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
  },
  twitter: {
    card: "summary",
    title: "SnehaVrinda Kala",
    description:
      "Ready-to-ship artwork, made-to-order pieces, custom commissions, artist profiles, and creative kits.",
  },
  robots: {
    index: true,
    follow: true,
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
  let collections: { name: string; count: number }[] = [];
  try {
    collections = await listCatalogueCollections();
  } catch {
    // A nav menu must never take the page down.
  }

  const navArtForms = artFormSlugs.map((form) => ({
    label: form.name,
    href: `/shop/${form.slug}`,
  }));

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${serif.variable} ${sans.variable} font-sans antialiased`}>
        <Header
          platformMode={getPlatformModeFromEnv()}
          artForms={navArtForms}
          collections={collections}
        />
        {children}
        <Footer />
        <script
          id="schema-organization"
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "SnehaVrinda Kala",
              url: process.env.NEXT_PUBLIC_STOREFRONT_URL || "http://localhost:3000",
              logo: "/images/brand-mark.svg",
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
              url: process.env.NEXT_PUBLIC_STOREFRONT_URL || "http://localhost:3000",
              name: "SnehaVrinda Kala",
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
