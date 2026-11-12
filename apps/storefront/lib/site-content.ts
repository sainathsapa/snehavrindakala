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
      "Original paintings, sketches, portraits, prints, and illustration across mediums.",
    image: "/images/artforms/painting.jpg",
  },
  {
    slug: "folk",
    name: "Traditional & Folk Art",
    description:
      "Handmade works rooted in regional traditions and passed-down technique.",
    image: "/images/artforms/folk.jpg",
  },
  {
    slug: "home-decor",
    name: "Home & Decorative Art",
    description:
      "Sculptural and functional pieces that bring craft into daily living.",
    image: "/images/artforms/home-decor.jpg",
  },
  {
    slug: "textile",
    name: "Textile & Fibre Art",
    description:
      "Woven, printed, and embroidered textiles made on handlooms and by hand.",
    image: "/images/artforms/textile.jpg",
  },
  {
    slug: "paper",
    name: "Paper, Stationery & Books",
    description:
      "Journals, prints, and paper goods made from handmade and recycled stock.",
    image: "/images/artforms/paper.jpg",
  },
  {
    slug: "wearable",
    name: "Wearable Art",
    description: "Jewellery and adornment crafted as small, personal artworks.",
    image: "/images/artforms/wearable.jpg",
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
       (position, slug, name, description, image, published)
     VALUES
       (COALESCE((SELECT MAX(position) + 1 FROM site_art_form), 0),
        $1,$2,$3,$4,$5)`,
    [input.slug, input.name, input.description, input.image, input.published]
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
       updated_at=NOW()
     WHERE id=$1`,
    [id, input.slug, input.name, input.description, input.image, input.published]
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
