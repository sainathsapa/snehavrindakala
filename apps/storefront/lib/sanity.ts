/**
 * Sanity CMS client for SnehaVrinda Kala editorial content.
 *
 * Connects to Sanity project: 1ifsr3lr, dataset: production.
 * Per build plan Section 12.5: Sanity owns editorial content only;
 * product/price/stock/order fields remain in Medusa. Sanity stories
 * refer to Medusa artist/product IDs rather than duplicating operational data.
 */

import { createClient } from "next-sanity";
import createImageUrlBuilder from "@sanity/image-url";
import type { SanityImageSource } from "@sanity/image-url/lib/types/types";

const projectId = "1ifsr3lr";
const dataset = "production";
const apiVersion = "2026-01-01";

/**
 * Sanity client for server-side fetching.
 * Uses the CDN API for public editorial content; bypass cache for drafts
 * via the `stega` / `token` when previewing.
 */
export const sanityClient = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: process.env.NODE_ENV === "production",
  perspective: "published",
  stega: process.env.SANITY_API_TOKEN ? { studioUrl: "https://1ifsr3lr.sanity.studio" } : undefined,
  token: process.env.SANITY_API_TOKEN,
});

/**
 * Sanity client for preview / draft content (server-side only).
 * Used when Sanity webhook triggers revalidation with a secret token.
 */
export const previewClient = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: false,
  token: process.env.SANITY_API_TOKEN,
});

/**
 * Get the appropriate client based on whether we're previewing drafts.
 */
export function getClient(preview = false) {
  return preview ? previewClient : sanityClient;
}

/**
 * Image URL builder for Sanity assets.
 */
export function urlFor(source: SanityImageSource) {
  const builder = createImageUrlBuilder({
    projectId,
    dataset,
  });
  return builder.image(source);
}

/**
 * Sanity query helpers for editorial content.
 */

export interface SanityArticle {
  _id: string;
  _type: "article";
  title: string;
  slug: { current: string };
  excerpt?: string | null;
  body: any[];
  cover_image?: { asset: { _ref: string; url: string } } | null;
  related_artist_id?: string | null;
  related_product_id?: string | null;
  published_at?: string | null;
  _updatedAt: string;
}

export interface SanityHomepage {
  _id: string;
  _type: "homepage";
  title?: string | null;
  announcement?: string | null;
  hero_content?: string | null;
  featured_collection?: { _ref: string } | null;
  _updatedAt: string;
}

export interface SanityCollection {
  _id: string;
  _type: "collection";
  title: string;
  slug: { current: string };
  description?: string | null;
  _updatedAt: string;
}

export interface SanityArtistStory {
  _id: string;
  _type: "artistStory";
  title: string;
  slug: { current: string };
  excerpt?: string | null;
  body: any[];
  cover_image?: { asset: { _ref: string; url: string } } | null;
  artist_id?: string | null;
  published_at?: string | null;
  _updatedAt: string;
}

export interface SanityTutorial {
  _id: string;
  _type: "tutorial";
  title: string;
  slug: { current: string };
  excerpt?: string | null;
  body: any[];
  cover_image?: { asset: { _ref: string; url: string } } | null;
  youtube_url?: string | null;
  skill_level?: string | null;
  published_at?: string | null;
  _updatedAt: string;
}

export interface SanityFAQ {
  _id: string;
  _type: "faq";
  question: string;
  answer: string;
  category: string;
}

/**
 * Fetch all published articles for the journal listing.
 */
export async function getArticles(preview = false): Promise<SanityArticle[]> {
  const client = getClient(preview);
  return client.fetch(
    `*[_type == "article"] | order(published_at desc, _updatedAt desc) {
      _id,
      _type,
      title,
      "slug": slug.current,
      excerpt,
      body,
      cover_image,
      "related_artist_id": related_artist_id,
      "related_product_id": related_product_id,
      published_at,
      _updatedAt
    }`
  );
}

/**
 * Fetch a single article by slug.
 */
export async function getArticleBySlug(
  slug: string,
  preview = false
): Promise<SanityArticle | null> {
  const client = getClient(preview);
  const article = await client.fetch(
    `*[_type == "article" && slug.current == $slug][0] {
      _id,
      _type,
      title,
      "slug": slug.current,
      excerpt,
      body,
      cover_image,
      "related_artist_id": related_artist_id,
      "related_product_id": related_product_id,
      published_at,
      _updatedAt
    }`,
    { slug }
  );
  return article ?? null;
}

/**
 * Fetch all published artist stories.
 */
export async function getArtistStories(preview = false): Promise<SanityArtistStory[]> {
  const client = getClient(preview);
  return client.fetch(
    `*[_type == "artistStory"] | order(published_at desc, _updatedAt desc) {
      _id,
      _type,
      title,
      "slug": slug.current,
      excerpt,
      body,
      cover_image,
      "artist_id": artist_id,
      published_at,
      _updatedAt
    }`
  );
}

/**
 * Fetch all published tutorials.
 */
export async function getTutorials(preview = false): Promise<SanityTutorial[]> {
  const client = getClient(preview);
  return client.fetch(
    `*[_type == "tutorial"] | order(published_at desc, _updatedAt desc) {
      _id,
      _type,
      title,
      "slug": slug.current,
      excerpt,
      body,
      cover_image,
      youtube_url,
      skill_level,
      published_at,
      _updatedAt
    }`
  );
}

/**
 * Fetch FAQs by category.
 */
export async function getFAQs(category?: string, preview = false): Promise<SanityFAQ[]> {
  const client = getClient(preview);
  const query = category
    ? `*[_type == "faq" && category == $category] | order(_updatedAt desc)`
    : `*[_type == "faq"] | order(_updatedAt desc)`;
  return client.fetch(query, { category });
}

/**
 * Fetch homepage content.
 */
export async function getHomepage(preview = false): Promise<SanityHomepage | null> {
  const client = getClient(preview);
  const homepage = await client.fetch(
    `*[_type == "homepage"][0] {
      _id,
      _type,
      title,
      announcement,
      hero_content,
      "featured_collection": featured_collection._ref,
      _updatedAt
    }`
  );
  return homepage ?? null;
}
