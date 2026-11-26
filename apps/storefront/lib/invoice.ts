/**
 * Turn a Medusa order into invoice facts.
 *
 * One place decides what an invoice says, so the emailed PDF, the admin preview
 * and any future re-issue cannot disagree. Prices in the store are tax-inclusive
 * (see lib/tax-server), so the totals printed here are what the customer paid —
 * there is no second GST column to invent while the seller is unregistered.
 */

import { taxForAmount } from "@/lib/tax-server";
import type { InvoiceFacts, InvoiceLine } from "@/lib/invoice-pdf";

function majorUnits(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n / 100 : 0;
}

function addressLines(address: any): string[] {
  if (!address) return [];
  return [
    [address.address_1, address.address_2].filter(Boolean).join(", "),
    [address.city, address.province, address.postal_code].filter(Boolean).join(", "),
    address.country_code && address.country_code !== "in"
      ? String(address.country_code).toUpperCase()
      : "",
  ].filter(Boolean);
}

export interface OrderLikeForInvoice {
  id?: string;
  display_id?: string | number | null;
  created_at?: string | null;
  email?: string | null;
  currency_code?: string | null;
  subtotal?: number | null;
  shipping_total?: number | null;
  discount_total?: number | null;
  total?: number | null;
  items?: {
    title?: string | null;
    product_title?: string | null;
    variant_title?: string | null;
    quantity?: number | null;
    unit_price?: number | null;
    total?: number | null;
  }[];
  shipping_address?: any;
  billing_address?: any;
  payments?: { data?: { id?: string }[] } | { id?: string }[] | null;
  payment_collections?: { payments?: { id?: string }[] }[] | null;
}

function nameOf(address: any): string {
  if (!address) return "";
  return [address.first_name, address.last_name].filter(Boolean).join(" ");
}

function paymentReference(order: OrderLikeForInvoice): string | null {
  const fromCollections = (order.payment_collections || [])
    .flatMap((collection) => collection?.payments || [])
    .map((payment) => payment?.id)
    .filter(Boolean);
  if (fromCollections.length) return String(fromCollections[0]);

  const payments = (order as any)?.payments;
  const list = Array.isArray(payments) ? payments : payments?.data || [];
  const id = list.map((payment: any) => payment?.id).filter(Boolean)[0];
  return id ? String(id) : null;
}

export function invoiceNumberFor(order: OrderLikeForInvoice): string {
  const reference = order.display_id ?? order.id ?? "0";
  const year = order.created_at ? new Date(order.created_at).getFullYear() : new Date().getFullYear();
  return `SVK-${year}-${String(reference).slice(-6)}`;
}

export function invoiceFactsFromOrder(
  order: OrderLikeForInvoice,
  opts: { sellerGstin?: string | null } = {}
): InvoiceFacts {
  const currency = String(order.currency_code || "inr").toUpperCase();
  const symbol = currency === "INR" ? "Rs." : currency;

  const lines: InvoiceLine[] = (order.items || []).map((item) => ({
    title: String(item.product_title || item.title || "Item"),
    variant: item.variant_title || null,
    quantity: Number(item.quantity || 1),
    amount: majorUnits(item.total ?? (item.unit_price ?? 0) * (item.quantity ?? 1)),
  }));

  const subtotal = majorUnits(order.subtotal);
  const shipping = majorUnits(order.shipping_total);
  const discount = majorUnits(order.discount_total);
  const total = majorUnits(order.total);
  const shippingAddress = order.shipping_address;

  const tax = taxForAmount(Number(order.total ?? 0), shippingAddress?.province || undefined);
  const gstin = (opts.sellerGstin || process.env.SELLER_GSTIN || "").trim();

  return {
    invoiceNumber: invoiceNumberFor(order),
    issuedAt: (order.created_at ? new Date(order.created_at) : new Date()).toISOString(),
    orderReference: String(order.display_id ?? order.id ?? ""),
    seller: {
      name: process.env.SELLER_LEGAL_NAME || "SnehaVrinda Kala",
      addressLines: [
        process.env.SELLER_ADDRESS || "",
        [process.env.SELLER_HOME_STATE || ""].filter(Boolean).join(", "),
      ].filter(Boolean),
      state: process.env.SELLER_HOME_STATE || null,
      gstin: gstin || null,
    },
    buyer: {
      name: nameOf(shippingAddress) || String(order.email || "Customer"),
      email: order.email || null,
      phone: shippingAddress?.phone || null,
      addressLines: addressLines(shippingAddress),
    },
    lines,
    currencySymbol: symbol,
    subtotal: subtotal || total,
    shipping,
    discount,
    total,
    // While the seller is unregistered this says so plainly; nothing pretends to
    // be a tax invoice, which is what an unregistered seller must not issue.
    taxNote: gstin
      ? tax
        ? `Includes GST at ${tax.gst_rate}% (CGST ${tax.cgst / 100}, SGST ${tax.sgst / 100}, IGST ${tax.igst / 100}).`
        : null
      : "GSTIN not registered. This is an order statement, not a tax invoice.",
    paymentReference: paymentReference(order),
    notes: ["Thank you for supporting hand-made work from Bikaner."],
  };
}
