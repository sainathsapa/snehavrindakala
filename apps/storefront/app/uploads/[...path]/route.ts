/**
 * GET /uploads/[...path] — serve admin-uploaded media.
 *
 * Uploads cannot live in `public/`. Next's standalone build snapshots `public/`
 * when it compiles, so a file written there after the container has started is
 * on disk but still answers 404 — which is exactly what happened here: the
 * upload endpoint returned a URL for a file nobody could load.
 *
 * Files are therefore written to a dedicated media directory and streamed from
 * it by this route. The directory is a mounted volume, so uploads survive a
 * redeploy instead of vanishing with the container's writable layer.
 */

import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { MEDIA_ROOT } from "@/lib/media";

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".avif": "image/avif",
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params;

  // Reject traversal before touching the filesystem. `...` segments and
  // anything containing a separator are refused outright rather than sanitised,
  // because a legitimate upload name never contains one.
  if (
    !segments?.length ||
    segments.some(
      (s) => !s || s === "." || s === ".." || s.includes("/") || s.includes("\\")
    )
  ) {
    return new NextResponse("Not found", { status: 404 });
  }

  const filePath = path.join(MEDIA_ROOT, ...segments);

  // Belt and braces: the resolved path must still sit inside MEDIA_ROOT.
  const root = path.resolve(MEDIA_ROOT);
  if (!path.resolve(filePath).startsWith(root + path.sep)) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const file = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    return new NextResponse(new Uint8Array(file), {
      status: 200,
      headers: {
        "Content-Type": CONTENT_TYPES[ext] || "application/octet-stream",
        // Uploaded filenames are content-unique (uuid), so they can be cached
        // hard. Changing an image means a new file, never a mutated one.
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
