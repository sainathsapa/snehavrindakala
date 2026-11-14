import { NextResponse } from "next/server";
import { CURRENCIES, CURRENCY_COOKIE } from "@/lib/currency";
import { revalidatePath } from "next/cache";

/**
 * POST /api/currency — remember which currency the visitor is shopping in.
 *
 * Prices are computed per Medusa region, so the cookie only records a preference
 * that the server reads during render. Nothing here touches money; it chooses
 * which price set is displayed.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const code = String(body.currency || "").toLowerCase();

  if (!CURRENCIES.some((c) => c.code === code)) {
    return NextResponse.json({ error: "Unsupported currency" }, { status: 400 });
  }

  const res = NextResponse.json({ currency: code });
  res.cookies.set(CURRENCY_COOKIE, code, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  // Catalogue pages are cached per currency; drop them so the new price set is
  // served immediately rather than up to a minute later.
  revalidatePath("/", "layout");
  return res;
}
