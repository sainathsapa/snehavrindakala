import { ImageResponse } from "next/og";

/**
 * Site-wide Open Graph card.
 *
 * Without this, a shared link renders as a bare grey card with no artwork — the
 * worst possible first impression for a site whose entire proposition is visual.
 *
 * Drawn with next/og (Satori) rather than a static file so the palette and
 * typography stay in step with the design system. No external fonts are fetched:
 * the container has no network at request time, so this uses the system serif
 * stack and stays self-contained.
 */

export const alt = "SnehaVrinda Kala — handmade Indian art, from Bikaner";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          backgroundColor: "#F8EBDD",
          // A pair of soft terracotta washes so the card reads as warm paper
          // rather than a flat swatch.
          backgroundImage:
            "radial-gradient(circle at 88% 12%, rgba(183,70,32,0.16), transparent 46%), radial-gradient(circle at 6% 92%, rgba(230,167,46,0.18), transparent 42%)",
          fontFamily: "Georgia, 'Times New Roman', serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: 999,
              backgroundColor: "#B74620",
            }}
          />
          <div
            style={{
              fontSize: 22,
              letterSpacing: 5,
              textTransform: "uppercase",
              color: "#B74620",
              fontFamily: "'Helvetica Neue', Arial, sans-serif",
            }}
          >
            Bikaner, Rajasthan
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 88,
              lineHeight: 1.05,
              color: "#42170F",
              letterSpacing: -2,
            }}
          >
            SnehaVrinda Kala
          </div>
          <div
            style={{
              marginTop: 18,
              fontSize: 32,
              color: "#6B5347",
              maxWidth: 820,
              lineHeight: 1.35,
              fontFamily: "'Helvetica Neue', Arial, sans-serif",
            }}
          >
            Handmade Indian art — painting, folk traditions, textile and textile
            craft, made by one artist.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
            color: "#8F201D",
            fontSize: 24,
            fontFamily: "'Helvetica Neue', Arial, sans-serif",
          }}
        >
          <div style={{ height: 1, width: 96, backgroundColor: "#E2CFB6" }} />
          snehavrindakala.in
        </div>
      </div>
    ),
    size
  );
}
