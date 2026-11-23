/**
 * Owner-input configuration validator.
 *
 * The FINAL GO mission must never fabricate credentials, partner identities,
 * commission rates, GSTINs or payout terms. Anything the owner has not supplied
 * is reported as UNCONFIGURED. The report is deliberately presence-only:
 *
 *   - it names fields and environment variables, never their values;
 *   - a group is "configured" only when every one of its currently-required
 *     fields has a value (no partial credit);
 *   - integration fields that are switched off (feature flag off and no
 *     indicator set) are not required, so a disabled feature is not reported
 *     as broken config;
 *   - business rules have no defaults: a missing rate/basis/term/identity is a
 *     hard false, not a guessed zero.
 *
 * This complements (and does not replace) `lib/config-status.ts` and
 * `lib/startup-validation.ts`. It is the presence report an operator can paste
 * into a ticket without leaking a secret.
 */

export type OwnerInputEnv = Record<string, string | undefined>;

export const OWNER_INPUT_GROUPS = [
  "Payments",
  "Email",
  "Shipping",
  "PartnerBusiness",
  "FinanceLegal",
  "Production",
] as const;

export type OwnerInputGroup = (typeof OWNER_INPUT_GROUPS)[number];

/**
 * When a field is required. "always" fields are owner inputs the mission cannot
 * proceed without; "feature" fields are required only when the named flag is
 * on, or when one of its indicator variables already holds a value (a
 * half-configured integration is still an enabled one).
 */
export type RequiredFor =
  | { kind: "always" }
  | { kind: "feature"; flag: string; indicators?: readonly string[] };

export interface OwnerInputField {
  /** Stable canonical key, used for reporting. */
  key: string;
  /** Environment variable that carries the value, when env-backed. */
  envVar?: string;
  /** Alternative env vars, any one of which also satisfies presence. */
  alternatives?: readonly string[];
  /** Human-readable label for the operator. */
  label: string;
  requiredFor: RequiredFor;
}

/** One reported field. Carries names only — never a value. */
export interface OwnerInputStatus {
  group: OwnerInputGroup;
  key: string;
  /** The name to configure (env var or canonical key). */
  name: string;
  label: string;
}

export interface OwnerInputValidation {
  /** Required fields that have no value. Names only. */
  missing: OwnerInputStatus[];
  /** Fields that have a value. Names only. */
  present: OwnerInputStatus[];
  /** True only when every required field of the group has a value. */
  configuredGroups: Record<OwnerInputGroup, boolean>;
}

const ALWAYS: RequiredFor = { kind: "always" };
const feature = (flag: string, indicators: readonly string[] = []): RequiredFor => ({
  kind: "feature",
  flag,
  indicators,
});

/**
 * Every owner input, grouped. `envVar` / `alternatives` are the names an
 * operator sets; business groups use confirmation flags that point at the
 * signed document / structured entry rather than at a secret value.
 */
export const OWNER_INPUT_FIELDS: Record<
  OwnerInputGroup,
  readonly OwnerInputField[]
> = {
  Payments: [
    {
      key: "razorpayKeyId",
      envVar: "RAZORPAY_KEY_ID",
      alternatives: ["NEXT_PUBLIC_RAZORPAY_KEY_ID"],
      label: "Razorpay key ID (sandbox)",
      requiredFor: ALWAYS,
    },
    {
      key: "razorpayKeySecret",
      envVar: "RAZORPAY_KEY_SECRET",
      label: "Razorpay key secret (sandbox)",
      requiredFor: ALWAYS,
    },
    {
      key: "razorpayWebhookSecret",
      envVar: "RAZORPAY_WEBHOOK_SECRET",
      label: "Razorpay webhook secret",
      requiredFor: ALWAYS,
    },
    {
      key: "refundPolicyApproved",
      envVar: "REFUND_POLICY_APPROVED",
      label: "Refund policy approved (windows and partial-refund rules)",
      requiredFor: ALWAYS,
    },
    {
      key: "razorpayLiveKeysAuthorized",
      envVar: "RAZORPAY_LIVE_KEYS_AUTHORIZED",
      label: "Live keys plus written authorization before going live",
      requiredFor: feature("CHECKOUT_RAZORPAY_PROVIDER"),
    },
  ],
  Email: [
    {
      key: "fromEmail",
      envVar: "FROM_EMAIL",
      label: "Verified SES sender address",
      requiredFor: ALWAYS,
    },
    {
      key: "awsRegion",
      envVar: "AWS_REGION",
      label: "AWS region for SES",
      requiredFor: ALWAYS,
    },
    {
      key: "sesTransport",
      envVar: "AWS_SES_ROLE_ARN",
      alternatives: ["AWS_SES_ACCESS_KEY_ID"],
      label: "SES transport (IAM role, or access key plus secret)",
      requiredFor: ALWAYS,
    },
    {
      key: "emailTestRecipient",
      envVar: "EMAIL_TEST_RECIPIENT",
      label: "One controlled test recipient for delivery verification",
      requiredFor: feature("FEATURE_EMAIL_VERIFICATION"),
    },
  ],
  Shipping: [
    {
      key: "shiprocketEmail",
      envVar: "SHIPROCKET_EMAIL",
      label: "Shiprocket account email",
      requiredFor: ALWAYS,
    },
    {
      key: "shiprocketPassword",
      envVar: "SHIPROCKET_PASSWORD",
      label: "Shiprocket account password",
      requiredFor: ALWAYS,
    },
    {
      key: "shiprocketPickupPostcode",
      envVar: "SHIPROCKET_PICKUP_POSTCODE",
      label: "Pickup / warehouse postcode",
      requiredFor: ALWAYS,
    },
    {
      key: "productDimensionsConfirmed",
      envVar: "PRODUCT_DIMENSIONS_CONFIRMED",
      label: "Real product weights and dimensions supplied (no hardcoded values)",
      requiredFor: ALWAYS,
    },
    {
      key: "shiprocketWebhookToken",
      envVar: "SHIPROCKET_WEBHOOK_TOKEN",
      label: "Shiprocket webhook token",
      requiredFor: feature("FEATURE_SHIPROCKET_WEBHOOK"),
    },
  ],
  PartnerBusiness: [
    {
      key: "partnerLegalIdentities",
      envVar: "PARTNER_LEGAL_IDENTITIES",
      label: "Legal identities of each real partner",
      requiredFor: ALWAYS,
    },
    {
      key: "partnerAgreementsSigned",
      envVar: "PARTNER_AGREEMENTS_SIGNED",
      label: "Signed partner agreements",
      requiredFor: ALWAYS,
    },
    {
      key: "commissionRates",
      envVar: "COMMISSION_RATES",
      label: "Commission rates (never guessed)",
      requiredFor: ALWAYS,
    },
    {
      key: "commissionBasis",
      envVar: "COMMISSION_BASIS",
      label: "Commission basis (gross vs discounted, tax, shipping, refunds, timing)",
      requiredFor: ALWAYS,
    },
    {
      key: "settlementPayoutTerms",
      envVar: "SETTLEMENT_PAYOUT_TERMS",
      label: "Settlement frequency and payout terms",
      requiredFor: ALWAYS,
    },
    {
      key: "cancellationReturnOwnership",
      envVar: "CANCELLATION_RETURN_OWNERSHIP",
      label: "Cancellation / return ownership per partner",
      requiredFor: ALWAYS,
    },
    {
      key: "payoutProvider",
      envVar: "PAYOUT_PROVIDER",
      label: "Payout provider (bank / UPI) and who confirms payouts",
      requiredFor: ALWAYS,
    },
    {
      key: "tdsWithholdingTreatment",
      envVar: "TDS_WITHHOLDING_TREATMENT",
      label: "TDS / withholding treatment (CA to confirm)",
      requiredFor: ALWAYS,
    },
  ],
  FinanceLegal: [
    {
      key: "sellerLegalIdentity",
      envVar: "SELLER_LEGAL_IDENTITY",
      label: "Seller legal identity and registered address",
      requiredFor: ALWAYS,
    },
    {
      key: "gstin",
      envVar: "GSTIN",
      label: "GSTIN (where applicable)",
      requiredFor: ALWAYS,
    },
    {
      key: "hsnSacCodes",
      envVar: "HSN_SAC_CODES",
      label: "HSN / SAC per product and place-of-supply rules",
      requiredFor: ALWAYS,
    },
    {
      key: "caApprovedTaxTreatment",
      envVar: "CA_APPROVED_TAX_TREATMENT",
      label: "CA-approved tax treatment (CGST/SGST/IGST)",
      requiredFor: ALWAYS,
    },
    {
      key: "grievanceOfficer",
      envVar: "GRIEVANCE_OFFICER_CONTACT",
      label: "Grievance officer contact",
      requiredFor: ALWAYS,
    },
    {
      key: "policiesSignedOff",
      envVar: "POLICIES_SIGNED_OFF",
      label: "Privacy / refunds / terms policy sign-off",
      requiredFor: ALWAYS,
    },
  ],
  Production: [
    {
      key: "sessionSecret",
      envVar: "COOKIE_SECRET",
      alternatives: ["JWT_SECRET"],
      label: "Session signing secret (COOKIE_SECRET or JWT_SECRET)",
      requiredFor: ALWAYS,
    },
    {
      key: "databaseUrl",
      envVar: "DATABASE_URL",
      label: "Production database URL",
      requiredFor: ALWAYS,
    },
    {
      key: "adminEmail",
      envVar: "ADMIN_EMAIL",
      label: "Admin credentials (email)",
      requiredFor: ALWAYS,
    },
    {
      key: "adminPassword",
      envVar: "ADMIN_PASSWORD",
      label: "Admin credentials (password)",
      requiredFor: ALWAYS,
    },
    {
      key: "storefrontBaseUrl",
      envVar: "STOREFRONT_BASE_URL",
      label: "Storefront base URL",
      requiredFor: ALWAYS,
    },
    {
      key: "domainDnsTls",
      envVar: "DOMAIN_DNS_TLS",
      label: "Domain, DNS and TLS configured",
      requiredFor: ALWAYS,
    },
    {
      key: "backupDestination",
      envVar: "BACKUP_DESTINATION",
      label: "Backup destination and restore-drill window",
      requiredFor: ALWAYS,
    },
    {
      key: "credentialRotationConfirmed",
      envVar: "CREDENTIAL_ROTATION_CONFIRMED",
      label: "Historically leaked credentials revoked and rotated externally",
      requiredFor: ALWAYS,
    },
    {
      key: "monitoringConfig",
      envVar: "MONITORING_CONFIG",
      label: "Monitoring / error-alerting configuration",
      requiredFor: feature("FEATURE_MONITORING", ["SENTRY_DSN"]),
    },
  ],
};

/** Values that mean "set to something meaningless" — treated as off/unset. */
const OFF = new Set(["", "0", "false", "no", "off", "none", "null", "undefined"]);

const hasValue = (env: OwnerInputEnv, key: string): boolean => {
  const raw = env[key];
  if (raw === undefined || raw === null) return false;
  return !OFF.has(String(raw).trim().toLowerCase());
};

const isRequired = (field: OwnerInputField, env: OwnerInputEnv): boolean => {
  const rule = field.requiredFor;
  if (rule.kind === "always") return true;
  if (hasValue(env, rule.flag)) return true;
  return (rule.indicators ?? []).some((key) => hasValue(env, key));
};

const isPresent = (field: OwnerInputField, env: OwnerInputEnv): boolean =>
  [field.envVar ?? field.key, ...(field.alternatives ?? [])].some((name) =>
    hasValue(env, name)
  );

const toStatus = (group: OwnerInputGroup, field: OwnerInputField): OwnerInputStatus => ({
  group,
  key: field.key,
  name: field.envVar ?? field.key,
  label: field.label,
});

/**
 * Report which owner inputs are configured, by NAME only.
 *
 * `configuredGroups[group]` is true only when the group has at least one
 * currently-required field and every one of those fields is present. A group
 * whose fields are all switched off is reported as not configured (there is
 * nothing configured yet), never as vacuously ready.
 */
export function validateOwnerInputs(
  env: OwnerInputEnv = process.env as OwnerInputEnv
): OwnerInputValidation {
  const missing: OwnerInputStatus[] = [];
  const present: OwnerInputStatus[] = [];
  const configuredGroups = {} as Record<OwnerInputGroup, boolean>;

  for (const group of OWNER_INPUT_GROUPS) {
    let requiredCount = 0;
    let groupMissing = 0;

    for (const field of OWNER_INPUT_FIELDS[group]) {
      const required = isRequired(field, env);
      const filled = isPresent(field, env);
      if (filled) present.push(toStatus(group, field));
      if (required) {
        requiredCount += 1;
        if (!filled) {
          missing.push(toStatus(group, field));
          groupMissing += 1;
        }
      }
    }

    configuredGroups[group] = requiredCount > 0 && groupMissing === 0;
  }

  return { missing, present, configuredGroups };
}

/** The four business facts that must be supplied before settlements can be enabled. */
export const BUSINESS_RULE_KEYS = [
  "partnerIdentities",
  "commissionRates",
  "commissionBasis",
  "payoutTerms",
] as const;

export type BusinessRuleKey = (typeof BUSINESS_RULE_KEYS)[number];

/** Accept both camelCase and snake_case / finance-module shapes. */
export interface BusinessConfig {
  [key: string]: unknown;
}

const BUSINESS_ALIASES: Record<BusinessRuleKey, readonly string[]> = {
  partnerIdentities: ["partnerIdentities", "partner_identities", "partners"],
  commissionRates: ["commissionRates", "commission_rates", "rate_percent", "ratePercent", "rate"],
  commissionBasis: ["commissionBasis", "commission_basis", "rate_basis", "rateBasis", "basis"],
  payoutTerms: ["payoutTerms", "payout_terms", "settlementTerms", "settlement_terms"],
};

const PLACEHOLDERS = new Set([
  "0", "none", "null", "undefined", "tbd", "todo", "default", "auto",
  "placeholder", "n/a", "na", "unknown",
]);

function hasBusinessValue(value: unknown, key: BusinessRuleKey): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") {
    const text = value.trim();
    if (!text || PLACEHOLDERS.has(text.toLowerCase())) return false;
    if (key === "commissionRates") {
      const n = Number(text);
      if (Number.isFinite(n) && n <= 0) return false;
    }
    return true;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return false;
    if (key === "commissionRates" && value <= 0) return false;
    return true;
  }
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).some(
      (v) => v !== null && v !== undefined && String(v).trim() !== ""
    );
  }
  return false;
}

function pickBusinessValue(config: BusinessConfig, key: BusinessRuleKey): unknown {
  for (const alias of BUSINESS_ALIASES[key]) {
    if (Object.prototype.hasOwnProperty.call(config, alias) && config[alias] !== undefined) {
      return config[alias];
    }
  }
  return undefined;
}

/**
 * True only when partner identities, commission rates, commission basis and
 * payout terms are all explicitly supplied. There are NO defaults: an empty
 * config, a partial config, or placeholder values all return false.
 */
export function businessRulesReady(config: BusinessConfig | null | undefined): boolean {
  if (!config || typeof config !== "object") return false;
  return BUSINESS_RULE_KEYS.every((key) =>
    hasBusinessValue(pickBusinessValue(config, key), key)
  );
}
