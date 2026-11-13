/**
 * POST /api/admin/upload - Upload an image (returns URL)
 *
 * Accepts multipart/form-data with a file field.
 * In production, this should upload to S3/CloudFront.
 * For now, it stores locally and returns a URL.
 */

import { NextResponse } from "next/server";
import { requireAdmin } from "@/app/admin/actions";
import { MEDIA_ROOT, MEDIA_URL_PREFIX } from "@/lib/media";
import fs from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";

// Media directory, not `public/` — see lib/media.ts. A file written into
// `public/` after the standalone build is on disk but still 404s.
const UPLOAD_DIR = path.join(MEDIA_ROOT, "products");

export async function POST(req: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Use JPEG, PNG, WebP, or GIF." },
        { status: 400 }
      );
    }

    // Validate size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File too large. Max 5MB." },
        { status: 400 }
      );
    }

    // Ensure upload directory exists
    await fs.mkdir(UPLOAD_DIR, { recursive: true });

    // Generate unique filename. The extension is taken from the validated MIME
    // type rather than from the client's filename, so an odd name cannot smuggle
    // an executable extension onto the server.
    const extByType: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/gif": "gif",
    };
    const filename = `${uuidv4()}.${extByType[file.type]}`;
    const filePath = path.join(UPLOAD_DIR, filename);

    // Save file
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(filePath, buffer);

    const url = `${MEDIA_URL_PREFIX}/products/${filename}`;
    return NextResponse.json({ url, filename }, { status: 201 });
  } catch (err: any) {
    // Surface a cause an operator can act on: a read-only or unmounted media
    // volume is the likeliest failure and looks identical to a generic 500.
    return NextResponse.json(
      { error: `Upload failed: ${err?.message ?? "unknown error"}` },
      { status: 500 }
    );
  }
}
