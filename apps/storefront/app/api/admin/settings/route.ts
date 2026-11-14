/**
 * Admin Settings API - platform mode plus editable site settings.
 */

import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAdmin } from "@/app/admin/actions";
import fs from "fs";
import path from "path";

const ENV_PATH = path.resolve(process.cwd(), ".env");



const DEFAULT_SETTINGS = [
  { key: "store_name", value: "SnehaVrinda Kala", description: "Store display name." },
  { key: "default_currency", value: "inr", description: "Default storefront currency code." },
  { key: "tax_rate", value: "18", description: "Default tax rate in percent." },
  { key: "tax_included", value: "false", description: "Whether product prices include tax." },
  // These two are informational only: i18n/routing.ts is the source of truth for
  // which languages exist. There used to be an admin screen that wrote them and
  // offered Telugu, Tamil and Kannada, but nothing read the value and no
  // messages file existed for any of those, so the site advertised languages it
  // would 404 on. Adding a language is a code change, not a setting.
  { key: "default_locale", value: "en", description: "Default storefront locale (see i18n/routing.ts)." },
  { key: "supported_locales", value: "en,hi", description: "Locales the storefront ships (see i18n/routing.ts)." },
];

async function ensureTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS site_settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      description TEXT,
      updated_at TIMESTAMP NOT NULL DEFAULT now()
    )
  `);
  for (const setting of DEFAULT_SETTINGS) {
    await query(
      `INSERT INTO site_settings (key, value, description)
       VALUES ($1, $2, $3)
       ON CONFLICT (key) DO NOTHING`,
      [setting.key, setting.value, setting.description]
    );
  }
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const raw =
      process.env.PLATFORM_MODE ||
      process.env.NEXT_PUBLIC_PLATFORM_MODE ||
      "single-brand";
    const mode = raw === "platform" ? "platform" : "single-brand";

    await ensureTable();
    const rows = await query(
      "SELECT key, value, description FROM site_settings ORDER BY key ASC"
    );

    return NextResponse.json({ mode, settings: rows });
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

    // Platform mode keeps its .env-backed behavior.
    if (body.mode !== undefined) {
      const validMode = body.mode === "platform" ? "platform" : "single-brand";

      process.env.PLATFORM_MODE = validMode;

      if (fs.existsSync(ENV_PATH)) {
        let envContent = fs.readFileSync(ENV_PATH, "utf8");
        const line = `PLATFORM_MODE=${validMode}`;
        const regex = /^PLATFORM_MODE=.*$/m;
        if (regex.test(envContent)) {
          envContent = envContent.replace(regex, line);
        } else {
          envContent += `\n${line}\n`;
        }
        fs.writeFileSync(ENV_PATH, envContent);
      }

      return NextResponse.json({ ok: true, mode: validMode });
    }

    const updates: { key: string; value: string }[] = Array.isArray(body.settings)
      ? body.settings
      : body.key
        ? [{ key: body.key, value: body.value }]
        : [];

    if (updates.length === 0) {
      return NextResponse.json(
        { error: "Provide mode, settings[], or key/value" },
        { status: 400 }
      );
    }

    await ensureTable();
    for (const update of updates) {
      if (!update || typeof update.key !== "string" || !update.key) {
        return NextResponse.json(
          { error: "Each setting requires a non-empty key" },
          { status: 400 }
        );
      }
      await query(
        `INSERT INTO site_settings (key, value)
         VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE
           SET value = EXCLUDED.value, updated_at = now()`,
        [update.key, update.value == null ? "" : String(update.value)]
      );
    }

    const rows = await query(
      "SELECT key, value, description FROM site_settings ORDER BY key ASC"
    );
    return NextResponse.json({ ok: true, settings: rows });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
