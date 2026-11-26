/**
 * Transactional email templates.
 *
 * Plain functions returning {subject, html, text}. They are deliberately
 * dependency-free so they can be unit-tested and so a failed render can never
 * take down the notification path — the service falls back to a plain-text
 * body rather than throwing.
 *
 * Brand palette matches packages/config-tailwind: rang-paper #FFF7E8,
 * sindoor #C84636, deep-ink #2B211E, muted-ink #675A52, sand-border #DCCBB4.
 */

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export interface TemplateContext {
  storefrontUrl: string;
  contactEmail: string;
  currency?: string;
  /** Seller identity for the legal footer. Comes from SELLER_* in .env. */
  sellerName?: string;
  sellerAddress?: string;
  sellerState?: string;
  sellerPhone?: string;
  sellerWebsite?: string;
  sellerEmail?: string;
}

/* ------------------------------------------------------------------ *
 * Formatting helpers
 * ------------------------------------------------------------------ */

export function formatMoney(
  amountInMinorUnits: unknown,
  currency = "INR"
): string {
  const value = Number(amountInMinorUnits);
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: 0,
  }).format(value / 100);
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* ------------------------------------------------------------------ *
 * Layout
 * ------------------------------------------------------------------ */

function layout(
  ctx: TemplateContext,
  heading: string,
  bodyHtml: string,
  preheader = ""
): string {
  // Table-based, inline CSS only: this has to survive Gmail, Outlook and the
  // phone clients that strip <style> blocks. No web fonts, no external images —
  // a blocked image must never leave a hole in the design.
  const seller = [ctx.sellerName, ctx.sellerAddress, ctx.sellerState]
    .filter(Boolean)
    .map((part) => escapeHtml(part))
    .join(" · ");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light only" />
<title>${escapeHtml(heading)}</title>
</head>
<body style="margin:0;padding:0;background:#FFF7E8;font-family:Helvetica,Arial,sans-serif;color:#2B211E;">
  <div style="display:none;font-size:1px;color:#FFF7E8;max-height:0;overflow:hidden;">${escapeHtml(
    preheader
  )}</div>
  <div style="max-width:600px;margin:0 auto;padding:28px 18px 40px;">

    <!-- masthead -->
    <div style="text-align:center;padding-bottom:18px;">
      <div style="display:inline-block;border:1px solid #DCCBB4;border-radius:999px;padding:6px 14px;font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:#675A52;">
        Bikaner · Rajasthan
      </div>
      <div style="padding-top:14px;">
        <span style="font-family:Georgia,'Times New Roman',serif;font-size:26px;letter-spacing:0.02em;color:#2B211E;">SnehaVrinda</span>
        <span style="font-family:Georgia,'Times New Roman',serif;font-size:26px;color:#C84636;"> Kala</span>
      </div>
      <div style="padding-top:10px;">
        <div style="height:2px;width:56px;margin:0 auto;background:#C9A227;"></div>
      </div>
    </div>

    <!-- card -->
    <div style="background:#FFFCF5;border:1px solid #DCCBB4;border-radius:14px;padding:30px 28px;">
      <h1 style="margin:0 0 6px;font-family:Georgia,'Times New Roman',serif;font-size:23px;line-height:1.3;font-weight:600;color:#2B211E;">${escapeHtml(
        heading
      )}</h1>
      <div style="height:1px;width:100%;background:#E8DCC8;margin:0 0 18px;"></div>
      ${bodyHtml}
    </div>

    <!-- footer -->
    <div style="text-align:center;padding-top:24px;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.7;color:#675A52;">
      ${seller ? `<p style="margin:0 0 6px;font-size:12.5px;color:#2B211E;letter-spacing:0.01em;">${seller}</p>` : ""}
      <p style="margin:0 0 6px;">
        ${
          ctx.sellerPhone
            ? `<a href="tel:${escapeHtml(
                String(ctx.sellerPhone).replace(/[^+\d]/g, "")
              )}" style="color:#675A52;text-decoration:none;">${escapeHtml(
                ctx.sellerPhone
              )}</a>`
            : ""
        }${ctx.sellerPhone ? " &nbsp;·&nbsp; " : ""}<a href="mailto:${escapeHtml(
          ctx.sellerEmail || ctx.contactEmail
        )}" style="color:#675A52;text-decoration:none;">${escapeHtml(
          ctx.sellerEmail || ctx.contactEmail
        )}</a>
      </p>
      <p style="margin:0 0 10px;">
        <a href="${escapeHtml(
          ctx.storefrontUrl
        )}" style="color:#C84636;text-decoration:none;font-weight:600;">${
          ctx.sellerWebsite || "snehavrinda.in"
        }</a>
      </p>
      <div style="height:1px;width:44px;margin:0 auto 10px;background:#DCCBB4;"></div>
      <p style="margin:0;font-size:11px;color:#8A7B70;">
        Hand-made in Bikaner, Rajasthan · This is a transactional message about
        your order or account.
      </p>
    </div>
  </div>
</body>
</html>`;
}

function button(ctx: TemplateContext, href: string, label: string): string {
  return `<p style="margin:24px 0 0;">
    <a href="${escapeHtml(href)}" style="display:inline-block;background:#C84636;color:#FFF7E8;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600;">${escapeHtml(
      label
    )}</a>
  </p>`;
}

function paragraph(text: string): string {
  return `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#2B211E;">${text}</p>`;
}

function muted(text: string): string {
  return `<p style="margin:0 0 14px;font-size:13px;line-height:1.5;color:#675A52;">${text}</p>`;
}

/** A framed facts block: tracking number, order reference, expiry notice. */
function factsBlock(label: string, value: string): string {
  return `<div style="margin:20px 0;padding:16px;background:#FFF7E8;border:1px solid #DCCBB4;border-left:3px solid #C9A227;border-radius:8px;">
    <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#C84636;">${escapeHtml(
      label
    )}</p>
    <p style="margin:0;font-family:'Courier New',monospace;font-size:16px;color:#2B211E;word-break:break-all;">${escapeHtml(
      value
    )}</p>
  </div>`;
}

/**
 * Money lines under the item table.
 *
 * Shipping is free on every order, but it is free because an automatic
 * promotion discounts the courier rate — not because the rate is zero. Printing
 * the rate followed by the discount shows the customer what they were given;
 * printing only the total would hide it.
 */
function totalsBlock(
  order: Record<string, any>,
  currency: string,
  fallbackTotal?: unknown
): string {
  const line = (label: string, amount: number, free = false) =>
    `<tr>
      <td style="padding:4px 0;font-size:14px;color:${free ? "#2F6B3A" : "#675A52"};">${escapeHtml(
        label
      )}</td>
      <td style="padding:4px 0;font-size:14px;text-align:right;white-space:nowrap;color:${
        free ? "#2F6B3A" : "#2B211E"
      };">${escapeHtml(formatMoney(amount, currency))}</td>
    </tr>`;

  const rows: string[] = [];
  const itemTotal = Number(order.item_subtotal ?? order.subtotal ?? 0);
  const shipping = Number(order.shipping_subtotal ?? 0);
  const discount = Number(order.discount_total ?? 0);

  if (itemTotal) rows.push(line("Subtotal", itemTotal));
  if (shipping > 0) {
    rows.push(line("Shipping", shipping));
    rows.push(line("Free shipping (applied automatically)", -shipping, true));
  } else if (discount > 0) {
    rows.push(line("Discount", -discount, true));
  }

  return `<table style="width:100%;border-collapse:collapse;margin:14px 0 0;">${rows.join(
    ""
  )}
    <tr>
      <td style="padding:10px 0 0;border-top:1px solid #DCCBB4;font-size:16px;font-weight:600;color:#2B211E;">Total paid</td>
      <td style="padding:10px 0 0;border-top:1px solid #DCCBB4;font-size:16px;font-weight:600;text-align:right;white-space:nowrap;color:#2B211E;">${escapeHtml(
        formatMoney(order.total ?? fallbackTotal, currency)
      )}</td>
    </tr>
  </table>`;
}

/* ------------------------------------------------------------------ *
 * Order confirmation
 * ------------------------------------------------------------------ */

interface OrderLine {
  title?: string;
  quantity?: number;
  total?: number;
  unit_price?: number;
  variant_title?: string;
}

interface OrderLike {
  id?: string;
  display_id?: number | string;
  email?: string;
  currency_code?: string;
  total?: number;
  subtotal?: number;
  shipping_total?: number;
  items?: OrderLine[];
  shipping_address?: {
    first_name?: string;
    last_name?: string;
    address_1?: string;
    city?: string;
    province?: string;
    postal_code?: string;
  } | null;
}

function orderConfirmation(
  ctx: TemplateContext,
  data: Record<string, any>
): RenderedEmail {
  const order: OrderLike = data.order || {};
  const currency = order.currency_code || ctx.currency || "INR";
  const reference =
    order.display_id ?? (order.id ? String(order.id).slice(-6) : "your order");
  const items = Array.isArray(order.items) ? order.items : [];

  const rows = items
    .map((item) => {
      const lineTotal =
        item.total ?? (item.unit_price ?? 0) * (item.quantity ?? 0);
      return `<tr>
        <td style="padding:10px 0;border-bottom:1px solid #DCCBB4;font-size:14px;color:#2B211E;">
          ${escapeHtml(item.title || "Item")}${
        item.variant_title
          ? `<br /><span style="font-size:12px;color:#675A52;">${escapeHtml(
              item.variant_title
            )}</span>`
          : ""
      }
        </td>
        <td style="padding:10px 0;border-bottom:1px solid #DCCBB4;font-size:14px;color:#675A52;text-align:center;">×${
          item.quantity ?? 1
        }</td>
        <td style="padding:10px 0;border-bottom:1px solid #DCCBB4;font-size:14px;color:#2B211E;text-align:right;white-space:nowrap;">${formatMoney(
          lineTotal,
          currency
        )}</td>
      </tr>`;
    })
    .join("");

  const address = order.shipping_address;
  const addressLine = address
    ? [address.first_name, address.last_name].filter(Boolean).join(" ")
    : "";

  const html = layout(
    ctx,
    `Thank you — order #${escapeHtml(reference)} is confirmed`,
    paragraph(
      `We have received your payment and your order is being prepared.`
    ) +
      `<table style="width:100%;border-collapse:collapse;margin:16px 0;">${rows}</table>` +
      totalsBlock(order as Record<string, any>, currency, data.amount) +
      (addressLine
        ? `<div style="margin-top:24px;padding-top:16px;border-top:1px solid #DCCBB4;">
            <p style="margin:0 0 4px;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:#C84636;">Delivering to</p>
            <p style="margin:0;font-size:14px;line-height:1.5;color:#2B211E;">
              ${escapeHtml(addressLine)}<br />
              ${escapeHtml(address?.address_1 || "")}<br />
              ${escapeHtml(address?.city || "")} ${escapeHtml(
            address?.province || ""
          )} ${escapeHtml(address?.postal_code || "")}
            </p>
          </div>`
        : "") +
      paragraph(
        `<span style="font-size:14px;color:#675A52;">We will email you again as soon as this ships, with tracking.</span>`
      ) +
      button(ctx, `${ctx.storefrontUrl}/account`, "View your orders"),
    `Your SnehaVrinda Kala order #${reference} is confirmed.`
  );

  const text = [
    `Order #${reference} is confirmed`,
    "",
    ...items.map(
      (item) =>
        `${item.quantity ?? 1} × ${item.title || "Item"} — ${formatMoney(
          item.total ?? (item.unit_price ?? 0) * (item.quantity ?? 0),
          currency
        )}`
    ),
    "",
    `Total: ${formatMoney(order.total ?? data.amount, currency)}`,
    addressLine ? `Delivering to: ${addressLine}, ${address?.address_1 || ""}` : "",
    "",
    `View your orders: ${ctx.storefrontUrl}/account`,
    `Questions? ${ctx.contactEmail}`,
  ]
    .filter((line) => line !== "")
    .join("\n");

  return {
    subject: `Order #${reference} confirmed — SnehaVrinda Kala`,
    html,
    text,
  };
}

/* ------------------------------------------------------------------ *
 * Refund
 * ------------------------------------------------------------------ */

function refundProcessed(
  ctx: TemplateContext,
  data: Record<string, any>
): RenderedEmail {
  const currency = data.currency_code || ctx.currency || "INR";
  const amount = formatMoney(data.amount, currency);

  const html = layout(
    ctx,
    "Your refund is on its way",
    paragraph(
      `We have processed a refund of <strong>${escapeHtml(amount)}</strong>${
        data.order_id ? ` for order ${escapeHtml(String(data.order_id))}` : ""
      }.`
    ) +
      (data.reason ? muted(`Reason: ${escapeHtml(String(data.reason))}`) : "") +
      muted(
        "Refunds usually reach your account in 5–7 working days, depending on your bank."
      ) +
      paragraph(
        `<span style="font-size:14px;color:#675A52;">If this does not arrive, reply to this email and we will chase it.</span>`
      ),
    `A refund of ${amount} has been processed.`
  );

  return {
    subject: `Refund processed${data.order_id ? ` for order ${data.order_id}` : ""}`,
    html,
    text: `A refund of ${amount} has been processed.${
      data.reason ? `\nReason: ${data.reason}` : ""
    }\n\nRefunds usually reach your account in 5–7 working days.\n\nQuestions? ${ctx.contactEmail}`,
  };
}

/* ------------------------------------------------------------------ *
 * Shipment
 * ------------------------------------------------------------------ */

function shipmentConfirmed(
  ctx: TemplateContext,
  data: Record<string, any>
): RenderedEmail {
  const tracking = data.tracking_number || data.awb_code;
  const courier = data.courier_name;
  const eta = data.etd || data.expected_delivery;
  const trackingUrl = tracking
    ? String(data.tracking_url ||
        `https://shiprocket.co/tracking/${encodeURIComponent(String(tracking))}`)
    : null;
  const orderRef = data.display_id ?? data.order_id;

  const html = layout(
    ctx,
    "Your order is on its way",
    paragraph(
      `Good news — your piece has left the studio${
        courier ? ` with ${escapeHtml(String(courier))}` : ""
      }.`
    ) +
      (orderRef ? muted(`Order reference: #${escapeHtml(String(orderRef))}`) : "") +
      (tracking
        ? factsBlock("Tracking number", String(tracking)) +
          (courier ? muted(`Courier: ${escapeHtml(String(courier))}`) : "") +
          (eta ? muted(`Expected delivery: ${escapeHtml(String(eta))}`) : "") +
          (trackingUrl ? button(ctx, trackingUrl, "Track your parcel") : "")
        : muted(
            "The courier has not issued a tracking number yet. We will follow up as soon as it does."
          )),
    `Your order has shipped${tracking ? ` — tracking ${tracking}` : ""}.`
  );

  const text = [
    `Your SnehaVrinda Kala order has shipped${courier ? ` with ${courier}` : ""}.`,
    orderRef ? `Order reference: #${orderRef}` : "",
    tracking ? `Tracking number: ${tracking}` : "Tracking number: not issued yet",
    eta ? `Expected delivery: ${eta}` : "",
    trackingUrl ? `Track: ${trackingUrl}` : "",
    "",
    `Questions? ${ctx.contactEmail}`,
  ]
    .filter((line) => line !== "")
    .join("\n");

  return {
    subject: orderRef
      ? `Order #${orderRef} has shipped — SnehaVrinda Kala`
      : "Your SnehaVrinda Kala order has shipped",
    html,
    text,
  };
}

/* ------------------------------------------------------------------ *
 * Commission
 * ------------------------------------------------------------------ */

function newCommissionRequest(
  ctx: TemplateContext,
  data: Record<string, any>
): RenderedEmail {
  const ref = data.reference_id || data.commission_request_id || "";

  return {
    subject: `New commission request${ref ? ` — ${ref}` : ""}`,
    html: layout(
      ctx,
      "New commission request",
      paragraph(
        `A new commission request has arrived${data.art_form ? ` for <strong>${escapeHtml(String(data.art_form))}</strong>` : ""}.`
      ) +
        (data.brief
          ? `<blockquote style="margin:16px 0;padding:12px 16px;border-left:3px solid #C84636;background:#FFF7E8;font-size:14px;line-height:1.6;color:#2B211E;">${escapeHtml(
              String(data.brief)
            )}</blockquote>`
          : "") +
        (ref
          ? button(
              ctx,
              `${ctx.storefrontUrl}/admin/commissions`,
              "Review in the admin"
            )
          : "") +
        muted(
          [
            ref ? `Reference: ${escapeHtml(String(ref))}` : "",
            data.customer_id ? `Customer: ${escapeHtml(String(data.customer_id))}` : "",
            data.budget_range ? `Budget: ${escapeHtml(String(data.budget_range))}` : "",
            data.target_date ? `Needed by: ${escapeHtml(String(data.target_date))}` : "",
          ]
            .filter(Boolean)
            .join("<br />")
        ),
      "A new commission request needs review."
    ),
    text: `New commission request${ref ? ` — ${ref}` : ""}\n\n${
      data.brief ? `Brief: ${data.brief}\n\n` : ""
    }Review: ${ctx.storefrontUrl}/admin/commissions`,
  };
}

function commissionReceived(
  ctx: TemplateContext,
  data: Record<string, any>
): RenderedEmail {
  const ref = data.reference_id || data.commission_request_id || "";

  return {
    subject: `We have your commission request${ref ? ` — ${ref}` : ""}`,
    html: layout(
      ctx,
      "Your commission request is with us",
      paragraph(
        `Thank you for asking us to make something. We are reviewing your brief now — feasibility, schedule and the right artist.`
      ) +
        paragraph(
          `<span style="font-size:14px;color:#675A52;">You will hear from us with a quote, usually within two working days. Nothing is owed until you accept it.</span>`
        ) +
        (ref
          ? `<div style="margin:20px 0;padding:16px;background:#FFF7E8;border:1px solid #DCCBB4;border-radius:8px;">
              <p style="margin:0 0 4px;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:#C84636;">Your reference</p>
              <p style="margin:0;font-family:monospace;font-size:15px;color:#2B211E;">${escapeHtml(
                String(ref)
              )}</p>
            </div>` +
            button(
              ctx,
              `${ctx.storefrontUrl}/commission-status/${encodeURIComponent(
                String(ref)
              )}`,
              "Follow your commission"
            )
          : "") +
        muted(
          "Keep this reference — it is how you and our team both track the piece."
        ),
      "Your commission request is being reviewed."
    ),
    text: `Your commission request is with us.${
      ref ? `\n\nReference: ${ref}\n${ctx.storefrontUrl}/commission-status/${ref}` : ""
    }\n\nWe will send a quote, usually within two working days. Nothing is owed until you accept it.\n\nQuestions? ${ctx.contactEmail}`,
  };
}

function quoteSent(
  ctx: TemplateContext,
  data: Record<string, any>
): RenderedEmail {
  const ref = data.reference_id || data.commission_request_id || "";
  const currency = data.currency_code || ctx.currency || "INR";
  const amount = data.amount ?? data.total;

  return {
    subject: `Your commission quote${ref ? ` — ${ref}` : ""}`,
    html: layout(
      ctx,
      "Your quote is ready",
      paragraph(`We have scoped your commission and can now share the quote.`) +
        (amount != null
          ? paragraph(
              `<span style="font-size:20px;font-weight:600;">${escapeHtml(
                formatMoney(amount, currency)
              )}</span>`
            )
          : "") +
        (data.summary
          ? muted(escapeHtml(String(data.summary)))
          : "") +
        (data.expires_at
          ? muted(
              `This quote is valid until ${escapeHtml(
                new Date(data.expires_at).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })
              )}.`
            )
          : "") +
        (ref
          ? button(
              ctx,
              `${ctx.storefrontUrl}/commission-status/${encodeURIComponent(
                String(ref)
              )}`,
              "Review and accept"
            )
          : "") +
        muted("Nothing is owed until you accept the quote."),
      "Your commission quote is ready to review."
    ),
    text: `Your commission quote is ready${
      amount != null ? `: ${formatMoney(amount, currency)}` : ""
    }.${
      ref ? `\n\nReview it: ${ctx.storefrontUrl}/commission-status/${ref}` : ""
    }\n\nNothing is owed until you accept.`,
  };
}

function commissionStatusChanged(
  ctx: TemplateContext,
  data: Record<string, any>
): RenderedEmail {
  const ref = data.reference_id || data.commission_request_id || "";
  const status = data.to_status || data.status || "updated";

  return {
    subject: `Commission update: ${status}${ref ? ` — ${ref}` : ""}`,
    html: layout(
      ctx,
      `Your commission is now: ${status}`,
      paragraph(`There is an update on your commission.`) +
        (ref
          ? button(
              ctx,
              `${ctx.storefrontUrl}/commission-status/${encodeURIComponent(
                String(ref)
              )}`,
              "See the progress"
            )
          : ""),
      `Commission update: ${status}`
    ),
    text: `Your commission is now: ${status}.${
      ref ? `\n\n${ctx.storefrontUrl}/commission-status/${ref}` : ""
    }`,
  };
}

/* ------------------------------------------------------------------ *
 * Cart reminder
 * ------------------------------------------------------------------ */

/**
 * One reminder for an unfinished checkout.
 *
 * Deliberately quiet. On a shop where each work is unique, the honest thing to
 * say is "the piece you chose is still here", not "come back and buy". The
 * email promises it is the only one, so the shop has to keep that promise —
 * `cart_reminders` allows exactly one send per cart.
 */
function cartReminder(
  ctx: TemplateContext,
  data: Record<string, any>
): RenderedEmail {
  const currency = data.currency_code || data.currency || ctx.currency || "INR";
  const items: Array<{ title?: string; quantity?: number; total?: number }> =
    Array.isArray(data.items) ? data.items : [];

  const lines = items
    .map((item) =>
      paragraph(
        `${escapeHtml(item.title || "A work")}${
          Number(item.quantity) > 1 ? ` × ${Number(item.quantity)}` : ""
        }${item.total != null ? ` — ${escapeHtml(formatMoney(item.total, currency))}` : ""}`
      )
    )
    .join("");

  const html = layout(
    ctx,
    "Your work is still here",
    paragraph(
      "You began a checkout and did not finish it. Nothing is reserved and nothing has been charged."
    ) +
      lines +
      (data.subtotal != null
        ? muted(`Cart total: ${escapeHtml(formatMoney(data.subtotal, currency))}`)
        : "") +
      button(ctx, `${ctx.storefrontUrl}/checkout`, "Return to your cart") +
      muted(
        "A one-of-one work can be claimed by someone else in the meantime, so do write to us if you would like it held while you decide."
      ) +
      muted("This is the only reminder we will send about this cart."),
    "The piece you chose is still available. Nothing has been charged."
  );

  return {
    subject: "Your work is still here",
    html,
    text: [
      "You began a checkout and did not finish it. Nothing is reserved and nothing has been charged.",
      ...items.map(
        (item) =>
          `- ${item.title || "A work"}${
            Number(item.quantity) > 1 ? ` × ${Number(item.quantity)}` : ""
          }${item.total != null ? ` (${formatMoney(item.total, currency)})` : ""}`
      ),
      `\nReturn to your cart: ${ctx.storefrontUrl}/checkout`,
      "\nThis is the only reminder we will send about this cart.",
      `\nQuestions? ${ctx.contactEmail}`,
    ].join("\n"),
  };
}

/* ------------------------------------------------------------------ *
 * Registry
 * ------------------------------------------------------------------ */

type Renderer = (
  ctx: TemplateContext,
  data: Record<string, any>
) => RenderedEmail;

/* ------------------------------------------------------------------ *
 * Order cancelled
 * ------------------------------------------------------------------ */

function orderCancelled(
  ctx: TemplateContext,
  data: Record<string, any>
): RenderedEmail {
  const order: OrderLike = data.order || data;
  const currency = order.currency_code || ctx.currency || "INR";
  const reference =
    order.display_id ?? (order.id ? String(order.id).slice(-6) : "your order");
  const refunded = data.refund_amount ?? order.total;
  const reason = data.reason ? String(data.reason) : null;

  const body =
    paragraph(
      `Order #${escapeHtml(
        String(reference)
      )} has been cancelled and will not be shipped.`
    ) +
    (reason ? muted(`Reason given: ${escapeHtml(reason)}`) : "") +
    factsBlock(
      "Amount to be returned",
      formatMoney(refunded, currency)
    ) +
    muted(
      "Refunds are returned to the original payment method. Banks usually take 5–7 working days to show it; if it has not appeared after that, reply to this email and we will chase it."
    ) +
    button(ctx, `${ctx.storefrontUrl}/account`, "View your orders");

  return {
    subject: `Order #${reference} cancelled — SnehaVrinda Kala`,
    html: layout(
      ctx,
      "Your order was cancelled",
      body,
      `Order #${reference} is cancelled; ${formatMoney(
        refunded,
        currency
      )} is on its way back.`
    ),
    text: [
      `Order #${reference} has been cancelled.`,
      reason ? `Reason: ${reason}` : "",
      `Amount to be returned: ${formatMoney(refunded, currency)}`,
      "Refunds reach the original payment method in 5–7 working days.",
      "",
      `${ctx.storefrontUrl}/account`,
      `Questions? ${ctx.contactEmail}`,
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

/* ------------------------------------------------------------------ *
 * Account lifecycle
 * ------------------------------------------------------------------ */

function welcome(ctx: TemplateContext, data: Record<string, any>): RenderedEmail {
  const name = String(data.first_name || "").trim();
  const greeting = name ? `Welcome, ${escapeHtml(name)}` : "Welcome to SnehaVrinda Kala";

  return {
    subject: "Welcome to SnehaVrinda Kala",
    html: layout(
      ctx,
      greeting,
      paragraph(
        "Your account is ready. Every piece in the shop is made by hand in our Bikaner studio — the account keeps your orders, addresses and tracking in one place."
      ) +
        paragraph(
          "A few things worth knowing: each artwork carries a signed certificate of authenticity, pieces ship insured, and you can write to us any time about a commission made to your measurements."
        ) +
        button(ctx, `${ctx.storefrontUrl}/shop`, "Browse the collection") +
        muted(
          `If you did not create this account, reply to this email or write to ${escapeHtml(
            ctx.contactEmail
          )} and we will remove it.`
        ),
      greeting
    ),
    text: [
      greeting,
      "",
      "Your account is ready. Orders, addresses and tracking all live in one place.",
      `Browse the collection: ${ctx.storefrontUrl}/shop`,
      `If you did not create this account, write to ${ctx.contactEmail}.`,
    ].join("\n"),
  };
}

function passwordReset(
  ctx: TemplateContext,
  data: Record<string, any>
): RenderedEmail {
  const token = String(data.token || "");
  const email = String(data.email || "");
  const ttlMinutes = Number(data.expires_in_minutes || 60);
  const link = `${ctx.storefrontUrl}/account/reset-password?token=${encodeURIComponent(
    token
  )}&email=${encodeURIComponent(email)}`;

  return {
    subject: "Reset your SnehaVrinda Kala password",
    html: layout(
      ctx,
      "Set a new password",
      paragraph(
        "Someone asked to reset the password for this account. If that was you, use the button below."
      ) +
        button(ctx, link, "Choose a new password") +
        muted(
          `The link works once and expires in ${ttlMinutes} minutes. If the button does not open, paste this address into your browser:`
        ) +
        `<p style="margin:0 0 16px;font-size:12px;word-break:break-all;color:#675A52;">${escapeHtml(
          link
        )}</p>` +
        muted(
          "If you did not ask for this, you can ignore this email — your password has not changed."
        ),
      "Reset link inside, valid for one hour."
    ),
    text: [
      "Reset your SnehaVrinda Kala password",
      "",
      `Open this link to choose a new password (valid ${ttlMinutes} minutes, single use):`,
      link,
      "",
      "If you did not ask for this, ignore this email — your password has not changed.",
    ].join("\n"),
  };
}

function passwordChanged(
  ctx: TemplateContext,
  data: Record<string, any>
): RenderedEmail {
  const when = String(data.changed_at || new Date().toISOString());

  return {
    subject: "Your SnehaVrinda Kala password was changed",
    html: layout(
      ctx,
      "Your password was changed",
      paragraph(
        "The password on your SnehaVrinda Kala account has just been changed, and every other signed-in device has been asked to sign in again."
      ) +
        muted(`Changed at: ${escapeHtml(when)}`) +
        muted(
          `If this was not you, write to ${escapeHtml(
            ctx.contactEmail
          )} immediately so we can lock the account.`
        ) +
        button(ctx, `${ctx.storefrontUrl}/account/login`, "Sign in"),
      "Your password was changed."
    ),
    text: [
      "Your SnehaVrinda Kala password was changed.",
      `Changed at: ${when}`,
      `If this was not you, write to ${ctx.contactEmail} immediately.`,
      `${ctx.storefrontUrl}/account/login`,
    ].join("\n"),
  };
}

function loginAlert(
  ctx: TemplateContext,
  data: Record<string, any>
): RenderedEmail {
  const when = String(data.signed_in_at || new Date().toISOString());
  const device = data.device ? String(data.device) : null;

  return {
    subject: "New sign-in to your SnehaVrinda Kala account",
    html: layout(
      ctx,
      "New sign-in",
      paragraph(
        "Your account was signed in to. If this was you, there is nothing to do."
      ) +
        muted(`When: ${escapeHtml(when)}`) +
        (device ? muted(`Device: ${escapeHtml(device)}`) : "") +
        muted(
          `If this was not you, change your password now and write to ${escapeHtml(
            ctx.contactEmail
          )}.`
        ) +
        button(ctx, `${ctx.storefrontUrl}/account`, "Review your account"),
      "New sign-in to your account."
    ),
    text: [
      "New sign-in to your SnehaVrinda Kala account.",
      `When: ${when}`,
      device ? `Device: ${device}` : "",
      `If this was not you, change your password and write to ${ctx.contactEmail}.`,
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

/**
 * Sent to a guest whose account we created because they ordered.
 *
 * Deliberately not a password-reset email: they never asked to reset anything,
 * and an unrequested "reset your password" message from a shop is
 * indistinguishable from phishing. This one says what happened, why, and what to
 * do next — with the same single-use token link.
 */
function accountCreated(
  ctx: TemplateContext,
  data: Record<string, any>
): RenderedEmail {
  const token = String(data.token || "");
  const email = String(data.email || "");
  const tempPassword = String(data.temp_password || "");
  const ttlMinutes = Number(data.expires_in_minutes || 60);
  const orderRef = data.order_reference
    ? String(data.order_reference)
    : null;
  const order = data.order || {};
  const currency = order.currency_code || ctx.currency || "INR";
  const items: any[] = Array.isArray(order.items) ? order.items : [];
  const link = token
    ? `${ctx.storefrontUrl}/account/reset-password?token=${encodeURIComponent(
        token
      )}&email=${encodeURIComponent(email)}`
    : `${ctx.storefrontUrl}/account/forgot-password`;

  const itemRows = items
    .map(
      (item) => `<tr>
        <td style="padding:8px 0;border-bottom:1px solid #DCCBB4;font-size:14px;color:#2B211E;">
          ${escapeHtml(item.title || "Item")}${
            item.variant_title
              ? `<br /><span style="font-size:12px;color:#675A52;">${escapeHtml(
                  item.variant_title
                )}</span>`
              : ""
          }
        </td>
        <td style="padding:8px 0;border-bottom:1px solid #DCCBB4;font-size:14px;color:#675A52;text-align:center;">×${Number(
          item.quantity || 1
        )}</td>
        <td style="padding:8px 0;border-bottom:1px solid #DCCBB4;font-size:14px;color:#2B211E;text-align:right;white-space:nowrap;">${formatMoney(
          item.total ?? 0,
          currency
        )}</td>
      </tr>`
    )
    .join("");

  const address = order.shipping_address;
  const addressName = address
    ? [address.first_name, address.last_name].filter(Boolean).join(" ")
    : "";

  const orderBlock = orderRef
    ? `<div style="margin:22px 0 8px;padding-top:16px;border-top:1px solid #E8DCC8;">
         <p style="margin:0 0 8px;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#C84636;">Order #${escapeHtml(
           orderRef
         )}</p>` +
      (itemRows
        ? `<table style="width:100%;border-collapse:collapse;">${itemRows}</table>`
        : "") +
      `<p style="margin:12px 0 0;font-size:15px;font-weight:600;color:#2B211E;text-align:right;">Total ${formatMoney(
        order.total ?? 0,
        currency
      )}</p>` +
      (addressName
        ? `<p style="margin:14px 0 0;font-size:12px;line-height:1.6;color:#675A52;">Shipping to ${escapeHtml(
            addressName
          )}, ${escapeHtml(address?.address_1 || "")}, ${escapeHtml(
            address?.city || ""
          )} ${escapeHtml(address?.postal_code || "")}</p>`
        : "") +
      `<p style="margin:10px 0 0;font-size:12px;color:#675A52;">The invoice is attached to this email as a PDF.</p>
       </div>`
    : "";

  const credentials = tempPassword
    ? factsBlock("Temporary password", tempPassword) +
      muted(
        "Sign in with your email address and this password, then change it from Account → Password. It is a one-time convenience, not a secret we keep."
      )
    : "";

  return {
    subject: orderRef
      ? `Your account and order #${orderRef} — SnehaVrinda Kala`
      : "Your SnehaVrinda Kala account is ready",
    html: layout(
      ctx,
      "Your account is ready",
      paragraph(
        `We created an account for you when you placed${
          orderRef ? ` order #${escapeHtml(orderRef)}` : " your order"
        }, so you can follow it and keep your details for next time.`
      ) +
        orderBlock +
        paragraph(
          "Prefer to choose your own password? Use the button below — it is the safer of the two options."
        ) +
        credentials +
        button(ctx, link, token ? "Set my own password" : "Set my password") +
        muted(
          `The link works once and expires in ${ttlMinutes} minutes. If the button does not open, paste this address into your browser:`
        ) +
        `<p style="margin:0 0 16px;font-size:12px;word-break:break-all;color:#675A52;">${escapeHtml(
          link
        )}</p>` +
        muted(
          `Not expecting this? The order is already confirmed and nothing else changes — write to ${escapeHtml(
            ctx.contactEmail
          )} and we will remove the account.`
        ),
      orderRef
        ? `Order #${orderRef} confirmed — invoice attached, account ready.`
        : "Your account is ready."
    ),
    text: [
      orderRef ? `Order #${orderRef} is confirmed.` : "Your account is ready.",
      "We created it when you placed your order; the invoice is attached.",
      "",
      ...items.map(
        (item) =>
          `${item.quantity || 1} x ${item.title || "Item"} — ${formatMoney(
            item.total ?? 0,
            currency
          )}`
      ),
      `Total: ${formatMoney(order.total ?? 0, currency)}`,
      "",
      tempPassword ? `Temporary password: ${tempPassword}` : "",
      tempPassword ? "Change it after signing in, or set your own with the link below." : "",
      `Set your password (single use, ${ttlMinutes} minutes):`,
      link,
      "",
      `Questions? ${ctx.contactEmail}`,
    ]
      .filter((line) => line !== "")
      .join("\n"),
  };
}

/* ------------------------------------------------------------------ *
 * Contact form
 * ------------------------------------------------------------------ */

/** The studio's copy: everything a reply needs, in reading order. */
function contactEnquiry(
  ctx: TemplateContext,
  data: Record<string, any>
): RenderedEmail {
  const name = escapeHtml(String(data.name || "Someone"));
  const email = escapeHtml(String(data.email || ""));
  const phone = data.phone ? escapeHtml(String(data.phone)) : "";
  const subject = data.subject ? escapeHtml(String(data.subject)) : "No subject given";
  const message = escapeHtml(String(data.message || "")).replace(/\n/g, "<br>");
  const orderRef = data.order_ref ? escapeHtml(String(data.order_ref)) : "";

  const html = layout(
    ctx,
    "A message from the website",
    paragraph(`<strong>${name}</strong> wrote to the studio.`) +
      factsBlock("Name", name) +
      factsBlock("Email", email) +
      (phone ? factsBlock("Phone", phone) : "") +
      (orderRef ? factsBlock("Order reference", orderRef) : "") +
      factsBlock("Subject", subject) +
      `<div style="margin:14px 0 0;padding:16px;border:1px solid #DCCBB4;background:#FFFBF4;">${message}</div>` +
      button(ctx, `${ctx.storefrontUrl}/contact`, "Open the studio contact page"),
    `Contact form: ${name} — ${subject}`
  );

  // A phone preview shows only the subject line, so the sender leads it.
  return {
    subject: `Contact form: ${String(data.subject || "website message")} — ${String(
      data.name || ""
    )}`.trim(),
    html,
    text: [
      `From: ${data.name || ""} <${data.email || ""}>`,
      data.phone ? `Phone: ${data.phone}` : "",
      data.order_ref ? `Order: ${data.order_ref}` : "",
      `Subject: ${data.subject || "(none)"}`,
      "",
      String(data.message || ""),
    ]
      .filter((line) => line !== "")
      .join("\n"),
  };
}

/** The visitor's copy: confirms receipt without repeating the whole letter. */
function contactReceived(
  ctx: TemplateContext,
  data: Record<string, any>
): RenderedEmail {
  const name = escapeHtml(String(data.name || ""));
  const subject = data.subject ? escapeHtml(String(data.subject)) : "";
  const message = escapeHtml(String(data.message || "")).replace(/\n/g, "<br>");

  const html = layout(
    ctx,
    "Your message reached the studio",
    paragraph(
      `Thank you${name ? `, ${name}` : ""}. Your message is with us and will be read by a person, not a queue.`
    ) +
      (subject ? factsBlock("Subject", subject) : "") +
      `<div style="margin:14px 0 0;padding:16px;border-left:3px solid #8F201D;background:#FFF7EC;">${message}</div>` +
      muted(
        "We answer by email, usually within two working days. If you wrote about a work already on its way to you, reply to this message and quote your order number."
      ),
    `We have your message${subject ? `: ${subject}` : ""}.`
  );

  return {
    subject: "Your message reached SnehaVrinda Kala",
    html,
    text: [
      `Thank you${data.name ? `, ${data.name}` : ""}.`,
      "",
      "Your message reached the studio and will be read by a person.",
      data.subject ? `Subject: ${data.subject}` : "",
      "",
      "—",
      String(data.message || ""),
      "",
      "We reply by email, usually within two working days.",
    ]
      .filter((line) => line !== "")
      .join("\n"),
  };
}

const RENDERERS: Record<string, Renderer> = {
  order_confirmation: orderConfirmation,
  order_placed: orderConfirmation,
  refund_processed: refundProcessed,
  shipment_confirmed: shipmentConfirmed,
  order_cancelled: orderCancelled,
  welcome: welcome,
  account_created: accountCreated,
  password_reset: passwordReset,
  password_changed: passwordChanged,
  login_alert: loginAlert,
  new_commission_request: newCommissionRequest,
  commission_request_received: commissionReceived,
  commission_quote_sent: quoteSent,
  commission_status_changed: commissionStatusChanged,
  cart_reminder: cartReminder,
  contact_enquiry: contactEnquiry,
  contact_received: contactReceived,
};

export function hasTemplate(template: string): boolean {
  return Object.prototype.hasOwnProperty.call(RENDERERS, template);
}

/**
 * Render an email. Unknown templates get a readable fallback rather than
 * throwing, so a missing template never silently drops a customer notification.
 */
export function renderTemplate(
  template: string,
  ctx: TemplateContext,
  data: Record<string, any> = {}
): RenderedEmail {
  const renderer = RENDERERS[template];
  if (renderer) {
    try {
      return renderer(ctx, data);
    } catch (err) {
      console.error(`Failed to render template "${template}"`, err);
    }
  }

  const body = paragraph(`Update for you.`);
  return {
    subject: `SnehaVrinda Kala — ${template.replace(/_/g, " ")}`,
    html: layout(ctx, template.replace(/_/g, " "), body),
    text: `SnehaVrinda Kala — ${template.replace(/_/g, " ")}\n\nQuestions? ${ctx.contactEmail}`,
  };
}
