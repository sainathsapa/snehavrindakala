import { NextResponse } from "next/server";
import { getAuthToken } from "@/lib/auth";
import { medusa } from "@/lib/medusa";
import { getAdminOrder } from "@/lib/admin";
import { verifyOrderToken, issueOrderToken } from "@/lib/order-token";
import { invoiceFactsFromOrder } from "@/lib/invoice";
import { buildInvoicePdf, invoiceFileName } from "@/lib/invoice-pdf";
import { getOrderShipment } from "@/lib/shipping/store";

/**
 * GET /api/orders/[id]/invoice
 *
 * The invoice as a PDF, for the buyer who wants it again — the copy in the
 * confirmation email is not the only one they should be able to reach.
 *
 * Two ways in, mirroring the order page: a signed-in customer session, or the
 * same signed, expiring token a guest was given at checkout (`?t=`). The admin
 * read path is used only behind one of those two proofs, never as a fallback —
 * otherwise an id guess would leak a full order.
 */
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const token = new URL(req.url).searchParams.get("t") || undefined;

  const session = await getAuthToken().catch(() => null);
  const guestOk = verifyOrderToken(token, id);

  if (!session && !guestOk) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let order: any = null;
  try {
    order = session
      ? await medusa.getOrder(id).then((result: any) => result?.order ?? result)
      : (await getAdminOrder(id)).order;
  } catch (err) {
    console.error("[invoice] could not load the order", err);
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  try {
    // The shipment row carries nothing the invoice needs today, but reading it
    // keeps the failure surface honest: a DB hiccup here must not produce a
    // document that claims to be complete.
    await getOrderShipment(id).catch(() => null);

    const facts = invoiceFactsFromOrder(order);
    const pdf = buildInvoicePdf(facts);

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${invoiceFileName(facts.invoiceNumber)}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        // A guest's download link must not be forwardable to someone else.
        ...(guestOk && !session
          ? { "X-Invoice-Token": issueOrderToken(id) }
          : {}),
      },
    });
  } catch (err) {
    console.error("[invoice] could not build the PDF", err);
    return NextResponse.json({ error: "Could not build the invoice" }, { status: 500 });
  }
}
