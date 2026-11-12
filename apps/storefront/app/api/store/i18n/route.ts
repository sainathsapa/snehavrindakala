/**
 * GET /api/store/i18n - Get translations for a locale
 * POST /api/store/i18n - Create/update a translation
 */

import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAdmin } from "@/app/admin/actions";



export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const locale = searchParams.get("locale") || "en";

    await query(`
      CREATE TABLE IF NOT EXISTS translations (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        locale TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        UNIQUE(locale, key)
      )
    `);

    // Insert default English translations if empty
    const existing = await query(
      "SELECT COUNT(*) FROM translations WHERE locale = $1",
      [locale]
    );
    if (parseInt(existing[0].count) === 0 && locale === "en") {
      const defaultTranslations = [
        ["home", "Home"],
        ["shop", "Shop"],
        ["cart", "Cart"],
        ["checkout", "Checkout"],
        ["account", "Account"],
        ["about", "About"],
        ["journal", "Journal"],
        ["sell", "Sell"],
        ["admin", "Admin"],
        ["products", "Products"],
        ["categories", "Categories"],
        ["customers", "Customers"],
        ["orders", "Orders"],
        ["partners", "Partners"],
        ["settings", "Settings"],
        ["login", "Login"],
        ["logout", "Logout"],
        ["add_to_cart", "Add to Cart"],
        ["buy_now", "Buy Now"],
        ["price", "Price"],
        ["stock", "Stock"],
        ["description", "Description"],
        ["reviews", "Reviews"],
        ["submit", "Submit"],
        ["cancel", "Cancel"],
        ["save", "Save"],
        ["delete", "Delete"],
        ["edit", "Edit"],
        ["create", "Create"],
        ["search", "Search"],
        ["filter", "Filter"],
        ["sort", "Sort"],
        ["category", "Category"],
        ["artist", "Artist"],
        ["collection", "Collection"],
        ["order_history", "Order History"],
        ["total_spent", "Total Spent"],
        ["order_number", "Order Number"],
        ["order_date", "Order Date"],
        ["order_status", "Order Status"],
        ["payment_status", "Payment Status"],
        ["shipping_address", "Shipping Address"],
        ["billing_address", "Billing Address"],
        ["contact_us", "Contact Us"],
        ["faq", "FAQ"],
        ["terms", "Terms"],
        ["privacy", "Privacy"],
        ["returns", "Returns"],
        ["shipping", "Shipping"],
        ["commissions", "Commissions"],
        ["discounts", "Discounts"],
        ["analytics", "Analytics"],
        ["users", "Users"],
        ["roles", "Roles"],
        ["support_tickets", "Support Tickets"],
      ];
      for (const [key, value] of defaultTranslations) {
        await query(
          "INSERT INTO translations (locale, key, value) VALUES ($1, $2, $3) ON CONFLICT (locale, key) DO NOTHING",
          [locale, key, value]
        );
      }
    }

    const rows = await query("SELECT key, value FROM translations WHERE locale = $1", [
      locale,
    ]);
    const translations: Record<string, string> = {};
    rows.forEach((r: any) => {
      translations[r.key] = r.value;
    });
    return NextResponse.json({ locale, translations });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  await requireAdmin();
  try {
    const body = await req.json();
    const { locale, key, value } = body;

    if (!locale || !key || value === undefined) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    await query(`
      CREATE TABLE IF NOT EXISTS translations (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        locale TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        UNIQUE(locale, key)
      )
    `);

    await query(
      `INSERT INTO translations (locale, key, value) VALUES ($1, $2, $3)
       ON CONFLICT (locale, key) DO UPDATE SET value = $3`,
      [locale, key, value]
    );

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
