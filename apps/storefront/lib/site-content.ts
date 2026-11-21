import { query, queryResult } from "@/lib/db";
import { ART_FORM_HINDI } from "@/lib/art-form-hindi";

/**
 * Admin-managed storefront content.
 *
 * The hero slides, art forms and featured categories are editorial: they are
 * curated by the shop owner, not derived from the catalogue. They live in
 * Postgres rather than in code so the admin panel can change them without a
 * deploy, and the storefront reads the same rows on every request.
 *
 * Every table is seeded once from the defaults below, so a fresh database still
 * renders a complete homepage. `ensureSeeded()` is idempotent.
 */

export interface HeroSlide {
  id: number;
  position: number;
  eyebrow: string;
  title: string;
  tagline: string;
  cta_label: string;
  cta_href: string;
  image: string;
  published: boolean;
}

export interface ArtForm {
  id: number;
  position: number;
  slug: string;
  name: string;
  description: string;
  image: string;
  published: boolean;
  /** Long-form editorial explaining the tradition. Rendered on /art-forms/[slug]. */
  story?: string;
  /**
   * One line naming what the form covers — places, traditions, or both. The
   * values genuinely mix: "Mithila, Warli, Gond…" are traditions, "Kutch,
   * Rajasthan, Channapatna…" are places. The label in the UI therefore reads
   * "Regions & traditions covered"; calling it "Origin" turned that mix into a
   * per-work provenance claim this shop cannot make.
   */
  origin?: string;
  /** Materials or techniques, as a comma-separated list. */
  materials?: string;
  /** Pull quote shown beside the story. */
  quote?: string;
}

/** A maker's own words, portrait and region. Empty fields render nothing. */
export interface SiteArtist {
  id: number;
  position: number;
  /** Must equal slugify(product.artist) so the PDP maker link resolves. */
  slug: string;
  name: string;
  bio: string;
  portrait: string;
  region: string;
  years_active: string;
  published: boolean;
}

export interface FeaturedCategory {
  id: number;
  position: number;
  label: string;
  href: string;
  image: string;
  published: boolean;
}

/** A buyer's own words, shown on the homepage and the authenticity page. */
export interface Testimonial {
  id: number;
  position: number;
  quote: string;
  author: string;
  location: string;
  /** Which work it refers to. Optional — some orders are commissions. */
  work: string;
  published: boolean;
}

/**
 * The address the studio answers at. Defined in `lib/studio.ts` so a client
 * component can use it without dragging this module's database client into the
 * browser bundle; re-exported here for the pages that already import it from
 * this module.
 */
export { STUDIO_EMAIL } from "@/lib/studio";

export const DEFAULT_HERO_SLIDES = [
  {
    eyebrow: "New arrivals & curated collections",
    title: "Where Indian Art Comes Alive",
    tagline: "Explore. Experience. Own.",
    cta_label: "Begin the Journey",
    cta_href: "/shop",
    image: "/images/hero/hero-art.jpg",
  },
  {
    eyebrow: "The craft journey",
    title: "Behind the Masterpiece",
    tagline: "Stories, skills and traditions.",
    cta_label: "Meet the Artists",
    cta_href: "/artists",
    image: "/images/artforms/painting.jpg",
  },
  {
    eyebrow: "Made for you",
    title: "Art That Tells Your Story",
    tagline: "Commissioned by hand, from a brief.",
    cta_label: "Request Custom Art",
    cta_href: "/custom-art",
    image: "/images/artforms/textile.jpg",
  },
];

export const DEFAULT_ART_FORMS = [
  {
    slug: "painting",
    name: "Painting & Drawing",
    description:
      "Original paintings, sketches, portraits, and illustration across mediums.",
    image: "/images/artforms/painting.jpg",
    origin: "Pan-Indian · every region, every century",
    materials: "Watercolour, gouache, acrylic, oil, ink on paper and canvas",
    quote:
      "A painting is not a picture of a thing. It is the time someone spent looking at it.",
    story: `Painting in India has never been one tradition. It is at least four, running in parallel for centuries and still running now.

There is the **miniature** lineage — Mughal, Rajput, Pahari — where a single page was built in layers over weeks, burnished from behind with a stone, and painted with a brush made from a squirrel's tail hair. There is the **mural** lineage of Ajanta, Lepakshi and Kerala, where pigment went onto wet lime and the wall became the painting. There is the **folk** lineage, which is where most of what we sell begins: Mithila, Warli, Gond, Pattachitra, Phad — pictures made by people whose names rarely reached a museum wall. And there is the **modern** lineage, Indian artists working in oil and acrylic on their own terms.

What holds them together is drawing. In almost every one of these traditions the line comes first and carries the meaning; colour arrives afterwards. That is why an Indian painting can read clearly at the size of a postcard and still hold a wall at three metres.

**What to look for.** Ask what the line is doing. In a good piece the outline is confident and slightly irregular, because a hand made it. Perfect mechanical edges usually mean a print. Then look at the ground: handmade paper has visible fibre and a slight smell of size; canvas has a weave you can see raking the light across it.

**Care.** Keep out of direct sun — Indian pigment on paper fades faster than oil on canvas. Frame behind glass with a mat so the paper is not touching the glazing, and never let a watercolour sit against a damp wall.`,
  },
  {
    slug: "folk",
    name: "Traditional & Folk Art",
    description:
      "Handmade works rooted in regional traditions and passed-down technique.",
    image: "/images/artforms/folk.jpg",
    origin: "Mithila, Warli, Gond, Pattachitra, Kalamkari, Phad",
    materials: "Natural pigment, rice paste, charcoal, cotton, tussar silk, palm leaf",
    quote:
      "These were never made to be looked at. They were made to be lived with, and that is why they still work.",
    story: `Folk art is the wrong name for it, but it has stuck. What it actually describes is **domestic painting** — pictures made inside a house, on its walls, for a wedding, a harvest, a birth, a god who needed a place to stay. It is the oldest continuous painting tradition on the subcontinent, and much of it is women's work passed from mother to daughter.

**Madhubani** (Mithila, Bihar) began on mud walls for weddings. After the 1966 drought, women were encouraged to move it onto paper for income, and the form survived by changing its surface. You can still see the original logic: no empty space, a double outline, and a border that is not decoration but a genealogy — fish for fertility, bamboo for endurance, parrots as messengers.

**Warli** (Palghar, Maharashtra) is drawn in white rice paste on a cow-dung ground, in a geometry of triangles and circles. A Warli *chowk* is a diagram of the cosmos, and the tarpa dance at its centre spirals around a musician the way the year spirals around the seasons.

**Gond** (Madhya Pradesh) fills its animals with a pattern of dots and dashes said to come from the tattoo tradition — the *digna*. Jangarh Singh Shyam brought it to paper in the 1980s and it has since become one of India's most visible contemporary idioms.

**Pattachitra** (Odisha) is painted on cloth stiffened with tamarind seed paste, or on palm leaf, using a fine brush and only natural colour. **Phad** (Rajasthan) is a long cloth scroll meant to be sung, not hung — the *Bhopa* priest unrolls it and narrates.

**Care.** Folk works on cloth should be framed and kept away from moisture; the natural grounds are more sensitive than modern gesso. Never dry-clean a painted textile — it lifts the pigment.`,
  },
  {
    slug: "home-decor",
    name: "Home & Decorative Art",
    description:
      "Sculptural and functional pieces that bring craft into daily living.",
    image: "/images/artforms/home-decor.jpg",
    origin: "Kutch, Rajasthan, Channapatna, Bastar",
    materials: "Terracotta, brass, sheesham, lac, bell metal, cane",
    quote:
      "A thing you use every day is looked at more often than anything on a wall.",
    story: `The most-looked-at art in a house is never on the wall. It is the bowl you eat from, the lamp you switch on, the box you keep keys in.

Indian decorative craft treats the useful object as a finished artwork. **Dhokra** bell-metal figures from Bastar and Bankura are made by the lost-wax method, which means every single piece is destroyed in the making and cannot be repeated — the mould is broken to release it. **Channapatna** lacquerware from Karnataka turns soft ivory-wood on a hand lathe and works in colour with a stick of heated lac, a technique that arrived from Persia and has been in that town since the 18th century. **Kutch** bell-metal and copper work is beaten rather than cast, and the sound it makes is used as a test of thickness.

**Blue pottery** (Jaipur) is not clay — it is a quartz frit, ground and mixed with Multani mitti, and it is fired once. That is why it rings when you tap it and why it is genuinely fragile.

**What to look for.** Hand-thrown ceramics are slightly asymmetric and have a thumbprint somewhere. Cast metal has a seam; beaten metal has hammer marks that nobody bothered to hide, and those marks are the signature.

**Care.** Wash terracotta by hand, never in a dishwasher, and let it dry fully before stacking. Brass will patina — that is not damage; a paste of lemon and salt brings it back, and repeated polishing eventually removes the engraving, so polish rarely.`,
  },
  {
    slug: "textile",
    name: "Textile & Fibre Art",
    description:
      "Woven, printed, and embroidered textiles made on handlooms and by hand.",
    image: "/images/artforms/textile.jpg",
    origin: "Varanasi, Kanchipuram, Kutch, Sambalpuri, Chanderi",
    materials: "Mulberry and tussar silk, cotton, wool, natural indigo, madder",
    quote:
      "A handloom can only run as fast as a person. That is the whole difference, and it is the whole point.",
    story: `Cloth is the most democratic Indian art and the least documented. Every region has a weave, and almost every weave carries a story about who was allowed to wear it.

**Banarasi** brocade is woven with extra weft — the gold or silver motif is not printed on, it is structurally part of the cloth, which is why it cannot wear off. **Kanchipuram** silk uses a three-shuttle technique for its contrasting border and *korvai* join, so the border is attached to the body by hand-knotting rather than cut and stitched. **Kutch** embroidery is a language: different communities use different stitches, and a stitch can identify a woman's village and marital status from across a room.

**Bandhani** is tie-dye done by pinching the cloth into thousands of tiny points and binding each one with thread before dyeing — the pattern is resistance, not application. **Kalamkari** is drawn, not printed: a *kalam* is a bamboo pen wrapped with cloth, and the mordant is applied by hand with fermented myrobalan and iron from rusted horseshoes.

**Ikat and Sambalpuri** tie the yarn *before* weaving, so the pattern is set in the thread and the weaver has to align it exactly on the loom. A slight blur at the motif's edge is the honest signature of hand-tied ikat.

**What to look for.** Hold it to the light. Handloom has small slubs and an irregular beat. A printed "handloom-look" fabric has perfect repeat and a photogravure dot pattern under a loupe.

**Care.** Cold wash, separately, for the first three washes — natural indigo and madder bleed and that is expected. Dry in shade; Indian sun will grey a red in a single season. Never wring silk.`,
  },
  {
    slug: "paper",
    name: "Paper, Stationery & Books",
    description:
      "Journals, prints, and paper goods made from handmade and recycled stock.",
    image: "/images/artforms/paper.jpg",
    origin: "Sanganer, Puducherry, Kutch, Kalighat",
    materials: "Handmade cotton rag, recycled fibre, natural dye, block-printed ink",
    quote:
      "Paper made by hand has a direction. You can feel which way it wants to fold.",
    story: `Handmade paper is made from rags, not pulp. Cotton waste is beaten to a slurry in water, lifted on a screen one sheet at a time, and dried — which is why the fibres are long, the sheet is strong, and the deckle edge is ragged. Machine paper is made in a continuous web; handmade paper is made one at a time, and you can tell by holding it up.

**Sanganer** (Rajasthan) block-printing is a seven-stage process per colour: washing, harda treatment, printing, drying in sun, washing again. The dye is fixed by steam or by leaving the cloth on the riverbank. **Kalighat** *pata* paintings of 19th-century Calcutta were made on cheap mill paper with cheap watercolour, sold to pilgrims for a few paise — the first genuinely popular Indian art form, and the ancestor of the Indian comic.

**What to look for.** Look at a block print for registration: if two colours overlap precisely with no gap and no bleed, ask. The honest print has a sliver of misalignment somewhere. On handmade paper, hold it to a lamp — the fibre distribution is uneven and there will be a visible watermark from the screen.

**Care.** Keep flat and dry. Handmade paper cockles if it gets damp and will not flatten evenly again. Store prints interleaved with acid-free tissue, never newsprint.`,
  },
  {
    slug: "wearable",
    name: "Wearable Art",
    description: "Jewellery and adornment crafted as small, personal artworks.",
    image: "/images/artforms/wearable.jpg",
    origin: "Rajasthan, Odisha, Gujarat, Andhra Pradesh",
    materials: "Silver, gold, lac, brass, semi-precious stone, bead, thread",
    quote:
      "Jewellery is the only art form that gets carried out of the house and shown to strangers.",
    story: `Indian jewellery was never simply ornament. It was a woman's movable wealth, a record of her community, and in many regions the only property she owned outright. That is why the forms are so specific and so conservative — a **maang tikka** or a **nath** reads a woman's region and marital status before she speaks.

**Meenakari** (Jaipur) enamels the reverse of a gold piece so that the part against the skin is as finished as the part facing out, a standard almost no other jewellery tradition holds. **Thewa** (Pratapgarh, Rajasthan) fuses a sheet of engraved gold into glass at high heat, a technique held by a handful of families for two centuries. **Silver tribal work** from Odisha and Gujarat uses lost-wax casting and *dhokra* methods, and the pieces are heavy because the weight was the point — it could be sold in a bad year.

**What to look for.** Turn it over. Handmade silver is slightly irregular at the solder joins and has hallmarks that are struck by hand, not laser-etched. Test weight in the palm rather than trusting a stamp.

**Care.** Silver tarnishes — store it in a sealed bag, not open on a dresser. Keep lac away from water and heat, which will soften the colour. Never use a silver dip on stone-set or enamelled pieces; it attacks the setting.`,
  },
];

export const DEFAULT_FEATURED_CATEGORIES = [
  { label: "Paintings", href: "/shop/painting", image: "/images/artforms/painting.jpg" },
  { label: "Folk Art", href: "/shop/folk", image: "/images/artforms/folk.jpg" },
  { label: "Textiles", href: "/shop/textile", image: "/images/artforms/textile.jpg" },
  { label: "Home & Decor", href: "/shop/home-decor", image: "/images/artforms/home-decor.jpg" },
];

let schemaReady: Promise<void> | null = null;

async function createSchema(): Promise<void> {
  // Next evaluates pages in separate worker processes during a build, so the
  // in-process `schemaReady` promise does not serialise them: several workers
  // ran CREATE TABLE IF NOT EXISTS at once and collided in the system catalogue
  // ("duplicate key value violates unique constraint pg_type_typname_nsp_index").
  // A Postgres advisory lock makes the whole migration safe across processes.
  await query("SELECT pg_advisory_lock(918273645)");
  try {
    await createTables();
  } finally {
    await query("SELECT pg_advisory_unlock(918273645)");
  }
}

async function createTables(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS site_hero_slide (
      id SERIAL PRIMARY KEY,
      position INTEGER NOT NULL DEFAULT 0,
      eyebrow TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL,
      tagline TEXT NOT NULL DEFAULT '',
      cta_label TEXT NOT NULL DEFAULT '',
      cta_href TEXT NOT NULL DEFAULT '/shop',
      image TEXT NOT NULL DEFAULT '',
      published BOOLEAN NOT NULL DEFAULT TRUE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS site_art_form (
      id SERIAL PRIMARY KEY,
      position INTEGER NOT NULL DEFAULT 0,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      image TEXT NOT NULL DEFAULT '',
      published BOOLEAN NOT NULL DEFAULT TRUE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Editorial columns added after the first release. `ADD COLUMN IF NOT EXISTS`
  // keeps this idempotent, so a redeploy over an existing database is a no-op
  // rather than an error.
  await query(`ALTER TABLE site_art_form ADD COLUMN IF NOT EXISTS story TEXT NOT NULL DEFAULT ''`);
  await query(`ALTER TABLE site_art_form ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT ''`);
  await query(`ALTER TABLE site_art_form ADD COLUMN IF NOT EXISTS materials TEXT NOT NULL DEFAULT ''`);
  await query(`ALTER TABLE site_art_form ADD COLUMN IF NOT EXISTS quote TEXT NOT NULL DEFAULT ''`);

  // Hindi columns for admin-edited content.
  //
  // Shipping one page of static copy in two languages is a message file; but
  // hero slides, categories, art forms and journal posts are edited by hand in
  // /admin, so a translation has to live beside the English in the same row.
  // Separate per-language tables would need a join and a fallback for every
  // read, and would let a row exist in Hindi with no English — so the columns
  // sit here instead, prefixed and nullable-by-default ('' means "not
  // translated yet", and every reader falls back to the English column).
  for (const column of ["eyebrow_hi", "title_hi", "tagline_hi", "cta_label_hi"]) {
    await query(`ALTER TABLE site_hero_slide ADD COLUMN IF NOT EXISTS ${column} TEXT NOT NULL DEFAULT ''`);
  }
  await query(`ALTER TABLE site_featured_category ADD COLUMN IF NOT EXISTS label_hi TEXT NOT NULL DEFAULT ''`);
  await query(`ALTER TABLE site_art_form ADD COLUMN IF NOT EXISTS name_hi TEXT NOT NULL DEFAULT ''`);
  await query(`ALTER TABLE site_art_form ADD COLUMN IF NOT EXISTS description_hi TEXT NOT NULL DEFAULT ''`);
  await query(`ALTER TABLE site_art_form ADD COLUMN IF NOT EXISTS story_hi TEXT NOT NULL DEFAULT ''`);
  await query(`ALTER TABLE site_art_form ADD COLUMN IF NOT EXISTS origin_hi TEXT NOT NULL DEFAULT ''`);
  await query(`ALTER TABLE site_art_form ADD COLUMN IF NOT EXISTS materials_hi TEXT NOT NULL DEFAULT ''`);
  await query(`ALTER TABLE site_art_form ADD COLUMN IF NOT EXISTS quote_hi TEXT NOT NULL DEFAULT ''`);

  // Fill the essays for the six default art forms where they are still empty —
  // English first, then Hindi.
  //
  // The English half was lost in a way nobody could see. `site_art_form` was
  // seeded with a name, a description and an image only; the essays, materials,
  // region line and quotation lived in `DEFAULT_ART_FORMS` and were never
  // written, so every one of the six art-form pages rendered a header and then
  // nothing at all. The Hindi columns were added later and were empty for the
  // same reason, which made the gap look like a translation problem.
  //
  // Empty is the marker for "not written yet" and every reader falls back to
  // English, so this fills only empty values. A sentence an editor has written in
  // /admin is never touched by a deploy.
  for (const form of DEFAULT_ART_FORMS) {
    const hindi = ART_FORM_HINDI[form.slug];
    await query(
      `UPDATE site_art_form
          SET story     = CASE WHEN story = ''     THEN $2 ELSE story END,
              origin    = CASE WHEN origin = ''    THEN $3 ELSE origin END,
              materials = CASE WHEN materials = '' THEN $4 ELSE materials END,
              quote     = CASE WHEN quote = ''     THEN $5 ELSE quote END,
              name_hi        = CASE WHEN name_hi = ''        THEN $6 ELSE name_hi END,
              description_hi = CASE WHEN description_hi = '' THEN $7 ELSE description_hi END,
              story_hi       = CASE WHEN story_hi = ''       THEN $8 ELSE story_hi END,
              origin_hi      = CASE WHEN origin_hi = ''      THEN $9 ELSE origin_hi END,
              materials_hi   = CASE WHEN materials_hi = ''   THEN $10 ELSE materials_hi END,
              quote_hi       = CASE WHEN quote_hi = ''       THEN $11 ELSE quote_hi END
        WHERE slug = $1`,
      [
        form.slug,
        form.story ?? "",
        form.origin ?? "",
        form.materials ?? "",
        form.quote ?? "",
        hindi?.name ?? "",
        hindi?.description ?? "",
        hindi?.story ?? "",
        hindi?.origin ?? "",
        hindi?.materials ?? "",
        hindi?.quote ?? "",
      ]
    );
  }

  // Maker biographies.
  //
  // /makers derives its entries from product.artist, so this table is optional
  // by design: a maker with no row still appears with a name and a work count.
  // What it adds is the part that cannot be derived — a biography, a portrait, a
  // region — and only where the maker supplied them. `slug` must equal
  // slugify(product.artist) so the PDP maker link lands on the right entry
  // without a second mapping. Single-brand only: in platform mode the artists
  // module is the directory, and a second one would compete with it.
  await query(`
    CREATE TABLE IF NOT EXISTS site_artist (
      id SERIAL PRIMARY KEY,
      position INTEGER NOT NULL DEFAULT 0,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      bio TEXT NOT NULL DEFAULT '',
      portrait TEXT NOT NULL DEFAULT '',
      region TEXT NOT NULL DEFAULT '',
      years_active TEXT NOT NULL DEFAULT '',
      published BOOLEAN NOT NULL DEFAULT TRUE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`ALTER TABLE site_artist ADD COLUMN IF NOT EXISTS name_hi TEXT NOT NULL DEFAULT ''`);
  await query(`ALTER TABLE site_artist ADD COLUMN IF NOT EXISTS bio_hi TEXT NOT NULL DEFAULT ''`);
  await query(`ALTER TABLE site_artist ADD COLUMN IF NOT EXISTS region_hi TEXT NOT NULL DEFAULT ''`);
  await query(`ALTER TABLE journal_posts ADD COLUMN IF NOT EXISTS title_hi TEXT NOT NULL DEFAULT ''`);
  await query(`ALTER TABLE journal_posts ADD COLUMN IF NOT EXISTS excerpt_hi TEXT NOT NULL DEFAULT ''`);
  await query(`ALTER TABLE journal_posts ADD COLUMN IF NOT EXISTS content_hi TEXT NOT NULL DEFAULT ''`);
  // Which tradition an essay is about, by art-form slug. Empty means the essay
  // is not about one tradition in particular. A column rather than a join table
  // because the relationship runs one way: an essay belongs to at most one
  // tradition, while a tradition may have several essays.
  await query(`ALTER TABLE journal_posts ADD COLUMN IF NOT EXISTS art_form TEXT NOT NULL DEFAULT ''`);

  // Buyer words. Kept separate from journal posts because a testimonial is an
  // attribution (who, where, which work) rather than an essay.
  await query(`
    CREATE TABLE IF NOT EXISTS site_testimonial (
      id SERIAL PRIMARY KEY,
      position INTEGER NOT NULL DEFAULT 0,
      quote TEXT NOT NULL,
      author TEXT NOT NULL,
      location TEXT NOT NULL DEFAULT '',
      work TEXT NOT NULL DEFAULT '',
      published BOOLEAN NOT NULL DEFAULT TRUE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS site_featured_category (
      id SERIAL PRIMARY KEY,
      position INTEGER NOT NULL DEFAULT 0,
      label TEXT NOT NULL,
      href TEXT NOT NULL,
      image TEXT NOT NULL DEFAULT '',
      published BOOLEAN NOT NULL DEFAULT TRUE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Product copy in a second language.
  //
  // Medusa keeps one title per product, so translated titles need somewhere of
  // their own. Keying on (handle, locale) rather than on product id keeps this
  // readable and lets a row outlive a product delete/recreate cycle in Medusa.
  // An empty string means "not translated yet" and the caller falls back to the
  // Medusa title — that is deliberate, so a half-finished translation shows the
  // English name rather than a blank card.
  await query(`
    CREATE TABLE IF NOT EXISTS product_translation (
      id SERIAL PRIMARY KEY,
      handle TEXT NOT NULL,
      locale TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (handle, locale)
    )
  `);
  await query(
    `CREATE INDEX IF NOT EXISTS product_translation_locale_idx ON product_translation (locale)`
  );

  // Seed once. A table that already has rows is left untouched so admin edits
  // are never overwritten by a redeploy.
  const slides = await queryResult<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM site_hero_slide"
  );
  if (slides.rows[0]?.count === "0") {
    for (const [index, slide] of DEFAULT_HERO_SLIDES.entries()) {
      await query(
        `INSERT INTO site_hero_slide
           (position, eyebrow, title, tagline, cta_label, cta_href, image)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          index,
          slide.eyebrow,
          slide.title,
          slide.tagline,
          slide.cta_label,
          slide.cta_href,
          slide.image,
        ]
      );
    }
  }

  const forms = await queryResult<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM site_art_form"
  );
  if (forms.rows[0]?.count === "0") {
    for (const [index, form] of DEFAULT_ART_FORMS.entries()) {
      // Seed both languages. The Hindi columns existed and were filled by
      // hand-mode only, so a fresh install produced a Hindi storefront whose
      // essays were English — the reader had no way to tell.
      const hindi = ART_FORM_HINDI[form.slug];
      await query(
        `INSERT INTO site_art_form
           (position, slug, name, description, image, story, origin, materials, quote,
            name_hi, description_hi, story_hi, origin_hi, materials_hi, quote_hi)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
         ON CONFLICT (slug) DO NOTHING`,
        [
          index,
          form.slug,
          form.name,
          form.description,
          form.image,
          form.story ?? "",
          form.origin ?? "",
          form.materials ?? "",
          form.quote ?? "",
          hindi?.name ?? "",
          hindi?.description ?? "",
          hindi?.story ?? "",
          hindi?.origin ?? "",
          hindi?.materials ?? "",
          hindi?.quote ?? "",
        ]
      );
    }
  }

  const categories = await queryResult<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM site_featured_category"
  );
  if (categories.rows[0]?.count === "0") {
    for (const [index, category] of DEFAULT_FEATURED_CATEGORIES.entries()) {
      await query(
        `INSERT INTO site_featured_category (position, label, href, image)
         VALUES ($1,$2,$3,$4)`,
        [index, category.label, category.href, category.image]
      );
    }
  }
}

/** Create and seed the tables once per process. */
export function ensureSeeded(): Promise<void> {
  if (!schemaReady) {
    schemaReady = createSchema().catch((err) => {
      // Let the next call retry rather than caching a permanent failure.
      schemaReady = null;
      throw err;
    });
  }
  return schemaReady;
}

async function safeRows<T extends Record<string, any>>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  try {
    await ensureSeeded();
    const result = await queryResult<T>(sql, params);
    return result.rows;
  } catch (err) {
    // The storefront must render even if Postgres is unreachable; the homepage
    // falls back to the defaults in that case.
    //
    // During `next build` there is no database to reach, and Next still
    // evaluates these helpers while collecting traces. Printing a full
    // ECONNREFUSED stack for every one of them buries the errors that matter,
    // so the build sets SITE_CONTENT_QUIET and gets one line instead. At
    // runtime the full error stays, because then it is a real incident.
    if (process.env.SITE_CONTENT_QUIET === "1") {
      console.warn("site content unavailable (building without a database)");
    } else {
      console.error("site content query failed", err);
    }
    return [];
  }
}

/* ------------------------------- public reads ------------------------------ */

/**
 * Overlay the `_hi` columns onto English rows when the locale is Hindi.
 *
 * Admin-edited content keeps both languages in one row, so the read path is a
 * projection rather than a join. An empty Hindi value falls back to the English
 * one: a half-translated slide shows some English rather than a blank, which is
 * the lesser failure on a live shop.
 */
function withHindi<T extends object>(
  rows: T[],
  locale: string,
  fields: readonly string[]
): T[] {
  if (locale !== "hi") return rows;

  return rows.map((row) => {
    const merged: Record<string, unknown> = { ...(row as Record<string, unknown>) };
    for (const field of fields) {
      const hindi = merged[`${field}_hi`];
      if (typeof hindi === "string" && hindi.trim()) merged[field] = hindi;
    }
    return merged as T;
  });
}

export async function listHeroSlides(locale = "en"): Promise<HeroSlide[]> {
  // Database only. The former hardcoded fallback meant an empty table still
  // rendered a homepage an editor could not see, change or delete.
  const rows = await safeRows<HeroSlide>(
    "SELECT * FROM site_hero_slide WHERE published ORDER BY position, id"
  );
  return withHindi(rows, locale, ["eyebrow", "title", "tagline", "cta_label"]);
}

export async function listArtForms(locale = "en"): Promise<ArtForm[]> {
  const rows = await safeRows<ArtForm>(
    "SELECT * FROM site_art_form WHERE published ORDER BY position, id"
  );
  return withHindi(rows, locale, [
    "name",
    "description",
    "story",
    "origin",
    "materials",
    "quote",
  ]);
}

export async function listFeaturedCategories(
  locale = "en"
): Promise<FeaturedCategory[]> {
  const rows = await safeRows<FeaturedCategory>(
    "SELECT * FROM site_featured_category WHERE published ORDER BY position, id"
  );
  return withHindi(rows, locale, ["label"]);
}

export async function listTestimonials(): Promise<Testimonial[]> {
  return safeRows<Testimonial>(
    "SELECT * FROM site_testimonial WHERE published ORDER BY position, id"
  );
}

export async function listAllTestimonials(): Promise<Testimonial[]> {
  return safeRows<Testimonial>("SELECT * FROM site_testimonial ORDER BY position, id");
}

/* ---------------------------- product translations ------------------------- */

export type ProductTranslation = {
  handle: string;
  locale: string;
  title: string;
  description: string;
};

/**
 * Translated product copy for one locale, keyed by handle.
 *
 * Returns a map rather than an array because every caller wants to look up by
 * handle while mapping over a product list. A missing handle means "not
 * translated", and callers fall back to the Medusa title — showing English is
 * better than showing nothing.
 */
export async function productTranslationsFor(
  locale: string
): Promise<Map<string, ProductTranslation>> {
  const rows = await safeRows<ProductTranslation>(
    `SELECT handle, locale, title, description
       FROM product_translation
      WHERE locale = $1 AND title <> ''`,
    [locale]
  );
  return new Map(rows.map((row) => [row.handle, row]));
}

/** Every translated row, for the admin editor. */
export async function listProductTranslations(): Promise<ProductTranslation[]> {
  return safeRows<ProductTranslation>(
    "SELECT handle, locale, title, description FROM product_translation ORDER BY handle, locale"
  );
}

/**
 * Swap in translated art-form names and descriptions.
 *
 * Art forms live in Postgres, so a Hindi visitor would otherwise read a Hindi
 * product grid under an English section heading — the one place the two
 * languages visibly collide. Keyed on the taxonomy slug, which is stable across
 * the admin renaming a form.
 *
 * Falls back to the stored value for any form without a translation, so a form
 * added in the admin panel shows its own name rather than nothing.
 */
export function translateArtForms<T extends { slug: string; name: string; description?: string }>(
  forms: T[],
  translate: (key: string) => string,
  has: (key: string) => boolean
): T[] {
  return forms.map((form) => {
    const nameKey = `names.${form.slug}`;
    const descKey = `descriptions.${form.slug}`;
    return {
      ...form,
      name: has(nameKey) ? translate(nameKey) : form.name,
      description: has(descKey) ? translate(descKey) : form.description,
    };
  });
}

/**
 * Translated names for Medusa product categories.
 *
 * Categories live in Medusa, which has one name per record — the same problem
 * product titles had. This table is the product_translation pattern applied to
 * categories: keyed on Medusa's handle, so it survives a category being
 * renamed in the admin without re-keying on an id nobody types.
 */
export async function ensureCategoryTranslations(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS category_translation (
      id SERIAL PRIMARY KEY,
      handle TEXT NOT NULL,
      locale TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (handle, locale)
    )
  `);
}

export async function categoryTranslationsFor(
  locale: string
): Promise<Map<string, string>> {
  if (locale === "en") return new Map();
  await ensureCategoryTranslations();
  const rows = await safeRows<{ handle: string; name: string }>(
    `SELECT handle, name FROM category_translation WHERE locale = $1 AND name <> ''`,
    [locale]
  );
  return new Map(rows.map((row) => [row.handle, row.name]));
}

/**
 * Write one translation. An empty title deletes the row rather than storing a
 * blank, so "clear this field" returns the product to its English name instead
 * of leaving an invisible empty string behind.
 */
export async function saveProductTranslation(input: {
  handle: string;
  locale: string;
  title: string;
  description?: string;
}): Promise<void> {
  await ensureSeeded();
  const title = input.title.trim();
  if (!title) {
    await query(
      "DELETE FROM product_translation WHERE handle = $1 AND locale = $2",
      [input.handle, input.locale]
    );
    return;
  }
  await query(
    `INSERT INTO product_translation (handle, locale, title, description, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (handle, locale)
     DO UPDATE SET title = EXCLUDED.title,
                   description = EXCLUDED.description,
                   updated_at = NOW()`,
    [input.handle, input.locale, title, input.description?.trim() ?? ""]
  );
}

/* ------------------------------- admin writes ------------------------------ */

export async function listAllHeroSlides(): Promise<HeroSlide[]> {
  return safeRows<HeroSlide>(
    "SELECT * FROM site_hero_slide ORDER BY position, id"
  );
}

export async function listAllArtForms(): Promise<ArtForm[]> {
  return safeRows<ArtForm>("SELECT * FROM site_art_form ORDER BY position, id");
}

export async function listAllFeaturedCategories(): Promise<FeaturedCategory[]> {
  return safeRows<FeaturedCategory>(
    "SELECT * FROM site_featured_category ORDER BY position, id"
  );
}

type Writable<T> = Omit<T, "id" | "position">;

export async function createHeroSlide(input: Writable<HeroSlide>): Promise<void> {
  await ensureSeeded();
  await query(
    `INSERT INTO site_hero_slide
       (position, eyebrow, title, tagline, cta_label, cta_href, image, published)
     VALUES
       (COALESCE((SELECT MAX(position) + 1 FROM site_hero_slide), 0),
        $1,$2,$3,$4,$5,$6,$7)`,
    [
      input.eyebrow,
      input.title,
      input.tagline,
      input.cta_label,
      input.cta_href,
      input.image,
      input.published,
    ]
  );
}

export async function updateHeroSlide(
  id: number,
  input: Writable<HeroSlide>
): Promise<void> {
  await ensureSeeded();
  await query(
    `UPDATE site_hero_slide SET
       eyebrow=$2, title=$3, tagline=$4, cta_label=$5, cta_href=$6,
       image=$7, published=$8, updated_at=NOW()
     WHERE id=$1`,
    [
      id,
      input.eyebrow,
      input.title,
      input.tagline,
      input.cta_label,
      input.cta_href,
      input.image,
      input.published,
    ]
  );
}

export async function deleteHeroSlide(id: number): Promise<void> {
  await ensureSeeded();
  await query("DELETE FROM site_hero_slide WHERE id=$1", [id]);
}

export async function createArtForm(input: Writable<ArtForm>): Promise<void> {
  await ensureSeeded();
  await query(
    `INSERT INTO site_art_form
       (position, slug, name, description, image, published,
        story, origin, materials, quote)
     VALUES
       (COALESCE((SELECT MAX(position) + 1 FROM site_art_form), 0),
        $1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      input.slug,
      input.name,
      input.description,
      input.image,
      input.published,
      input.story ?? "",
      input.origin ?? "",
      input.materials ?? "",
      input.quote ?? "",
    ]
  );
}

export async function updateArtForm(
  id: number,
  input: Writable<ArtForm>
): Promise<void> {
  await ensureSeeded();
  await query(
    `UPDATE site_art_form SET
       slug=$2, name=$3, description=$4, image=$5, published=$6,
       story=$7, origin=$8, materials=$9, quote=$10,
       updated_at=NOW()
     WHERE id=$1`,
    [
      id,
      input.slug,
      input.name,
      input.description,
      input.image,
      input.published,
      input.story ?? "",
      input.origin ?? "",
      input.materials ?? "",
      input.quote ?? "",
    ]
  );
}

export async function deleteArtForm(id: number): Promise<void> {
  await ensureSeeded();
  await query("DELETE FROM site_art_form WHERE id=$1", [id]);
}

/* --------------------------------- artists -------------------------------- */

/**
 * Published makers, keyed for the /makers page.
 *
 * Returns an empty array rather than throwing when the table is unreachable:
 * the page derives its entries from the catalogue, so a missing biography must
 * never take the whole directory down.
 */
export async function listArtists(locale = "en"): Promise<SiteArtist[]> {
  const rows = await safeRows<SiteArtist>(
    "SELECT * FROM site_artist WHERE published ORDER BY position, id"
  );
  return withHindi(rows, locale, ["name", "bio", "region"]);
}

export async function listAllArtists(): Promise<SiteArtist[]> {
  return safeRows<SiteArtist>("SELECT * FROM site_artist ORDER BY position, id");
}

export async function createArtist(input: Writable<SiteArtist>): Promise<void> {
  await ensureSeeded();
  await query(
    `INSERT INTO site_artist
       (position, slug, name, bio, portrait, region, years_active, published)
     VALUES
       (COALESCE((SELECT MAX(position) + 1 FROM site_artist), 0),
        $1,$2,$3,$4,$5,$6,$7)`,
    [
      input.slug,
      input.name,
      input.bio,
      input.portrait,
      input.region,
      input.years_active,
      input.published,
    ]
  );
}

export async function updateArtist(
  id: number,
  input: Writable<SiteArtist>
): Promise<void> {
  await ensureSeeded();
  await query(
    `UPDATE site_artist SET
       slug=$2, name=$3, bio=$4, portrait=$5, region=$6,
       years_active=$7, published=$8, updated_at=NOW()
     WHERE id=$1`,
    [
      id,
      input.slug,
      input.name,
      input.bio,
      input.portrait,
      input.region,
      input.years_active,
      input.published,
    ]
  );
}

export async function deleteArtist(id: number): Promise<void> {
  await ensureSeeded();
  await query("DELETE FROM site_artist WHERE id=$1", [id]);
}

export async function createTestimonial(
  input: Writable<Testimonial>
): Promise<void> {
  await ensureSeeded();
  await query(
    `INSERT INTO site_testimonial (position, quote, author, location, work, published)
     VALUES
       (COALESCE((SELECT MAX(position) + 1 FROM site_testimonial), 0),
        $1,$2,$3,$4,$5)`,
    [input.quote, input.author, input.location, input.work, input.published]
  );
}

export async function updateTestimonial(
  id: number,
  input: Writable<Testimonial>
): Promise<void> {
  await ensureSeeded();
  await query(
    `UPDATE site_testimonial
        SET quote = $1, author = $2, location = $3, work = $4,
            published = $5, updated_at = NOW()
      WHERE id = $6`,
    [input.quote, input.author, input.location, input.work, input.published, id]
  );
}

export async function deleteTestimonial(id: number): Promise<void> {
  await ensureSeeded();
  await query("DELETE FROM site_testimonial WHERE id = $1", [id]);
}

export async function createFeaturedCategory(
  input: Writable<FeaturedCategory>
): Promise<void> {
  await ensureSeeded();
  await query(
    `INSERT INTO site_featured_category (position, label, href, image, published)
     VALUES
       (COALESCE((SELECT MAX(position) + 1 FROM site_featured_category), 0),
        $1,$2,$3,$4)`,
    [input.label, input.href, input.image, input.published]
  );
}

export async function updateFeaturedCategory(
  id: number,
  input: Writable<FeaturedCategory>
): Promise<void> {
  await ensureSeeded();
  await query(
    `UPDATE site_featured_category SET
       label=$2, href=$3, image=$4, published=$5, updated_at=NOW()
     WHERE id=$1`,
    [id, input.label, input.href, input.image, input.published]
  );
}

export async function deleteFeaturedCategory(id: number): Promise<void> {
  await ensureSeeded();
  await query("DELETE FROM site_featured_category WHERE id=$1", [id]);
}

/** Move a row up or down within its table by swapping positions. */
export async function reorder(
  table:
    | "site_hero_slide"
    | "site_art_form"
    | "site_featured_category"
    | "site_testimonial"
    | "site_artist",
  id: number,
  direction: "up" | "down"
): Promise<void> {
  await ensureSeeded();
  // Table name is from a closed union above, never user input.
  const rows = await queryResult<{ id: number; position: number }>(
    `SELECT id, position FROM ${table} ORDER BY position, id`
  );
  const index = rows.rows.findIndex((row) => row.id === id);
  if (index < 0) return;

  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (swapWith < 0 || swapWith >= rows.rows.length) return;

  const a = rows.rows[index];
  const b = rows.rows[swapWith];
  await query(`UPDATE ${table} SET position=$2 WHERE id=$1`, [a.id, b.position]);
  await query(`UPDATE ${table} SET position=$2 WHERE id=$1`, [b.id, a.position]);
}

/* ── Journal ───────────────────────────────────────────────────────────────
   The journal is the part of the site that teaches. Sample essays are seeded
   once so a fresh database is not an empty page, then owned by the admin at
   /admin/journal — editing or deleting a seeded piece is permanent, because the
   seed only runs when the table has no rows at all. */
export async function ensureJournalSeeded(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS journal_posts (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      content TEXT,
      excerpt TEXT,
      cover_image TEXT,
      author TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      published_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT now(),
      updated_at TIMESTAMP NOT NULL DEFAULT now()
    )
  `);

  const count = await queryResult<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM journal_posts"
  );
  if (count.rows[0]?.count !== "0") return;

  const { DEFAULT_JOURNAL_POSTS } = await import("@/lib/journal-seed");
  for (const post of DEFAULT_JOURNAL_POSTS) {
    await query(
      `INSERT INTO journal_posts
         (title, slug, content, excerpt, cover_image, author, status, published_at)
       VALUES ($1,$2,$3,$4,$5,$6,'published', NOW() - ($7 || ' days')::interval)
       ON CONFLICT (slug) DO NOTHING`,
      [
        post.title,
        post.slug,
        post.content,
        post.excerpt,
        post.cover_image,
        post.author,
        String(post.daysAgo),
      ]
    );
  }
}
