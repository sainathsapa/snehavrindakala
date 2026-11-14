import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { findCatalogueItem } from "@/lib/catalogue";

/**
 * Per-product Open Graph card.
 *
 * A shared work should arrive as that work, not as the house card. Falls back to
 * the plain site card when the handle is unknown or the product has no image, so
 * a stale link degrades quietly instead of breaking the share.
 */

export const alt = "Original Indian artwork from SnehaVrinda Kala";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Read the artwork from disk and hand it to Satori as a data URI.
 *
 * Satori refuses relative paths ("Image source must be an absolute URL").
 * Fetching over HTTP instead makes the render depend on the app calling itself,
 * which silently failed inside the container and produced a card with a blank
 * artwork half. Reading the file directly has no moving parts: local uploads sit
 * under MEDIA_ROOT and bundled art under public/.
 */
async function inlineImage(src: string): Promise<string | undefined> {
  if (src.startsWith("http") || src.startsWith("data:")) return src;

  const mediaRoot = process.env.MEDIA_ROOT || "/data/uploads";
  const candidates = src.startsWith("/uploads/")
    ? [path.join(mediaRoot, src.replace(/^\/uploads\//, ""))]
    : [
        path.join(process.cwd(), "public", src),
        path.join(process.cwd(), ".next/standalone/public", src),
      ];

  for (const file of candidates) {
    try {
      const bytes = await readFile(file);
      const ext = path.extname(file).toLowerCase();
      const type =
        ext === ".png"
          ? "image/png"
          : ext === ".webp"
            ? "image/webp"
            : ext === ".gif"
              ? "image/gif"
              : "image/jpeg";
      return `data:${type};base64,${bytes.toString("base64")}`;
    } catch {
      continue;
    }
  }
  // A missing photo degrades to the plain card; it must never break the share.
  return undefined;
}

export default async function ProductOpengraphImage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const item = await findCatalogueItem(handle).catch(() => null);

  const title = item?.title ?? "SnehaVrinda Kala";
  const artist = item?.artist ?? "Sneha Sainath Sapa";

  // Satori will only embed an absolute URL: a relative /images/... path throws
  // "Image source must be an absolute URL" and the route returns an empty
  // response. Resolve against the store's own origin.
  const raw = item?.image;
  const image = raw ? await inlineImage(raw) : undefined;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          backgroundColor: "#F8EBDD",
          fontFamily: "Georgia, 'Times New Roman', serif",
        }}
      >
        {/* Artwork half. The band on the left is deliberately wider than the
            text column: the work is the reason anything is being shared. */}
        <div
          style={{
            width: 560,
            height: "100%",
            display: "flex",
            backgroundColor: "#FFF7EC",
          }}
        >
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image}
              alt=""
              width={560}
              height={630}
              style={{ objectFit: "cover", width: 560, height: 630 }}
            />
          ) : null}
        </div>

        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "64px 64px",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 20,
              letterSpacing: 4,
              textTransform: "uppercase",
              color: "#B74620",
              fontFamily: "'Helvetica Neue', Arial, sans-serif",
            }}
          >
            SnehaVrinda Kala
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                display: "flex",
                fontSize: 54,
                lineHeight: 1.12,
                color: "#42170F",
                letterSpacing: -1,
              }}
            >
              {title}
            </div>
            <div
              style={{
                display: "flex",
                marginTop: 16,
                fontSize: 26,
                color: "#6B5347",
                fontFamily: "'Helvetica Neue', Arial, sans-serif",
              }}
            >
              by {artist}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              color: "#8F201D",
              fontSize: 22,
              fontFamily: "'Helvetica Neue', Arial, sans-serif",
            }}
          >
            <div style={{ height: 1, width: 72, backgroundColor: "#E2CFB6" }} />
            snehavrindakala.in
          </div>
        </div>
      </div>
    ),
    size
  );
}
