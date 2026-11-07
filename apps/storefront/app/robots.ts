import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl =
    process.env.NEXT_PUBLIC_STOREFRONT_URL || "http://localhost:3000";

  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/shop", "/art-forms", "/artists", "/products", "/journal", "/about", "/sell", "/custom-art"],
      disallow: [
        "/account",
        "/cart",
        "/checkout",
        "/commission-status/",
        "/admin",
        "/api",
        "/_next",
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
