/**
 * Sanity CMS client for SnehaVrinda Kala editorial content.
 *
 * Editorial content only: products, prices, stock, and orders stay in Medusa.
 * Configure via NEXT_PUBLIC_SANITY_* (safe for the browser) and
 * SANITY_API_TOKEN (server-only, required only for draft previews).
 */

import { createClient } from "next-sanity";
import createImageUrlBuilder from "@sanity/image-url";
import type { SanityImageSource } from "@sanity/image-url/lib/types/types";

const projectId =
  process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ||
  process.env.SANITY_PROJECT_ID ||
  "";
const dataset =
  process.env.NEXT_PUBLIC_SANITY_DATASET ||
  process.env.SANITY_DATASET ||
  "production";
const apiVersion =
  process.env.NEXT_PUBLIC_SANITY_API_VERSION ||
  process.env.SANITY_API_VERSION ||
  "2026-01-01";

const isConfigured = Boolean(projectId);

export const sanityClient = isConfigured
  ? createClient({
      projectId,
      dataset,
      apiVersion,
      useCdn: process.env.NODE_ENV === "production",
      perspective: "published",
    })
  : null;

export const previewClient = isConfigured
  ? createClient({
      projectId,
      dataset,
      apiVersion,
      useCdn: false,
      token: process.env.SANITY_API_TOKEN,
    })
  : null;

export function getClient(preview = false) {
  const client = preview ? previewClient : sanityClient;
  if (!client) {
    throw new Error(
      "Sanity is not configured. Set NEXT_PUBLIC_SANITY_PROJECT_ID and NEXT_PUBLIC_SANITY_DATASET."
    );
  }
  return client;
}

export function urlFor(source: SanityImageSource) {
  if (!isConfigured) {
    throw new Error("Sanity is not configured.");
  }
  return createImageUrlBuilder({ projectId, dataset }).image(source);
}

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

export async function getArticles(
  preview = false
): Promise<SanityArticle[]> {
  if (!isConfigured) return [];
  return getClient(preview).fetch(
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

export async function getArticleBySlug(
  slug: string,
  preview = false
): Promise<SanityArticle | null> {
  if (!isConfigured) return null;
  const article = await getClient(preview).fetch(
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

export async function getArtistStories(
  preview = false
): Promise<SanityArtistStory[]> {
  if (!isConfigured) return [];
  return getClient(preview).fetch(
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

export async function getTutorials(
  preview = false
): Promise<SanityTutorial[]> {
  if (!isConfigured) return [];
  return getClient(preview).fetch(
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

export async function getFAQs(
  category?: string,
  preview = false
): Promise<SanityFAQ[]> {
  if (!isConfigured) return [];
  const query = category
    ? `*[_type == "faq" && category == $category] | order(_updatedAt desc)`
    : `*[_type == "faq"] | order(_updatedAt desc)`;
  return getClient(preview).fetch(query, { category });
}

export async function getHomepage(
  preview = false
): Promise<SanityHomepage | null> {
  if (!isConfigured) return null;
  const homepage = await getClient(preview).fetch(
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
