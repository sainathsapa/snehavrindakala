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

/** Everything, in the order a shopkeeper cares about it. */
export function configurationChecklist(source: Env = env()): ConfigItem[] {
  return [
    paymentStatus(source),
    emailStatus(source),
    fulfilmentStatus(source),
    cronStatus(source),
    backupStatus(source),
    socialStatus(source),
  ];
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
