import Link from "next/link";
import { getAuthToken } from "@/lib/auth";
import { medusa, formatPrice } from "@/lib/medusa";
import { gstConfigStatus, taxForAmount } from "@/lib/tax-server";
import { taxLabel } from "@/lib/tax";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Invoice | SnehaVrinda Kala",
};

export default async function InvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const token = await getAuthToken();
  let order: any = null;

  if (token) {
    try {
      order = await medusa.getOrder(id);
    } catch (error) {
      console.error("Failed to load order for invoice", error);
    }
  }

  if (!order) {
    return (
      <main className="py-10">
        <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-xl border border-sand-border bg-surface p-12 text-center">
            <p className="text-lg text-muted-ink font-sans mb-6">
              You need to be signed in to view this invoice.
            </p>
            <Link
              href="/account/login"
              className="inline-flex items-center gap-2 text-sm font-medium text-sindoor hover:underline"
            >
              Sign in →
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const items = order.items ?? [];
  const totalItems = items.reduce((sum: number, i: any) => sum + (i.quantity ?? 0), 0);

  // GST-02: a document is only a statutory tax invoice when the seller's legal
  // identity, GSTIN, address and HSN/SAC have actually been supplied and pass
  // validation. Never present a printed page as one when they are missing — and
  // never invent them. All fields are configuration supplied by the owner/CA.
  const gst = gstConfigStatus();
  const statutory = gst.ready;
  const placeOfSupply = order.billing_address?.province || order.shipping_address?.province || null;
  const taxBreakdown = statutory ? taxForAmount(order.total ?? 0, placeOfSupply) : null;

  const orderDate = new Date(order.created_at).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <main className="py-10">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        {/* Non-print controls */}
        <div className="mb-8 print:hidden">
          <Link
            href="/admin/orders"
            className="inline-flex items-center gap-2 text-sm font-medium text-sindoor hover:underline mb-4"
          >
            ← Back to Orders
          </Link>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-sindoor text-rang-paper rounded-md font-medium hover:bg-sindoor/90 focus:outline-none focus:ring-2 focus:ring-sindoor transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2zm0 0v2a2 2 0 002 2h16a2 2 0 002-2v-2m0 0v-2a2 2 0 00-2-2H7a2 2 0 00-2 2v2m0 0v2a2 2 0 002 2h16a2 2 0 002-2v-2m0-6H5a2 2 0 01-2-2V5a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2m0 0v2a2 2 0 012 2h16a2 2 0 012-2v-2z"
              />
            </svg>
            Print Invoice
          </button>
        </div>

        {/* No disclaimer banner.
            The document used to open with a warning that it could not serve as a
            tax invoice, and call itself an ORDER STATEMENT, whenever the seller
            had not supplied a GSTIN. That is a legal state, not an error, and
            printing it on every invoice reads as a defect to the customer.
            Registration details are now simply present or absent: supply
            SELLER_GSTIN (or the admin settings field) and the same document
            becomes a TAX INVOICE with the number shown. Missing tax
            configuration is still reported to the owner, in the config
            checklist rather than on the buyer's copy. */}

        {/* Invoice document */}
        <div className="print:invoice max-w-none">
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xl font-serif font-bold text-deep-ink tracking-tight">
                  SnehaVrinda
                </span>
                <span className="text-xl font-serif font-bold text-terracotta tracking-tight">
                  Kala
                </span>
                <div className="mt-2 text-xs font-sans text-deep-ink">
                  <p className="font-semibold">{process.env.SELLER_LEGAL_NAME}</p>
                  <p className="whitespace-pre-line">{process.env.SELLER_ADDRESS}</p>
                  <p>
                    {[process.env.SELLER_PHONE, process.env.SELLER_EMAIL, process.env.SELLER_WEBSITE]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {process.env.SELLER_GSTIN ? (
                    <p>GSTIN: {process.env.SELLER_GSTIN}</p>
                  ) : null}
                </div>
              </div>
              <div className="text-right">
                <h1 className="text-2xl font-serif font-bold text-deep-ink mb-1">
                  {statutory ? "TAX INVOICE" : "INVOICE"}
                </h1>
                <p className="text-sm text-muted-ink font-sans">
                  Invoice #{order.display_id ?? order.id.slice(-6)}
                </p>
              </div>
            </div>
            <p className="mt-2 text-sm text-muted-ink font-sans">
              {orderDate}
            </p>
          </div>

          {/* Customer & order info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div>
              <h3 className="text-sm font-sans font-semibold text-muted-ink uppercase tracking-wider mb-3">
                Bill To
              </h3>
              <p className="text-sm font-sans text-deep-ink">
                {`${order.billing_address?.first_name || ""} ${order.billing_address?.last_name || ""}`.trim() ||
                  "Customer"}
              </p>
              <p className="text-sm font-sans text-muted-ink">
                {order.billing_address?.email || order.customerEmail || "—"}
              </p>
              <p className="text-sm font-sans text-muted-ink">
                {order.billing_address?.address_1 || "—"}
                {order.billing_address?.address_2 ? (
                  <span className="block">
                    {order.billing_address.address_2}
                  </span>
                ) : null}
              </p>
              <p className="text-sm font-sans text-muted-ink">
                {`${order.billing_address?.city || ""}, ${order.billing_address?.province || ""}`.trim() ||
                  "—"}
              </p>
              <p className="text-sm font-sans text-muted-ink">
                {`${order.billing_address?.postal_code || ""} ${order.billing_address?.country_code || "IN"}`.trim() ||
                  "—"}
              </p>
            </div>
            <div className="text-right">
              <h3 className="text-sm font-sans font-semibold text-muted-ink uppercase tracking-wider mb-3">
                Order Details
              </h3>
              <p className="text-sm font-sans text-deep-ink">
                Order #{order.display_id ?? order.id.slice(-6)}
              </p>
              <p className="text-sm font-sans text-muted-ink">
                {orderDate}
              </p>
              <p className="text-sm font-sans text-muted-ink">
                Status:{""}
                <span className="font-medium text-deep-ink">
                  {order.status?.replace(/_/g, " ") || "—"}
                </span>
              </p>
              <p className="text-sm font-sans text-muted-ink">
                Payment:{""}
                <span className="font-medium text-deep-ink">
                  {order.payment_status?.replace(/_/g, " ") || "—"}
                </span>
              </p>
            </div>
          </div>

          {/* Items table */}
          <div className="overflow-hidden">
            <table className="w-full text-left border-collapse mb-8">
              <thead>
                <tr className="border-b border-sand-border">
                  <th className="py-3 px-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                    Item
                  </th>
                  {statutory && (
                    <th className="py-3 px-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                      HSN/SAC
                    </th>
                  )}
                  <th className="py-3 px-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider text-right">
                    Unit Price
                  </th>
                  <th className="py-3 px-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider text-center">
                    Qty
                  </th>
                  <th className="py-3 px-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider text-right">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand-border">
                {items.map((item: any) => (
                  <tr key={item.id} className="last:border-b-0">
                    <td className="py-4 px-4 text-sm font-sans text-deep-ink">
                      {item.product_title || item.title || "Product"}
                      {item.variant_title && (
                        <span className="block text-xs text-muted-ink">
                          {item.variant_title}
                        </span>
                      )}
                    </td>
                    {statutory && (
                      <td className="py-4 px-4 text-sm font-sans text-deep-ink">
                        {process.env.HSN_SAC_DEFAULT}
                      </td>
                    )}
                    <td className="py-4 px-4 text-sm font-sans text-deep-ink text-right">
                      {(item.unit_price / 100).toFixed(2)}
                      {" "}
                      {order.currencyCode?.toUpperCase() || "INR"}
                    </td>
                    <td className="py-4 px-4 text-sm font-sans text-deep-ink text-center">
                      {item.quantity}
                    </td>
                    <td className="py-4 px-4 text-sm font-sans text-deep-ink text-right">
                      {((item.total ?? item.unit_price * item.quantity) / 100).toFixed(2)}
                      {" "}
                      {order.currencyCode?.toUpperCase() || "INR"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-sand-border">
                <tr>
                  <td className="py-4 px-4 text-sm font-sans text-muted-ink text-right" colSpan={statutory ? 4 : 3}>
                    Subtotal
                  </td>
                  <td className="py-4 px-4 text-sm font-sans text-deep-ink text-right">
                    {((order.subtotal ?? 0) / 100).toFixed(2)}
                    {" "}
                    {order.currency_code?.toUpperCase() || "INR"}
                  </td>
                </tr>
                {order.discountTotal && order.discountTotal > 0 && (
                  <tr>
                    <td className="py-4 px-4 text-sm font-sans text-muted-ink text-right" colSpan={statutory ? 4 : 3}>
                      Discount
                    </td>
                    <td className="py-4 px-4 text-sm font-sans text-red-600 text-right">
                      -{(order.discountTotal / 100).toFixed(2)}
                      {" "}
                      {order.currency_code?.toUpperCase() || "INR"}
                    </td>
                  </tr>
                )}
                {order.shippingTotal && order.shippingTotal > 0 && (
                  <tr>
                    <td className="py-4 px-4 text-sm font-sans text-muted-ink text-right" colSpan={statutory ? 4 : 3}>
                      Shipping
                    </td>
                    <td className="py-4 px-4 text-sm font-sans text-deep-ink text-right">
                      {(order.shippingTotal / 100).toFixed(2)}
                      {" "}
                      {order.currency_code?.toUpperCase() || "INR"}
                    </td>
                  </tr>
                )}
                {taxBreakdown ? (
                  <>
                    <tr>
                      <td className="py-2 px-4 text-xs font-sans text-muted-ink text-right" colSpan={statutory ? 4 : 3}>
                        Taxable value ({taxLabel(taxBreakdown)})
                      </td>
                      <td className="py-2 px-4 text-xs font-sans text-deep-ink text-right">
                        {(taxBreakdown.taxable_amount / 100).toFixed(2)}
                      </td>
                    </tr>
                    {taxBreakdown.igst > 0 ? (
                      <tr>
                        <td className="py-2 px-4 text-xs font-sans text-muted-ink text-right" colSpan={statutory ? 4 : 3}>
                          IGST
                        </td>
                        <td className="py-2 px-4 text-xs font-sans text-deep-ink text-right">
                          {(taxBreakdown.igst / 100).toFixed(2)}
                        </td>
                      </tr>
                    ) : (
                      <>
                        <tr>
                          <td className="py-2 px-4 text-xs font-sans text-muted-ink text-right" colSpan={statutory ? 4 : 3}>
                            CGST
                          </td>
                          <td className="py-2 px-4 text-xs font-sans text-deep-ink text-right">
                            {(taxBreakdown.cgst / 100).toFixed(2)}
                          </td>
                        </tr>
                        <tr>
                          <td className="py-2 px-4 text-xs font-sans text-muted-ink text-right" colSpan={statutory ? 4 : 3}>
                            SGST
                          </td>
                          <td className="py-2 px-4 text-xs font-sans text-deep-ink text-right">
                            {(taxBreakdown.sgst / 100).toFixed(2)}
                          </td>
                        </tr>
                      </>
                    )}
                    <tr>
                      <td className="py-2 px-4 text-xs font-sans text-muted-ink text-right" colSpan={statutory ? 4 : 3}>
                        Place of supply
                      </td>
                      <td className="py-2 px-4 text-xs font-sans text-deep-ink text-right">
                        {placeOfSupply || "—"}
                      </td>
                    </tr>
                  </>
                ) : order.taxTotal && order.taxTotal > 0 ? (
                  <tr>
                    <td className="py-4 px-4 text-sm font-sans text-muted-ink text-right" colSpan={statutory ? 4 : 3}>
                      Tax (indicative only — not a GST breakdown)
                    </td>
                    <td className="py-4 px-4 text-sm font-sans text-deep-ink text-right">
                      {(order.taxTotal / 100).toFixed(2)}
                      {" "}
                      {order.currency_code?.toUpperCase() || "INR"}
                    </td>
                  </tr>
                ) : null}
                <tr className="border-t border-deep-ink font-serif font-bold text-deep-ink">
                  <td className="py-4 px-4 text-right" colSpan={statutory ? 4 : 3}>
                    Total
                  </td>
                  <td className="py-4 px-4 text-right">
                    {((order.total ?? 0) / 100).toFixed(2)}
                    {" "}
                    {order.currency_code?.toUpperCase() || "INR"}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="mt-8 print:hidden">
            <p className="text-xs text-muted-ink font-sans">
              Thank you for your purchase from SnehaVrinda Kala.
            </p>
          </div>
        </div>
      </div>

      <style>
        {`
          @media print {
            body {
              background: white !important;
              -webkit-print-color-adjust: exact !important;
              color-adjust: exact !important;
            }
            .print:invoice {
              max-width: none;
              width: 100%;
            }
            .print:hidden {
              display: none !important;
            }
            .invoice {
              box-shadow: none !important;
              border: none !important;
            }
          }
        `}
      </style>
    </main>
  );
}
