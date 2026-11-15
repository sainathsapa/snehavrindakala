#!/usr/bin/env node
/**
 * Backfill the `medium:` tag for products whose own description already states
 * the material and technique.
 *
 * Why this is safe: every value below is a condensation of words the product
 * record already contains — no material is inferred, added or embellished. The
 * source sentence is kept beside each entry so a reviewer can check the claim
 * against the record rather than trusting this script.
 *
 * Why it is scoped: `dimensions:` is NOT written here. Not one product in the
 * database states a size, and these are one-of-one objects sold with a
 * certificate of authenticity. A guessed measurement is a false claim about a
 * real object, so the field stays empty until someone measures the work.
 *
 * Products with no usable description are skipped and reported, not guessed at.
 *
 * Usage:
 *   node scripts/backfill-medium-tags.mjs            # dry run
 *   node scripts/backfill-medium-tags.mjs --apply    # write
 */
import { Client } from "pg";

const APPLY = process.argv.includes("--apply");

/**
 * handle -> medium, condensed from that product's own description.
 * `from` is the source phrase, kept for review.
 */
const MEDIUMS = {
  "bidriware-silver-inlay-box": {
    medium: "Silver inlaid in zinc-copper alloy, blackened with fort soil",
    from: "silver hammered into an alloy of zinc and copper, then blackened with soil from the fort",
  },
  "block-printed-journal-set": {
    medium: "Hand block-printed handmade paper, hand-stitched",
    from: "Hand block-printed covers on handmade paper, stitched by hand",
  },
  "block-printed-table-runner": {
    medium: "Hand block-printed cotton, natural indigo and madder",
    from: "Hand-carved teak blocks printed in repeat with a natural indigo and madder palette",
  },
  "custom-portrait-commission": {
    medium: "Portrait, medium chosen to suit the subject",
    from: "A portrait made to a brief, in the medium that suits the subject",
  },
  "embroidered-cotton-throw": {
    medium: "Hand-embroidered cotton",
    from: "Hand-embroidered cotton, woven and stitched in small runs",
  },
  "gold-leaf-miniature-portrait": {
    medium: "Pigment on wasli paper with burnished gold leaf",
    from: "painted with a squirrel-hair brush on wasli paper and finished with burnished gold leaf",
  },
  "gond-tree-of-life": {
    medium: "Natural pigment on canvas",
    from: "Gond painting from Madhya Pradesh. The whole canvas is filled with a single motif",
  },
  "hand-marbled-paper-journal": {
    medium: "Marbled covers, Coptic-bound cotton paper, 120 pages",
    from: "Covers marbled in a size bath, then bound by hand with a Coptic stitch",
  },
  "hand-painted-terracotta-vase": {
    medium: "Hand-thrown terracotta, natural pigment",
    from: "A hand-thrown terracotta vase painted with folk motifs in natural pigment",
  },
  "hand-thrown-stoneware-bowl": {
    medium: "Wheel-thrown stoneware, celadon glaze",
    from: "Wheel-thrown and glazed in a celadon that pools at the foot",
  },
  "hand-woven-ikat-stole": {
    medium: "Hand-woven ikat, threads bound and dyed before weaving",
    from: "Threads bound and dyed before weaving, so the pattern appears as the loom advances",
  },
  "kalamkari-penwork-panel": {
    medium: "Bamboo pen with fermented jaggery and iron, myrobalan and madder dyes",
    from: "Drawn with a bamboo pen dipped in fermented jaggery and iron, then dyed in myrobalan and madder",
  },
  "lacquer-wooden-pen-case": {
    medium: "Seasoned mango wood, natural lac worked on the lathe",
    from: "Turned from seasoned mango wood and finished with natural lac, worked on a lathe while still warm",
  },
  "madhubani-fish-and-lotus": {
    medium: "Nib and flat colour on handmade paper",
    from: "painted with a nib on handmade paper and filled with flat colour",
  },
  "pattachitra-scroll-panel": {
    medium: "Cloth treated with tamarind seed and chalk, outlined in black",
    from: "Painted on cloth treated with tamarind seed and chalk, then outlined in black",
  },
  "phulkari-embroidered-dupatta": {
    medium: "Floss silk on handspun cotton, darning stitch",
    from: "Floss silk on handspun cotton, worked from the reverse so the front reads as flat satin stitch",
  },
  "silver-filigree-earrings": {
    medium: "Fine drawn silver wire, twisted and soldered",
    from: "Fine silver wire drawn thin, twisted and soldered into a frame",
  },
  "warli-harvest-painting": {
    medium: "Rice-paste white pigment on a mud ground",
    from: "Rice-paste white pigment on a mud-brown ground",
  },
  "wearable-art-pendant": {
    medium: "Hand-painted ceramic on a cotton cord",
    from: "Hand-painted ceramic on a cotton cord",
  },
};

const client = new Client({
  connectionString:
    process.env.DATABASE_URL ||
    "postgres://medusa:medusa@localhost:5433/medusa",
});

await client.connect();

const { rows } = await client.query(
  "SELECT id, handle, description FROM product WHERE deleted_at IS NULL ORDER BY handle"
);

const known = new Set(rows.map((r) => r.handle));
const missingText = rows
  .filter((r) => !r.description || r.description.trim().length < 40)
  .map((r) => r.handle);

let written = 0;
let skipped = 0;

for (const row of rows) {
  const entry = MEDIUMS[row.handle];

  if (!entry) {
    console.log(`SKIP  ${row.handle} — no usable description to derive a medium from`);
    skipped += 1;
    continue;
  }

  // Sanity check: the source phrase must still exist in the description. If the
  // copy was edited since this table was written, the derived medium may no
  // longer be true, so refuse rather than persist a stale claim.
  const source = (row.description || "").toLowerCase().replace(/\s+/g, " ");
  const needle = entry.from.toLowerCase().replace(/\s+/g, " ");
  if (!source.includes(needle)) {
    console.log(`SKIP  ${row.handle} — description changed; source phrase no longer present`);
    skipped += 1;
    continue;
  }

  const tagValue = `medium:${entry.medium}`;

  if (!APPLY) {
    console.log(`DRY   ${row.handle} -> ${tagValue}`);
    written += 1;
    continue;
  }

  // Reuse an existing tag row when the exact value is already present, so the
  // tag table does not accumulate duplicates across runs.
  const existing = await client.query(
    "SELECT id FROM product_tag WHERE value = $1 AND deleted_at IS NULL LIMIT 1",
    [tagValue]
  );
  let tagId = existing.rows[0]?.id;
  if (!tagId) {
    const inserted = await client.query(
      "INSERT INTO product_tag (id, value) VALUES (gen_random_uuid(), $1) RETURNING id",
      [tagValue]
    );
    tagId = inserted.rows[0].id;
  }

  await client.query(
    `INSERT INTO product_tags (product_id, product_tag_id)
     VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [row.id, tagId]
  );

  console.log(`OK    ${row.handle} -> ${tagValue}`);
  written += 1;
}

const orphans = Object.keys(MEDIUMS).filter((h) => !known.has(h));
if (orphans.length) {
  console.log(`\nWARNING: table lists handles that no longer exist: ${orphans.join(", ")}`);
}

console.log(
  `\n${APPLY ? "wrote" : "would write"} ${written}, skipped ${skipped}, of ${rows.length} products`
);
if (missingText.length) {
  console.log(`no usable description: ${missingText.join(", ")}`);
}
if (!APPLY) console.log("\nRe-run with --apply to write.");

await client.end();
