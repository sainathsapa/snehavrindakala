import type { MetadataRoute } from "next";

const baseUrl = (
  process.env.NEXT_PUBLIC_STOREFRONT_URL || "http://localhost:3000"
).replace(/\/$/, "");

/**
 * Crawler policy.
 *
 * The storefront is public and wants to be indexed, so the rules are mostly
 * permissive. What is closed off is anything private or transactional: the
 * admin panel, cart, checkout, account pages, order and commission tokens, and
 * the API. Those either expose personal data or are worthless to a crawler.
 *
 * AI crawlers are allowed but explicitly pointed at /llms.txt, which gives them
 * a curated, factual summary instead of letting them guess from rendered HTML.
 */
export default function robots(): MetadataRoute.Robots {
  const disallow = [
    "/admin",
    "/admin/",
    "/api",
    "/api/",
    "/account",
    "/cart",
    "/checkout",
    "/order/",
    "/commission-status/",
    "/login",
    "/_next/",
    "/search",
  ];

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow,
      },
      // Answer engines: allowed to read the public catalogue, kept out of
      // anything personal.
      {
        userAgent: ["GPTBot", "ChatGPT-User", "ClaudeBot", "Claude-Web", "PerplexityBot", "Google-Extended", "CCBot", "anthropic-ai"],
        allow: "/",
        disallow,
      },
      // Aggressive scrapers that ignore crawl-delay and resell content.
      {
        userAgent: ["Bytespider", "Amazonbot"],
        allow: ["/", "/llms.txt"],
        disallow: [...disallow, "/shop", "/products", "/artists"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
