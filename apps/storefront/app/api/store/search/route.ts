/**
 * GET /api/store/search - Universal search across products, categories, artists
 * Query params: q (search term), limit (max results per type)
 */

import { NextResponse } from "next/server";
import { universalSearch } from "@/lib/search";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") || "";
    const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 50);

    const data = await universalSearch(q, limit);
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Search failed", results: [], query: "" },
      { status: 500 }
    );
  }
}
