import { NextResponse } from "next/server";
import { requireAdmin } from "@/app/admin/actions";
import { setPlatformMode } from "@/lib/settings";

export async function POST(req: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { mode } = await req.json();
  const validMode = mode === "platform" ? "platform" : "single-brand";
  await setPlatformMode(validMode);
  return NextResponse.json({ ok: true });
}
