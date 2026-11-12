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
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(heading)}</title>
</head>
<body style="margin:0;padding:0;background:#FFF7E8;font-family:Helvetica,Arial,sans-serif;color:#2B211E;">
  <div style="display:none;font-size:1px;color:#FFF7E8;max-height:0;overflow:hidden;">${escapeHtml(
    preheader
  )}</div>
  <div style="max-width:600px;margin:0 auto;padding:32px 20px;">
    <div style="text-align:center;padding-bottom:24px;">
      <span style="font-family:Georgia,serif;font-size:22px;font-weight:bold;color:#2B211E;">SnehaVrinda</span>
      <span style="font-family:Georgia,serif;font-size:22px;font-weight:bold;color:#C84636;">Kala</span>
    </div>
    <div style="background:#FFFCF5;border:1px solid #DCCBB4;border-radius:12px;padding:32px;">
      <h1 style="margin:0 0 16px;font-family:Georgia,serif;font-size:24px;font-weight:600;color:#2B211E;">${escapeHtml(
        heading
      )}</h1>
      ${bodyHtml}
    </div>
    <div style="text-align:center;padding-top:24px;font-size:12px;color:#675A52;">
      <p style="margin:0 0 6px;">Questions? Write to <a href="mailto:${escapeHtml(
        ctx.contactEmail
      )}" style="color:#C84636;">${escapeHtml(ctx.contactEmail)}</a></p>
      <p style="margin:0;"><a href="${escapeHtml(
        ctx.storefrontUrl
      )}" style="color:#C84636;">snehavrinda.in</a></p>
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
      `<p style="margin:0;font-size:16px;font-weight:600;color:#2B211E;text-align:right;">Total ${formatMoney(
        order.total ?? data.amount,
        currency
      )}</p>` +
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

  const html = layout(
    ctx,
    "Your order has shipped",
    paragraph(
      `Good news — your piece is on its way${
        courier ? ` with ${escapeHtml(String(courier))}` : ""
      }.`
    ) +
      (tracking
        ? `<div style="margin:20px 0;padding:16px;background:#FFF7E8;border:1px solid #DCCBB4;border-radius:8px;">
            <p style="margin:0 0 4px;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:#C84636;">Tracking number</p>
            <p style="margin:0;font-family:monospace;font-size:16px;color:#2B211E;">${escapeHtml(
              String(tracking)
            )}</p>
          </div>` +
          button(
            ctx,
            `https://shiprocket.co/tracking/${encodeURIComponent(
              String(tracking)
            )}`,
            "Track your parcel"
          )
        : muted(
            "Tracking details will follow shortly if they are not shown here."
          )),
    `Your order has shipped${tracking ? ` — tracking ${tracking}` : ""}.`
  );

  return {
    subject: `Your SnehaVrinda Kala order has shipped`,
    html,
    text: `Your order has shipped${courier ? ` with ${courier}` : ""}.${
      tracking ? `\n\nTracking number: ${tracking}\nhttps://shiprocket.co/tracking/${tracking}` : ""
    }\n\nQuestions? ${ctx.contactEmail}`,
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
 * Registry
 * ------------------------------------------------------------------ */

type Renderer = (
  ctx: TemplateContext,
  data: Record<string, any>
) => RenderedEmail;

const RENDERERS: Record<string, Renderer> = {
  order_confirmation: orderConfirmation,
  order_placed: orderConfirmation,
  refund_processed: refundProcessed,
  shipment_confirmed: shipmentConfirmed,
  new_commission_request: newCommissionRequest,
  commission_request_received: commissionReceived,
  commission_quote_sent: quoteSent,
  commission_status_changed: commissionStatusChanged,
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
