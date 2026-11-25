#!/usr/bin/env node
/**
 * Catalogue readiness audit — media, shipping data, ownership, stock.
 *
 * WHY
 *
 * The storefront can render a product perfectly while the underlying business
 * facts are missing: a generated placeholder image instead of the real artwork,
 * no measured weight so no shipment can be booked, no owning partner so the
 * marketplace cannot attribute the sale, no stock row so nothing is reserved.
 *
 * Those gaps are invisible from a 200 OK, so they are measured here against the
 * live database and reported as counts. The script never changes data and never
 * invents a value — it reports what exists so the owner can supply what does not.
 *
 *   DATABASE_URL=... node scripts/ops/catalogue-readiness-audit.mjs
 *   DATABASE_URL=... node scripts/ops/catalogue-readiness-audit.mjs --json
 *   DATABASE_URL=... node scripts/ops/catalogue-readiness-audit.mjs --strict  # exit 1 on any gap
 *
 * Exit codes: 0 report produced, 1 gaps found with --strict, 2 could not run.
 */

import { existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PUBLIC_DIR = join(root, "apps", "storefront", "public");

const args = process.argv.slice(2);
const json = args.includes("--json");
const strict = args.includes("--strict");

const die = (msg) => {
  console.error(`[catalogue-audit] ${msg}`);
  process.exit(2);
};

if (!process.env.DATABASE_URL) {
  die("DATABASE_URL is not set. This audit reads the live catalogue; refusing to guess.");
}

/**
 * Classify a thumbnail. "generated-" is the naming this project used for
 * AI/placeholder art, so it is treated as unverified media rather than a real
 * photograph. A local path that does not exist on disk is broken.
 */
function classifyMedia(thumbnail) {
  const value = (thumbnail ?? "").trim();
  if (!value) return { status: "missing", detail: "no thumbnail" };
  if (/(^|\/)generated[-_]/i.test(value)) {
    return { status: "generated_placeholder", detail: "filename marks it as generated art" };
  }
  if (value.startsWith("/")) {
    const filePath = join(PUBLIC_DIR, value.replace(/^\//, ""));
    return existsSync(filePath)
      ? { status: "local_verified_file", detail: value }
      : { status: "broken_local_path", detail: value };
  }
  if (/^https?:\/\//.test(value)) {
    return { status: "external_unverified", detail: "remote URL, not checked" };
  }
  return { status: "unknown", detail: "unrecognised thumbnail shape" };
}

async function main() {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    const products = (
      await client.query(
        `SELECT id, title, handle, status, thumbnail FROM product ORDER BY handle`
      )
    ).rows;

    const shipping = new Map(
      (
        await client.query(
          `SELECT product_id, weight_grams, length_cm, breadth_cm, height_cm
             FROM product_shipping_data`
        )
      ).rows.map((r) => [r.product_id, r])
    );

    const ownership = new Map(
      (
        await client.query(
          `SELECT product_id, partner_id FROM partner_product`
        )
      ).rows.map((r) => [r.product_id, r.partner_id])
    );

    const stock = new Map(
      (
        await client.query(`SELECT variant_id, on_hand FROM variant_stock`)
      ).rows.map((r) => [r.variant_id, r])
    );

    const variants = (
      await client.query(
        `SELECT id, product_id, sku FROM product_variant`
      )
    ).rows;

    const variantsByProduct = new Map();
    for (const v of variants) {
      if (!variantsByProduct.has(v.product_id)) variantsByProduct.set(v.product_id, []);
      variantsByProduct.get(v.product_id).push(v);
    }

    const mediaSummary = {};
    const rows = products.map((p) => {
      const media = classifyMedia(p.thumbnail);
      mediaSummary[media.status] = (mediaSummary[media.status] ?? 0) + 1;

      const myVariants = variantsByProduct.get(p.id) ?? [];
      const trackedVariants = myVariants.filter((v) => stock.has(v.id));

      return {
        id: p.id,
        handle: p.handle,
        title: p.title,
        status: p.status,
        media: media.status,
        mediaDetail: media.detail,
        hasShippingData: shipping.has(p.id),
        owningPartnerId: ownership.get(p.id) ?? null,
        variantCount: myVariants.length,
        trackedVariantCount: trackedVariants.length,
        stockTracked: myVariants.length > 0 && trackedVariants.length === myVariants.length,
      };
    });

    const unresolvedOwnership = rows.filter((r) => !r.owningPartnerId);
    const missingShipping = rows.filter((r) => !r.hasShippingData);
    const untrackedStock = rows.filter((r) => !r.stockTracked);
    const placeholderMedia = rows.filter(
      (r) => r.media === "generated_placeholder" || r.media === "broken_local_path"
    );

    const report = {
      generatedAt: new Date().toISOString(),
      database: "live (DATABASE_URL)",
      totals: {
        products: rows.length,
        variants: variants.length,
        productsWithShippingData: rows.length - missingShipping.length,
        productsWithOwningPartner: rows.length - unresolvedOwnership.length,
        productsWithTrackedStock: rows.length - untrackedStock.length,
      },
      mediaByStatus: mediaSummary,
      gaps: {
        placeholderOrBrokenMedia: placeholderMedia.length,
        missingShippingData: missingShipping.length,
        unresolvedOwnership: unresolvedOwnership.length,
        untrackedStock: untrackedStock.length,
      },
      unresolvedOwnershipProductIds: unresolvedOwnership.map((r) => r.id),
      missingShippingProductIds: missingShipping.map((r) => r.id),
      products: rows,
    };

    if (json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log("[catalogue-audit] live catalogue readiness\n");
      console.log(`  products                         ${rows.length}`);
      console.log(`  variants                         ${variants.length}`);
      console.log(`  media by status                  ${JSON.stringify(mediaSummary)}`);
      console.log(`  products with verified shipping  ${report.totals.productsWithShippingData}`);
      console.log(`  products with an owning partner  ${report.totals.productsWithOwningPartner}`);
      console.log(`  products with tracked stock      ${report.totals.productsWithTrackedStock}\n`);
      console.log("  GAPS (owner input required — nothing is defaulted):");
      console.log(`    placeholder or broken media    ${placeholderMedia.length}`);
      console.log(`    missing weight/dimensions      ${missingShipping.length}`);
      console.log(`    unresolved product ownership   ${unresolvedOwnership.length}`);
      console.log(`    stock not initialised          ${untrackedStock.length}`);
      if (unresolvedOwnership.length) {
        console.log(
          `\n  unresolved ownership queue (product ids): ${unresolvedOwnership
            .map((r) => r.id)
            .join(", ")}`
        );
      }
    }

    const anyGap = Object.values(report.gaps).some((n) => n > 0);
    if (strict && anyGap) {
      console.error(
        "\n[catalogue-audit] FAIL (--strict) — the catalogue is not launch-complete.\n" +
          "  Each gap is real missing business data, not a code defect. See\n" +
          "  docs/release/CATALOGUE_MEDIA_COMPLETENESS.md and\n" +
          "  docs/release/PRODUCT_PARTNER_MAPPING_REPORT.md."
      );
      process.exit(1);
    }
    process.exit(0);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(`[catalogue-audit] could not run: ${err?.message || err}`);
  process.exit(2);
});
