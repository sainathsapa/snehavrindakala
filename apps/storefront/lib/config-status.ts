/**
 * What this deployment can and cannot do right now.
 *
 * Every gap in `docs/DEPLOY.md` is invisible from inside the shop: payments look
 * wired because the checkout renders, email looks wired because orders complete,
 * and the only way to learn otherwise is to read a Markdown file or watch a log.
 * This turns those gaps into facts a shopkeeper can see.
 *
 * Rules:
 *   - report presence, never values — no secret is ever returned;
 *   - name what is missing, so the answer is actionable;
 *   - never claim "ready" for something that has not been exercised. A
 *     configured key means "configured", not "working".
 */

import { gstConfigStatus, hasAnyGstConfig } from "./tax-server";

export type ConfigLevel = "ready" | "partial" | "missing";

export interface ConfigItem {
  id: string;
  label: string;
  level: ConfigLevel;
  /** One sentence a shopkeeper can act on. */
  detail: string;
  /** What the shop does while this is missing. */
  impact?: string;
  /** Environment variables to set, for the operator. */
  keys?: string[];
}

type Env = Record<string, string | undefined>;

const has = (env: Env, key: string) => Boolean((env[key] ?? "").trim());

const env = (): Env => process.env as unknown as Env;

/** Payments: the storefront creates a Razorpay order directly. */
export function paymentStatus(source: Env = env()): ConfigItem {
  const keyId = has(source, "NEXT_PUBLIC_RAZORPAY_KEY_ID") || has(source, "RAZORPAY_KEY_ID");
  const keySecret = has(source, "RAZORPAY_KEY_SECRET");
  const webhook = has(source, "RAZORPAY_WEBHOOK_SECRET");

  if (!keyId || !keySecret) {
    return {
      id: "payments",
      label: "Payments",
      level: "missing",
      detail: "Razorpay keys are not set, so checkout cannot take money.",
      impact: "The checkout page tells the buyer to write to the studio instead.",
      keys: ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"],
    };
  }
  if (!webhook) {
    return {
      id: "payments",
      label: "Payments",
      level: "partial",
      detail:
        "Razorpay can take payments, but no webhook secret is set, so a payment captured elsewhere (or a refund from the Razorpay dashboard) is not verified automatically.",
      impact: "Orders rely on the buyer's browser returning to the confirmation page.",
      keys: ["RAZORPAY_WEBHOOK_SECRET"],
    };
  }
  return {
    id: "payments",
    label: "Payments",
    level: "ready",
    detail: "Razorpay keys and webhook secret are present.",
  };
}

/** Email: rendered by the backend, sent only when a transport exists. */
export function emailStatus(source: Env = env()): ConfigItem {
  const from = has(source, "FROM_EMAIL");
  const sesKey = has(source, "AWS_SES_ACCESS_KEY_ID") && has(source, "AWS_SES_SECRET_ACCESS_KEY");
  const sesRole = has(source, "AWS_SES_ROLE_ARN");

  if (!from && !sesKey && !sesRole) {
    return {
      id: "email",
      label: "Email",
      level: "missing",
      detail: "No sender address and no SES credentials, so nothing is sent.",
      impact:
        "Order confirmations, quote emails and cart reminders are rendered, logged as skipped, and never delivered.",
      keys: ["FROM_EMAIL", "AWS_SES_ACCESS_KEY_ID", "AWS_SES_SECRET_ACCESS_KEY"],
    };
  }
  if (!from || (!sesKey && !sesRole)) {
    return {
      id: "email",
      label: "Email",
      level: "partial",
      detail: "Some email configuration is present but incomplete.",
      impact: "Messages are still recorded as skipped until both halves are set.",
      keys: ["FROM_EMAIL", "AWS_SES_ACCESS_KEY_ID", "AWS_SES_SECRET_ACCESS_KEY"],
    };
  }
  return {
    id: "email",
    label: "Email",
    level: "ready",
    detail: "Sender address and SES credentials are present.",
  };
}

/** Fulfilment: Shiprocket quotes and creates shipments. */
export function fulfilmentStatus(source: Env = env()): ConfigItem {
  const email = has(source, "SHIPROCKET_EMAIL");
  const password = has(source, "SHIPROCKET_PASSWORD");
  const pickup = has(source, "SHIPROCKET_PICKUP_POSTCODE");

  if (!email || !password) {
    return {
      id: "fulfilment",
      label: "Shipping",
      level: "missing",
      detail: "Shiprocket credentials are not set, so no courier rates are quoted.",
      impact:
        "Checkout falls back to free shipping, and the studio is not told to arrange a courier.",
      keys: ["SHIPROCKET_EMAIL", "SHIPROCKET_PASSWORD"],
    };
  }
  if (!pickup) {
    return {
      id: "fulfilment",
      label: "Shipping",
      level: "partial",
      detail: "Shiprocket credentials are set, but no pickup postcode is.",
      impact: "Quotes fall back to the default postcode, which changes the price.",
      keys: ["SHIPROCKET_PICKUP_POSTCODE"],
    };
  }
  return {
    id: "fulfilment",
    label: "Shipping",
    level: "ready",
    detail: "Shiprocket credentials and pickup postcode are present.",
  };
}

/** Scheduled jobs: the cart reminder endpoint needs a secret to run at all. */
export function cronStatus(source: Env = env()): ConfigItem {
  if (has(source, "CRON_SECRET")) {
    return {
      id: "cron",
      label: "Scheduled jobs",
      level: "ready",
      detail: "CRON_SECRET is set; /api/cron/cart-reminders can be called by cron.",
    };
  }
  return {
    id: "cron",
    label: "Scheduled jobs",
    level: "missing",
    detail: "CRON_SECRET is not set, so every /api/cron route refuses to run.",
    impact: "Abandoned-cart reminders only happen when an admin opens the page.",
    keys: ["CRON_SECRET"],
  };
}

/** Backups: a compose profile, not an environment variable. */
export function backupStatus(source: Env = env()): ConfigItem {
  const retention = has(source, "BACKUP_RETENTION_DAYS");
  return {
    id: "backups",
    label: "Backups",
    level: "partial",
    detail: retention
      ? `Nightly dumps keep ${source.BACKUP_RETENTION_DAYS} days once \`docker compose --profile ops up -d backup\` is running.`
      : "The backup service is opt-in; check `docker compose --profile ops ps` on the server.",
    impact:
      "A dump has not been restored until `scripts/restore-drill.sh` has run against it.",
    keys: ["BACKUP_RETENTION_DAYS"],
  };
}

/** Turnaround promises on the PDP and policies depend on this being set. */
export function socialStatus(source: Env = env()): ConfigItem {
  const networks = [
    "NEXT_PUBLIC_SOCIAL_INSTAGRAM",
    "NEXT_PUBLIC_SOCIAL_FACEBOOK",
    "NEXT_PUBLIC_SOCIAL_PINTEREST",
    "NEXT_PUBLIC_SOCIAL_YOUTUBE",
  ];
  const present = networks.filter((key) => has(source, key));
  if (present.length === 0) {
    return {
      id: "social",
      label: "Social links",
      level: "missing",
      detail: "No social profiles are configured, so the footer omits the row entirely.",
      impact: "Nothing is broken; the links simply are not there.",
      keys: networks,
    };
  }
  return {
    id: "social",
    label: "Social links",
    level: present.length === networks.length ? "ready" : "partial",
    detail: `${present.length} of ${networks.length} social links are set.`,
    keys: networks.filter((key) => !has(source, key)),
  };
}

/**
 * GST-01 — seller identity and tax registration.
 *
 * Presence and shape only; the values never leave `gstConfigStatus`. This is a
 * compliance gate, not a tax engine: "ready" means the fields are filled in and
 * well-formed, not that a CA has signed off or that an invoice may be issued.
 */
export function taxStatus(source: Env = env()): ConfigItem {
  const gst = gstConfigStatus(source);
  if (gst.ready) {
    return {
      id: "tax",
      label: "Tax & invoicing",
      level: "ready",
      detail:
        "Seller and GST fields are present and well-formed. A chartered accountant must still verify them before any statutory invoice is issued.",
      impact:
        "Prices still show an indicative tax split; this deployment does not issue statutory invoices.",
      keys: [],
    };
  }

  const parts: string[] = [];
  if (gst.missing.length) parts.push(`missing ${gst.missing.join(", ")}`);
  if (gst.invalid.length) parts.push(`invalid ${gst.invalid.join(", ")}`);
  const level: ConfigLevel =
    gst.missing.length === gst.fields.length ? "missing" : "partial";
  return {
    id: "tax",
    label: "Tax & invoicing",
    level,
    detail: `GST/seller configuration is incomplete (${parts.join("; ")}). These MUST be supplied and verified by the owner/accountant.`,
    impact:
      "No statutory invoice is issued; prices show an indicative tax split only.",
    keys: [...gst.missing, ...gst.invalid],
  };
}

/** Everything, in the order a shopkeeper cares about it. */
export function configurationChecklist(source: Env = env()): ConfigItem[] {
  const items: ConfigItem[] = [
    paymentStatus(source),
    emailStatus(source),
    fulfilmentStatus(source),
    cronStatus(source),
    backupStatus(source),
    socialStatus(source),
  ];
  // The tax item joins the checklist as soon as any GST/seller field is set —
  // which a real deployment always has, because SELLER_HOME_STATE and GST_RATE
  // are passed into the storefront container. A completely empty synthetic env
  // stays at the six historical items, so the existing "checklist cannot
  // silently shrink" guard still describes the base set.
  if (hasAnyGstConfig(source)) items.push(taxStatus(source));
  return items;
}

/**
 * Whether checkout can take money. Used by the checkout page to decide between
 * "pay now" and an honest note, rather than letting the buyer fill in an address
 * and fail at the last step.
 */
export function checkoutIsPossible(source: Env = env()): boolean {
  const status = paymentStatus(source);
  return status.level !== "missing";
}
