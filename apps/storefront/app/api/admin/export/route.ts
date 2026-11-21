/**
 * GET /api/admin/export/orders - Export orders to CSV
 * GET /api/admin/export/products - Export products to CSV
 * GET /api/admin/export/customers - Export customers to CSV
 */

import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAdmin } from "@/app/admin/actions";



function rowsToCsv(rows: any[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (val: any) => {
    if (val === null || val === undefined) return "";
    const s = String(val);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const headerLine = headers.map(escape).join(",");
  const dataLines = rows.map((row) => headers.map((h) => escape(row[h])).join(","));
  return [headerLine, ...dataLines].join("\n");
}

export async function GET(req: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "orders";

    let rows: any[] = [];
    let filename = "export";

    if (type === "newsletter") {
      filename = "newsletter-subscribers";
      rows = await query(`
        SELECT email, locale, source, consent_at, created_at
        FROM newsletter_subscribers
        WHERE unsubscribed_at IS NULL
        ORDER BY created_at DESC
      `);
    } else if (type === "orders") {
      filename = "orders";
      rows = await query(`
        SELECT o.id, o.status, o.email AS customer_email, o.currency_code,
               COALESCE(SUM(li.unit_price * oi.quantity), 0) AS total,
               o.created_at, o.updated_at
        FROM "order" o
        LEFT JOIN order_item oi
          ON oi.order_id = o.id AND oi.version = o.version
        LEFT JOIN order_line_item li ON li.id = oi.item_id
        WHERE o.deleted_at IS NULL
        GROUP BY o.id, o.status, o.email, o.currency_code,
                 o.created_at, o.updated_at
        ORDER BY o.created_at DESC
        LIMIT 10000
      `);
    } else if (type === "products") {
      filename = "products";
      rows = await query(`
        SELECT id, title, handle, status, description, created_at, updated_at
        FROM product
        WHERE deleted_at IS NULL
        ORDER BY created_at DESC
        LIMIT 10000
      `);
    } else if (type === "customers") {
      filename = "customers";
      rows = await query(`
        SELECT id, email, first_name, last_name, phone, has_account,
               created_at, updated_at
        FROM customer
        WHERE deleted_at IS NULL
        ORDER BY created_at DESC
        LIMIT 10000
      `);
    }

    const csv = rowsToCsv(rows);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}.csv"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
