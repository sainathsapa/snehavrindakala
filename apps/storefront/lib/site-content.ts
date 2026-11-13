import { query, queryResult } from "@/lib/db";

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
  /** One line of origin, e.g. "Mithila, Bihar · 14th century onward". */
  origin?: string;
  /** Materials or techniques, as a comma-separated list. */
  materials?: string;
  /** Pull quote shown beside the story. */
  quote?: string;
}

export interface FeaturedCategory {
  id: number;
  position: number;
  label: string;
  href: string;
  image: string;
  published: boolean;
}

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
      await query(
        `INSERT INTO site_art_form
           (position, slug, name, description, image)
         VALUES ($1,$2,$3,$4,$5)`,
        [index, form.slug, form.name, form.description, form.image]
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
    console.error("site content query failed", err);
    return [];
  }
}

/* ------------------------------- public reads ------------------------------ */

export async function listHeroSlides(): Promise<HeroSlide[]> {
  const rows = await safeRows<HeroSlide>(
    "SELECT * FROM site_hero_slide WHERE published ORDER BY position, id"
  );
  if (rows.length > 0) return rows;
  return DEFAULT_HERO_SLIDES.map((slide, index) => ({
    id: index + 1,
    position: index,
    published: true,
    ...slide,
  }));
}

export async function listArtForms(): Promise<ArtForm[]> {
  const rows = await safeRows<ArtForm>(
    "SELECT * FROM site_art_form WHERE published ORDER BY position, id"
  );
  if (rows.length > 0) return rows;
  return DEFAULT_ART_FORMS.map((form, index) => ({
    id: index + 1,
    position: index,
    published: true,
    ...form,
  }));
}

export async function listFeaturedCategories(): Promise<FeaturedCategory[]> {
  const rows = await safeRows<FeaturedCategory>(
    "SELECT * FROM site_featured_category WHERE published ORDER BY position, id"
  );
  if (rows.length > 0) return rows;
  return DEFAULT_FEATURED_CATEGORIES.map((category, index) => ({
    id: index + 1,
    position: index,
    published: true,
    ...category,
  }));
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
  table: "site_hero_slide" | "site_art_form" | "site_featured_category",
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
