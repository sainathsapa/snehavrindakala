/**
 * POST /api/admin/partners - Create a partner/artist
 */

import { NextResponse } from "next/server";
import { requireAdmin } from "@/app/admin/actions";
import { getSystemAdminToken, listAdminArtists } from "@/lib/admin";

async function adminAuthHeader(): Promise<Record<string, string>> {
  const token = await getSystemAdminToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function GET(req: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(req.url);
    const data = await listAdminArtists({
      limit: parseInt(searchParams.get("limit") || "20"),
      offset: parseInt(searchParams.get("offset") || "0"),
      q: searchParams.get("q") || undefined,
    });
    const partners = (data.artists || []).map((artist: any) => ({
      id: artist.id,
      name: artist.display_name || artist.name || "",
      email: artist.email || "",
      status: artist.status || (artist.is_verified ? "active" : "pending"),
      commission_rate: artist.commission_rate || 0,
      created_at: artist.created_at || "",
    }));
    return NextResponse.json({ partners, count: data.count ?? partners.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await req.json();
    const BACKEND_URL =
      process.env.MEDUSA_BACKEND_URL ||
      process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ||
      "http://localhost:9000";
    const PUBLISHABLE_KEY =
      process.env.MEDUSA_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ||
      "";

    const res = await fetch(`${BACKEND_URL}/admin/artists`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-publishable-api-key": PUBLISHABLE_KEY,
        ...(await adminAuthHeader()),
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const error = await res.text();
      return NextResponse.json({ error: error }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
