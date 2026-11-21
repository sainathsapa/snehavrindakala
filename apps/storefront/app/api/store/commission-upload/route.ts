/**
 * POST /api/store/commission-upload
 *
 * Accepts ONE reference file for a commission brief and stores it privately.
 *
 * Commission references are customer-private: a photo may show a family, a
 * home, or a document. They are therefore written under a private media
 * subdirectory and are never served by the public `/uploads` route. The
 * response returns an opaque storage key, not a URL — the buyer only needs to
 * know it was received, and staff read it through the admin-guarded route.
 *
 * Validation is server-side and authoritative: type is allow-listed by MIME and
 * the stored extension is chosen from that MIME (never from the client's
 * filename), and size is capped. Files larger than the cap are rejected rather
 * than silently truncated.
 */

import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { MEDIA_ROOT } from "@/lib/media";
import { validateCommissionFile } from "@/lib/commission-upload";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

const PRIVATE_SUBDIR = "commission-private";

export async function POST(req: Request) {
  // This writes a file to disk and needs no session, so the size cap alone is
  // not enough: one loop could fill the volume. Ten an hour still allows a
  // buyer to attach several references to one brief.
  const limit = await checkRateLimit({
    route: "commission-upload",
    ip: clientIp(req.headers),
    limit: 10,
    windowSeconds: 3600,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many uploads from this connection. Please try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file received." }, { status: 400 });
    }

    // Server-side rules are authoritative. These are shared with the client and
    // unit-tested in `tests/commission-upload.test.ts`.
    const check = validateCommissionFile(file.type, file.size);
    if (!check.ok || !check.ext) {
      return NextResponse.json({ error: check.error }, { status: 400 });
    }

    const dir = path.join(MEDIA_ROOT, PRIVATE_SUBDIR);
    await fs.mkdir(dir, { recursive: true });

    // Random key: no user-supplied text reaches the filesystem.
    const key = `${crypto.randomUUID()}.${check.ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(path.join(dir, key), buffer);

    return NextResponse.json({
      ok: true,
      key,
      mime_type: file.type,
      size_bytes: file.size,
      original_filename: file.name?.slice(0, 200) || null,
    });
  } catch (err) {
    console.error("commission-upload failed", err);
    return NextResponse.json(
      { error: "Upload failed. Please try again." },
      { status: 500 }
    );
  }
}
