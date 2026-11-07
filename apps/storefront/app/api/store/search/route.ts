/**
 * GET /api/store/search - Universal search across products, categories, artists, journal
 * Query params: q (search term), limit (max results per type)
 */

import { NextResponse } from "next/server";
import { medusa } from "@/lib/medusa";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") || "";
    const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 50);

    if (!q) {
      return NextResponse.json({ results: [], query: "" });
    }

    const results: any[] = [];

    // Search products
    try {
      const { products } = await medusa.listProducts({
        limit,
        q,
      });
      for (const product of products) {
        results.push({
          type: "product",
          id: product.id,
          title: product.title,
          handle: product.handle,
          subtitle: product.subtitle,
          description: product.description,
          image: product.thumbnail,
          price: product.variants?.[0]?.prices?.[0]?.amount ?? null,
          currency: product.variants?.[0]?.prices?.[0]?.currency_code ?? "inr",
          url: `/products/${product.handle}`,
          matchScore: product.title.toLowerCase().includes(q.toLowerCase()) ? 2 : 1,
        });
      }
    } catch (err) {
      console.error("Product search failed:", err);
    }

    // Search categories via Medusa admin product-categories
    try {
      const BACKEND_URL =
        process.env.MEDUSA_BACKEND_URL ||
        process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ||
        "http://localhost:9000";
      const PUBLISHABLE_KEY =
        process.env.MEDUSA_PUBLISHABLE_KEY ||
        process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ||
        "";

      const catRes = await fetch(
        `${BACKEND_URL}/admin/product-categories?limit=${limit}&q=${encodeURIComponent(q)}`,
        {
          headers: {
            "x-publishable-api-key": PUBLISHABLE_KEY,
          },
        }
      );

      if (catRes.ok) {
        const catData = await catRes.json();
        const categories = catData.product_categories ?? catData.categories ?? [];
        for (const category of categories) {
          results.push({
            type: "category",
            id: category.id,
            title: category.name,
            description: category.description,
            handle: category.handle,
            url: `/shop/${category.handle}`,
            matchScore: category.name.toLowerCase().includes(q.toLowerCase())
              ? 2
              : 1,
          });
        }
      }
    } catch (err) {
      console.error("Category search failed:", err);
    }

    // Search artists
    try {
      const { artists } = await medusa.listArtists({
        limit,
        q,
      });
      for (const artist of artists) {
        results.push({
          type: "artist",
          id: artist.id,
          title: artist.display_name,
          description: artist.bio,
          image: artist.portrait_media_id,
          url: `/artists/${artist.slug}`,
          matchScore: artist.display_name.toLowerCase().includes(
            q.toLowerCase()
          )
            ? 2
            : 1,
        });
      }
    } catch (err) {
      console.error("Artist search failed:", err);
    }

    // Sort by match score (exact title match first) then limit
    results.sort((a, b) => b.matchScore - a.matchScore);
    const limited = results.slice(0, limit);

    return NextResponse.json({ results, query: q, count: limited.length });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Search failed", results: [], query: "" },
      { status: 500 }
    );
  }
}
