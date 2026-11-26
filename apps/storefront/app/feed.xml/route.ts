import { listCatalogue } from "@/lib/catalogue";

export const dynamic = "force-dynamic";

/**
 * The Google Shopping / Meta product feed.
 *
 * Nothing told Google, Instagram or Facebook what the studio sells. A buyer who
 * searched for a Madhubani painting, or who tapped a shop link on Instagram,
 * landed on nothing — the catalogue existed only for people who already knew the
 * address. This is the standard RSS 2.0 + `g:` feed those catalogues read.
 *
 * Deliberate choices:
 *
 *  - **Availability is computed, not assumed.** A one-of-one work that has been
 *    sold must appear as `out of stock`, or the feed advertises a work that
 *    cannot be bought and Google starts distrusting the whole feed.
 *  - **`condition: new` and a brand** are required by Google; an artwork's brand
 *    is the studio, not the artist, and the artist goes in the description.
 *  - **Prices are the region's own**, so the feed cannot disagree with the shop.
 *  - **No coupon or shipping extensions**: both need account-level settings that
 *    would silently not match the site.
 */
export async function GET() {
  const base = (
    process.env.NEXT_PUBLIC_STOREFRONT_URL || "https://snehavrinda.in"
  ).replace(/\/+$/, "");

  let items: Awaited<ReturnType<typeof listCatalogue>> = [];
  try {
    items = await listCatalogue("inr", "en");
  } catch (error) {
    console.error("[feed] catalogue unavailable", error);
  }

  const esc = (value: unknown) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const entries = items
    .filter((item) => item.price != null && item.image)
    .map((item) => {
      const link = `${base}/products/${encodeURIComponent(item.handle)}`;
      const image = item.image.startsWith("http") ? item.image : `${base}${item.image}`;
      const sold = /sold/i.test(item.stockType || "");
      return `    <item>
      <g:id>${esc(item.handle)}</g:id>
      <title>${esc(item.title)}</title>
      <description>${esc(
        [item.title, item.artist, item.collection].filter(Boolean).join(" · ") +
          " — one of one, made by hand."
      )}</description>
      <link>${esc(link)}</link>
      <g:image_link>${esc(image)}</g:image_link>
      <g:price>${esc(`${item.price}.00 ${(item.currency || "INR").toUpperCase()}`)}</g:price>
      <g:availability>${sold ? "out_of_stock" : "in_stock"}</g:availability>
      <g:condition>new</g:condition>
      <g:brand>SnehaVrinda Kala</g:brand>
      <g:identifier_exists>no</g:identifier_exists>
      <g:google_product_category>Home &amp; Garden &gt; Decor &gt; Artwork</g:google_product_category>
      <g:product_type>${esc(item.collection || "Art")}</g:product_type>
      <g:item_group_id>${esc(item.artist || "studio")}</g:item_group_id>
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>SnehaVrinda Kala</title>
    <link>${esc(base)}</link>
    <description>Handmade art · culture · conscious living, Bikaner</description>
${entries}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      // A feed is read on a schedule by a crawler, so a short cache is right;
      // longer and a sold one-of-one lingers in a shopping result.
      "Cache-Control": "public, max-age=900, s-maxage=900",
    },
  });
}
