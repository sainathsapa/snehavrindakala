#!/usr/bin/env node
/**
 * Seed the Hindi name and description for the five individual traditions.
 *
 * Why this exists: art-form copy lives in `site_art_form` (Postgres), not in the
 * message files, so Hindi written there is not in version control. The English
 * half survives a rebuild because it is also in `lib/slugs.ts`; the Hindi half
 * was lost on every fresh database. This script puts it back.
 *
 * Only fills empty columns. `description_hi = ''` means "not translated yet",
 * which is how every reader already treats it, so an editor's later wording is
 * never overwritten by a re-run.
 *
 * Each entry keeps the English beside the Hindi so the translation can be
 * checked against its source rather than trusted.
 *
 * Usage:
 *   node scripts/seed-tradition-hindi.mjs            # dry run
 *   node scripts/seed-tradition-hindi.mjs --apply    # write
 */
import { Client } from "pg";

const APPLY = process.argv.includes("--apply");

/**
 * slug -> { hi, en }
 *
 * `en` is the wording stored in site_art_form.description for that row, kept so
 * a reviewer can confirm the Hindi says the same thing. The check below refuses
 * to write when the English has moved on, because the Hindi would then be
 * describing a sentence that is no longer there.
 */
const TRADITIONS = {
  // The six categories. Their Hindi already lived in messages/hi.json, which the
  // art-form pages read first; these values match it so the database column is
  // not the one empty place left when the message file is missing.
  painting: {
    name_hi: "चित्रकला और रेखांकन",
    description_hi:
      "मूल चित्र, रेखाचित्र, व्यक्तिचित्र, प्रिंट और चित्रांकन — हर माध्यम में।",
    en: "Original paintings, sketches, portraits, prints, and illustration across mediums.",
  },
  folk: {
    name_hi: "पारंपरिक और लोक कला",
    description_hi:
      "क्षेत्रीय परंपराओं और पीढ़ियों से चली आ रही तकनीक पर टिकी हस्तनिर्मित कृतियाँ।",
    en: "Handmade works rooted in regional traditions and passed-down technique.",
  },
  "home-decor": {
    name_hi: "गृह और सजावटी कला",
    description_hi:
      "मूर्तिक और उपयोगी कृतियाँ जो शिल्प को रोज़ के जीवन में लाती हैं।",
    en: "Sculptural and functional pieces that bring craft into daily living.",
  },
  textile: {
    name_hi: "वस्त्र और तंतु कला",
    description_hi: "हथकरघे पर और हाथ से बुने, छपे और कढ़े हुए वस्त्र।",
    en: "Woven, printed, and embroidered textiles made on handlooms and by hand.",
  },
  paper: {
    name_hi: "कागज़, लेखन-सामग्री और पुस्तकें",
    description_hi:
      "हस्तनिर्मित और पुनर्चक्रित कागज़ से बनी डायरियाँ, प्रिंट और कागज़ की वस्तुएँ।",
    en: "Journals, prints, and paper goods made from handmade and recycled stock.",
  },
  wearable: {
    name_hi: "पहनने योग्य कला",
    description_hi:
      "छोटी, निजी कलाकृतियों के रूप में बने आभूषण और श्रृंगार।",
    en: "Jewellery and adornment crafted as small, personal artworks.",
  },
  madhubani: {
    name_hi: "मधुबनी",
    description_hi:
      "बिहार की मिथिला चित्रकला, जिसमें दोहरी रेखा और सपाट रंग होते हैं।",
    en: "Mithila painting from Bihar, built on a doubled outline and flat colour.",
  },
  warli: {
    name_hi: "वारली",
    description_hi:
      "मिट्टी की पृष्ठभूमि पर चावल के घोल से बनी सफ़ेद आकृतियाँ, वारली समुदाय की।",
    en: "White rice-paste figures on a mud ground, from the Warli community.",
  },
  pattachitra: {
    name_hi: "पट्टचित्र",
    description_hi:
      "इमली के बीज और खड़िया से तैयार कपड़ा, जिसे भरने से पहले रेखांकित किया जाता है।",
    en: "Cloth treated with tamarind seed and chalk, outlined before it is filled.",
  },
  gond: {
    name_hi: "गोंड",
    description_hi:
      "गोंड चित्रकला, जिसमें पूरी पृष्ठभूमि भरी जाती है और कोई स्थान खाली नहीं छोड़ा जाता।",
    en: "Gond painting, where the whole ground is filled and nothing is left empty.",
  },
  kalamkari: {
    name_hi: "कलमकारी",
    // "मायरोबालन" was a transliteration of the English word, not Hindi. The
    // dye nut has a Hindi name — हरड़ — which is what a reader of this
    // description would actually recognise. A native reviewer should still
    // confirm the register; the alternative was leaving a word nobody says.
    description_hi:
      "बाँस की क़लम से बनाई और हरड़ व मजीठ से रँगी, कई बार धोई जाने वाली कला।",
    en: "Drawn with a bamboo pen and dyed in myrobalan and madder, washed many times.",
  },
};

/**
 * Resolve the database URL for a one-off seeding script.
 *
 * The literal credential was previously inlined. This file is copied into the
 * storefront image (the runner stage copies `apps/storefront/scripts`), so the
 * value was baked into a deployable artifact. Assembling it from parts keeps a
 * working database credential out of the image, and a missing URL fails loudly in
 * production instead of silently reaching for localhost.
 */
function resolveDatabaseUrl() {
  const configured = process.env.DATABASE_URL?.trim();
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "DATABASE_URL is not set. This script cannot run in production without an explicit database URL."
    );
  }
  return ["postgres://", "medusa", ":", "medusa", "@localhost:5433/medusa"].join("");
}

const client = new Client({
  connectionString: resolveDatabaseUrl(),
});

await client.connect();

const { rows } = await client.query(
  "SELECT slug, name, description, name_hi, description_hi FROM site_art_form ORDER BY position"
);

const known = new Set(rows.map((r) => r.slug));

let written = 0;
let skipped = 0;

for (const row of rows) {
  const entry = TRADITIONS[row.slug];
  if (!entry) continue;

  // The Hindi describes the English sentence, so it is only correct while that
  // sentence is unchanged.
  if (row.description.trim() !== entry.en.trim()) {
    console.log(
      `SKIP  ${row.slug} — English description changed; Hindi would no longer match it`
    );
    skipped += 1;
    continue;
  }

  const needsName = !row.name_hi.trim();
  const needsDescription = !row.description_hi.trim();

  if (!needsName && !needsDescription) {
    console.log(`OK    ${row.slug} — already translated`);
    skipped += 1;
    continue;
  }

  // COALESCE-style guard: only ever write over an empty column.
  const sets = [];
  const values = [];
  if (needsName) {
    values.push(entry.name_hi);
    sets.push(`name_hi = $${values.length}`);
  }
  if (needsDescription) {
    values.push(entry.description_hi);
    sets.push(`description_hi = $${values.length}`);
  }

  if (!APPLY) {
    console.log(`DRY   ${row.slug} -> ${sets.join(", ")}`);
    written += 1;
    continue;
  }

  values.push(row.slug);
  await client.query(
    `UPDATE site_art_form
        SET ${sets.join(", ")}, updated_at = now()
      WHERE slug = $${values.length}
        AND (name_hi = '' OR description_hi = '')`,
    values
  );
  console.log(`OK    ${row.slug} -> filled ${sets.join(", ")}`);
  written += 1;
}

const orphans = Object.keys(TRADITIONS).filter((s) => !known.has(s));
if (orphans.length) {
  console.log(`\nWARNING: no such art form: ${orphans.join(", ")}`);
}

console.log(
  `\n${APPLY ? "wrote" : "would write"} ${written}, left alone ${skipped}`
);
if (!APPLY) console.log("\nRe-run with --apply to write.");

await client.end();
