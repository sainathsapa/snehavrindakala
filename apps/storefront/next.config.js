/** @type {import('next').NextConfig} */
const backendUrl = new URL(
  process.env.MEDUSA_BACKEND_URL ||
    process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ||
    "http://localhost:9000"
);

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
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
          "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com https://checkout.razorpay.com; " +
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
          "font-src 'self' https://fonts.gstatic.com; " +
          "img-src 'self' data: https:; " +
          "connect-src 'self' https://api.razorpay.com https://apiv2.shiprocket.in https://www.google-analytics.com https://www.googletagmanager.com; " +
          "frame-src https://checkout.razorpay.com; " +
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

module.exports = nextConfig;
