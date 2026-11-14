#!/usr/bin/env node
/**
 * Seeds the Hindi product titles reviewed and approved by the studio.
 *
 * Kept as a script rather than a migration because these are content, not
 * schema: the admin panel can edit any of them afterwards, and re-running this
 * would overwrite that work. Run once, deliberately.
 *
 * Titles that were left in Latin script (Madhubani, Warli, Pattachitra, Gond,
 * Kalamkari, Phulkari, Bidriware, Ikat) are how these traditions are named in
 * India in both languages; transliterating them would make the familiar look
 * foreign.
 */
import pg from "pg";

const TITLES = {
  "madhubani-celebration": "मधुबनी उत्सव (सीमित)",
  "hand-painted-terracotta-vase": "हस्तनिर्मित टेराकोटा फूलदान",
  "madhubani-folk-painting": "मधुबनी लोक चित्रकला",
  "embroidered-cotton-throw": "कढ़ाईदार सूती चादर",
  "custom-portrait-commission": "व्यक्तिचित्र — विशेष ऑर्डर",
  "block-printed-journal-set": "ब्लॉक-प्रिंट डायरी सेट",
  "wearable-art-pendant": "पहनने योग्य कला लॉकेट",
  "warli-harvest-painting": "वारली फ़सल चित्र",
  "pattachitra-scroll-panel": "पट्टचित्र स्क्रॉल पैनल",
  "gond-tree-of-life": "गोंड — जीवन वृक्ष",
  "kalamkari-penwork-panel": "कलमकारी कलम-कार्य पैनल",
  "phulkari-embroidered-dupatta": "फुलकारी कढ़ाई दुपट्टा",
  "madhubani-fish-and-lotus": "मधुबनी मछली और कमल",
  "hand-thrown-stoneware-bowl": "पत्थर के बर्तन का कटोरा",
  "block-printed-table-runner": "ब्लॉक-प्रिंट सूती टेबल रनर",
  "bidriware-silver-inlay-box": "बिदरी चाँदी जड़ाऊ डिब्बा",
  "hand-marbled-paper-journal": "हाथ से रंगा कागज़ डायरी",
  "lacquer-wooden-pen-case": "लाह लेपित लकड़ी क़लमदान",
  "silver-filigree-earrings": "चाँदी की ज़रीनकारी बालियाँ",
  "hand-woven-ikat-stole": "हस्त-बुना इकत दुपट्टा",
  "gold-leaf-miniature-portrait": "स्वर्ण-पत्ती लघु व्यक्तिचित्र",
};

const client = new pg.Client({
  host: process.env.PGHOST || "127.0.0.1",
  port: Number(process.env.PGPORT || 5433),
  user: process.env.PGUSER || "medusa",
  password: process.env.PGPASSWORD || "medusa",
  database: process.env.PGDATABASE || "medusa",
});

await client.connect();

// Only write titles for products that actually exist, so a stale key in this
// file can never create an orphan row that points at nothing.
const { rows } = await client.query("SELECT handle FROM product WHERE deleted_at IS NULL");
const live = new Set(rows.map((r) => r.handle));

let written = 0;
const missing = [];
for (const [handle, title] of Object.entries(TITLES)) {
  if (!live.has(handle)) {
    missing.push(handle);
    continue;
  }
  await client.query(
    `INSERT INTO product_translation (handle, locale, title, updated_at)
     VALUES ($1, 'hi', $2, NOW())
     ON CONFLICT (handle, locale)
     DO UPDATE SET title = EXCLUDED.title, updated_at = NOW()`,
    [handle, title]
  );
  written++;
}

console.log(`wrote ${written} Hindi titles`);
if (missing.length) console.log(`skipped (no such product): ${missing.join(", ")}`);

const { rows: count } = await client.query(
  "SELECT count(*)::int AS n FROM product_translation WHERE locale = 'hi'"
);
console.log(`rows in product_translation for hi: ${count[0].n}`);

await client.end();
