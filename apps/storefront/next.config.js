/** @type {import('next').NextConfig} */
const createNextIntlPlugin = require("next-intl/plugin");

// Points next-intl at the request config that chooses which message catalogue a
// render uses. Without this the provider throws "Couldn't find next-intl config
// file" at build time.
const withNextIntl = createNextIntlPlugin("./i18n/request.ts");
const backendUrl = new URL(
  process.env.MEDUSA_BACKEND_URL ||
    process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ||
    "http://localhost:9000"
);

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  eslint: {
    ignoreDuringBuilds: true,
  },
  compress: true,
  transpilePackages: ["@snehavrinda-kala/ui", "@snehavrinda-kala/types"],
  // Standalone output is only needed for the container image. Local builds
  // keep the regular Next.js server so `next start` works without warnings.
  output: process.env.NEXT_STANDALONE === "true" ? "standalone" : undefined,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cdn.sanity.io" },
      { protocol: "https", hostname: backendUrl.hostname },
      { protocol: "http", hostname: backendUrl.hostname },
      // S3 / CloudFront media storage (build plan Section 12.6)
      {
        protocol: "https",
        hostname: process.env.NEXT_PUBLIC_MEDIA_DOMAIN || "media.snehavrindakala.example",
      },
    ],
  },
  async redirects() {
    // Seed products once shipped with opaque handles (`/products/003`) taken
    // from their database ids. Those URLs may already be in a browser history,
    // a share, or a search index, so redirect each to its readable slug rather
    // than 404. Order matters: a specific id must be listed before a catch-all.
    return [
      { source: "/products/001", destination: "/products/hand-painted-terracotta-vase-home-1", permanent: true },
      { source: "/products/002", destination: "/products/madhubani-folk-painting-traditional-2", permanent: true },
      { source: "/products/003", destination: "/products/embroidered-cotton-throw-textile-3", permanent: true },
      { source: "/products/004", destination: "/products/custom-portrait-commission", permanent: true },
      { source: "/products/005", destination: "/products/pattachitra-on-palm-leaf", permanent: true },
      { source: "/products/006", destination: "/products/silver-tribal-necklace-wearable-6", permanent: true },
    ];
  },
  async headers() {
    const headers = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=()",
      },
      {
        key: "Content-Security-Policy",
        value:
          "default-src 'self'; " +
          // Razorpay's checkout is not one host. `checkout.razorpay.com` serves the
          // document and assets, `api.razorpay.com` is framed for the payment
          // methods, and `lumberjack.razorpay.com` collects telemetry the SDK
          // treats as required. Allowing only the first blocked the iframe with
          // "This content is blocked. Contact the site owner to fix the issue."
          // and left the buyer unable to pay — a total checkout failure caused
          // by our own header, with no server error to point at it.
          "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com https://cdn.razorpay.com https://www.googletagmanager.com https://www.google-analytics.com; " +
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
          "font-src 'self' data: https://fonts.gstatic.com https://cdn.razorpay.com; " +
          "img-src 'self' data: https://*.razorpay.com https:; " +
          "connect-src 'self' https://api.razorpay.com https://lumberjack.razorpay.com https://checkout.razorpay.com https://cdn.razorpay.com https://apiv2.shiprocket.in https://www.google-analytics.com https://www.googletagmanager.com; " +
          "frame-src https://checkout.razorpay.com https://api.razorpay.com; " +
          "worker-src 'self' blob:; " +
          "object-src 'none'; " +
          "base-uri 'self';",
      },
    ];

    if (process.env.NODE_ENV === "production") {
      headers.push({
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      });
    }

    return [{ source: "/(.*)", headers }];
  },
};

module.exports = withNextIntl(nextConfig);
