/**
 * Admin Settings API - reads/writes platform mode to .env and database.
 */

import { NextResponse } from "next/server";
import { requireAdmin } from "@/app/admin/actions";
import fs from "fs";
import path from "path";

const ENV_PATH = path.resolve(process.cwd(), ".env");

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
    return NextResponse.json({
      mode,
      settings: [
        {
          key: "platform_mode",
          value: mode,
          description:
            "Single-brand storefront or multi-vendor platform mode.",
        },
      ],
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { mode } = await req.json();
    const validMode = mode === "platform" ? "platform" : "single-brand";

    // Keep the in-memory value in sync for this process even when the
    // container has no writable .env file.
    process.env.PLATFORM_MODE = validMode;

    // Persist to .env
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
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
