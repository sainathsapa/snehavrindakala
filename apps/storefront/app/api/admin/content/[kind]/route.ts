/**
 * Admin content API: rooms and the newsroom share one handler.
 *
 * Both are "a row with a slug", so the validation is the same shape: the slug is
 * required and unique, the title is required, and the collection/published
 * fields are normalised rather than trusted. Keeping them in one file means the
 * two screens cannot drift apart in what they accept.
 *
 * Permission is `content:write` — not `products:write`. A support account can
 * add a press mention without being able to reprice a work.
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/app/admin/actions";
import { query } from "@/lib/db";
import { slugify } from "@/lib/slug";

type Kind = "rooms" | "newsroom";

const COLUMNS: Record<Kind, string[]> = {
  rooms: [
    "slug", "title", "kicker", "subtitle", "body", "image", "collection",
    "published", "position", "title_hi", "subtitle_hi", "body_hi",
  ],
  newsroom: [
    "slug", "title", "kind", "outlet", "url", "summary", "body", "image",
    "published", "position", "published_at", "title_hi", "summary_hi", "body_hi",
  ],
};

const TABLE: Record<Kind, string> = { rooms: "site_room", newsroom: "site_news" };

function isKind(value: string): value is Kind {
  return value === "rooms" || value === "newsroom";
}

/** Only what was sent, so a PATCH cannot blank a column it never mentioned. */
function pick(kind: Kind, body: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const column of COLUMNS[kind]) {
    if (!(column in body)) continue;
    const value = body[column];
    if (column === "published") out[column] = value === true || value === "true";
    else if (column === "position") out[column] = Number(value) || 0;
    else out[column] = typeof value === "string" ? value.trim() : value ?? "";
  }
  if (typeof out.slug === "string") out.slug = slugify(out.slug);
  return out;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ kind: string }> }
) {
  const { kind } = await params;
  if (!isKind(kind)) return NextResponse.json({ error: "Unknown content kind" }, { status: 404 });
  if (!(await requirePermission("content:read"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rows = await query<{ [key: string]: unknown }>(
    `SELECT * FROM ${TABLE[kind]} ORDER BY position, published_at DESC NULLS LAST, id DESC`
  );
  return NextResponse.json({ items: rows });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ kind: string }> }
) {
  const { kind } = await params;
  if (!isKind(kind)) return NextResponse.json({ error: "Unknown content kind" }, { status: 404 });
  if (!(await requirePermission("content:write"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const row = pick(kind, body);

  if (!row.title) return NextResponse.json({ error: "A title is required." }, { status: 400 });
  // The address is derived when the form leaves it blank — the slug is a URL, not
  // a thing a person should have to invent.
  if (!row.slug) row.slug = slugify(String(row.title));
  if (!row.slug) {
    return NextResponse.json(
      { error: "That title makes no usable web address — type a slug." },
      { status: 400 }
    );
  }

  const existing = await query(`SELECT id FROM ${TABLE[kind]} WHERE slug = $1`, [row.slug]);
  if (existing.length > 0) {
    return NextResponse.json(
      { error: `The address “${row.slug}” is already in use.` },
      { status: 409 }
    );
  }

  const columns = Object.keys(row);
  const placeholders = columns.map((_, index) => `$${index + 1}`).join(", ");
  const [created] = await query(
    `INSERT INTO ${TABLE[kind]} (${columns.join(", ")}) VALUES (${placeholders}) RETURNING *`,
    Object.values(row)
  );
  return NextResponse.json({ item: created }, { status: 201 });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ kind: string }> }
) {
  const { kind } = await params;
  if (!isKind(kind)) return NextResponse.json({ error: "Unknown content kind" }, { status: 404 });
  if (!(await requirePermission("content:write"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const id = Number(body.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "Missing id." }, { status: 400 });

  const row = pick(kind, body);
  delete row.id;
  const columns = Object.keys(row);
  if (columns.length === 0) return NextResponse.json({ item: null });

  const sets = columns.map((column, index) => `${column} = $${index + 2}`).join(", ");
  const [updated] = await query(
    `UPDATE ${TABLE[kind]} SET ${sets}, updated_at = now() WHERE id = $1 RETURNING *`,
    [id, ...Object.values(row)]
  );
  if (!updated) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ item: updated });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ kind: string }> }
) {
  const { kind } = await params;
  if (!isKind(kind)) return NextResponse.json({ error: "Unknown content kind" }, { status: 404 });
  if (!(await requirePermission("content:write"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isFinite(id)) return NextResponse.json({ error: "Missing id." }, { status: 400 });
  await query(`DELETE FROM ${TABLE[kind]} WHERE id = $1`, [id]);
  return NextResponse.json({ ok: true });
}
