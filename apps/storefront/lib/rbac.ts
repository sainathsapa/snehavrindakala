/**
 * RBAC (Role-Based Access Control) for SnehaVrinda Kala admin.
 *
 * IMPORTANT: this is enforced on the SERVER, not just in the UI.
 * `requirePermission()` in app/admin/actions.ts reads the role from the signed
 * admin session and checks it against this matrix before any privileged
 * mutation. The client hooks use the same matrix only to hide controls.
 *
 * ROLE NAMESPACING (GAP-01 closure):
 *   Platform (this file) canonical roles use the `platform_` prefix. Partner
 *   portal roles (lib/partner/types.ts) use the `partner_` prefix. The two
 *   string domains are disjoint, so a partner role can never be evaluated by
 *   this matrix (and a platform role can never be evaluated by the partner
 *   matrix). Bare, legacy role names are still accepted during the transition
 *   (see the migration note in db/migrations/006_role_namespacing.sql) but are
 *   canonicalised at every trusted resolution boundary before any permission
 *   check, so a legacy ambiguous value never grants elevated access across the
 *   namespace boundary.
 *
 * Canonical platform roles:
 *   - platform_super_admin: full access, including users, roles and settings
 *   - platform_admin:       operational + finance leadership; no user/role management
 *   - platform_manager:     orders, products, categories, artists, inventory, shipping
 *   - platform_operations:  order fulfilment, shipping, inventory, support
 *   - platform_finance:     refunds, approvals, finance data, settlements
 *   - platform_support:     tickets, view orders/customers, request refunds
 *   - partner:              partner-scoped read access (tenant isolation enforced separately).
 *                           Deliberately keeps its stable, unprefixed value: it does not
 *                           collide with `partner_*` partner roles and is compared literally
 *                           by the platform marketplace guards outside this module.
 *   - platform_viewer:      read-only
 *
 * Legacy platform aliases (transition only): super_admin, admin, manager,
 * operations, finance, support, viewer. They retain identical permissions and
 * are mapped to their canonical `platform_*` value by canonicalPlatformRole().
 *
 * Unknown roles are denied every permission (fail closed).
 */

export type PlatformRoleCanonical =
  | "platform_super_admin"
  | "platform_admin"
  | "platform_manager"
  | "platform_operations"
  | "platform_finance"
  | "platform_support"
  | "partner"
  | "platform_viewer";

export type PlatformRoleLegacy =
  | "super_admin"
  | "admin"
  | "manager"
  | "operations"
  | "finance"
  | "support"
  | "viewer";

export type Role = PlatformRoleCanonical | PlatformRoleLegacy;

export type Permission =
  | "orders:read" | "orders:write" | "orders:delete"
  | "products:read" | "products:write" | "products:delete"
  | "categories:read" | "categories:write" | "categories:delete"
  | "customers:read" | "customers:write"
  | "artists:read" | "artists:write" | "artists:delete"
  | "partners:read" | "partners:write"
  | "inventory:read" | "inventory:write"
  | "shipments:write"
  | "refunds:read" | "refunds:write" | "refunds:approve"
  | "finance:read" | "settlements:write"
  | "tickets:read" | "tickets:write" | "tickets:assign"
  | "users:read" | "users:write" | "users:delete"
  | "roles:read" | "roles:write"
  | "settings:read" | "settings:write"
  // Editorial surfaces the studio writes directly: rooms (curated groupings of
  // work) and the newsroom. They are not products, so they get their own
  // permission — a support account that may add a press mention should not have
  // to be able to reprice a product to do it.
  | "content:read" | "content:write";

const ALL: Permission[] = [
  "orders:read", "orders:write", "orders:delete",
  "products:read", "products:write", "products:delete",
  "categories:read", "categories:write", "categories:delete",
  "customers:read", "customers:write",
  "artists:read", "artists:write", "artists:delete",
  "partners:read", "partners:write",
  "inventory:read", "inventory:write",
  "shipments:write",
  "refunds:read", "refunds:write", "refunds:approve",
  "finance:read", "settlements:write",
  "tickets:read", "tickets:write", "tickets:assign",
  "users:read", "users:write", "users:delete",
  "roles:read", "roles:write",
  "settings:read", "settings:write",
  "content:read", "content:write",
];

const ADMIN: Permission[] = [
  "orders:read", "orders:write", "orders:delete",
  "products:read", "products:write", "products:delete",
  "categories:read", "categories:write", "categories:delete",
  "customers:read", "customers:write",
  "artists:read", "artists:write", "artists:delete",
  "partners:read", "partners:write",
  "inventory:read", "inventory:write",
  "shipments:write",
  "refunds:read", "refunds:write", "refunds:approve",
  "finance:read", "settlements:write",
  "tickets:read", "tickets:write", "tickets:assign",
  "users:read", "roles:read",
  "settings:read", "settings:write",
  "content:read", "content:write",
];

const MANAGER: Permission[] = [
  "orders:read", "orders:write",
  "products:read", "products:write", "products:delete",
  "categories:read", "categories:write", "categories:delete",
  "customers:read",
  "artists:read", "artists:write",
  "partners:read",
  "inventory:read", "inventory:write",
  "shipments:write",
  "refunds:read", "refunds:write",
  "tickets:read",
  "content:read", "content:write",
];

const OPERATIONS: Permission[] = [
  "orders:read", "orders:write",
  "products:read",
  "customers:read",
  "partners:read",
  "inventory:read", "inventory:write",
  "shipments:write",
  "refunds:read",
  "tickets:read", "tickets:write", "tickets:assign",
];

const FINANCE: Permission[] = [
  "orders:read",
  "customers:read",
  "partners:read",
  "products:read",
  "refunds:read", "refunds:write", "refunds:approve",
  "finance:read", "settlements:write",
  "tickets:read",
];

const SUPPORT: Permission[] = [
  "orders:read",
  "customers:read", "customers:write",
  "refunds:read", "refunds:write",
  "tickets:read", "tickets:write", "tickets:assign",
  // Support staff answer the phone about a work that is wrongly described, or
  // are asked to add a press mention after a call from a journalist. Both are
  // content, so both are here — but product pricing, deletion and settings stay
  // out of reach, which is the point of a separate permission.
  "products:read", "products:write",
  "categories:read",
  "inventory:read",
  "content:read", "content:write",
];

const PARTNER_SCOPED: Permission[] = [
  // Partner-scoped reads only. Tenant isolation is enforced in the partner
  // data layer, never by this matrix alone.
  "orders:read", "products:read", "partners:read",
];

const VIEWER: Permission[] = [
  "orders:read",
  "products:read",
  "categories:read",
  "customers:read",
  "artists:read",
  "partners:read",
  "inventory:read",
  "refunds:read",
  "finance:read",
  "tickets:read",
  "settings:read",
];

/**
 * Role → Permissions matrix. Additive; existing roles keep their old powers.
 * Both canonical `platform_*` keys and legacy bare names are present so legacy
 * data keeps working during the transition. Partner canonical (`partner_*`)
 * keys are deliberately absent — passing one here fails closed.
 */
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  // --- canonical platform roles ---
  platform_super_admin: ALL,
  platform_admin: ADMIN,
  platform_manager: MANAGER,
  platform_operations: OPERATIONS,
  platform_finance: FINANCE,
  platform_support: SUPPORT,
  partner: PARTNER_SCOPED,
  platform_viewer: VIEWER,
  // --- legacy platform aliases (transition only) ---
  super_admin: ALL,
  admin: ADMIN,
  manager: MANAGER,
  operations: OPERATIONS,
  finance: FINANCE,
  support: SUPPORT,
  viewer: VIEWER,
};

export const ROLE_LABELS: Record<Role, string> = {
  platform_super_admin: "Super Admin",
  platform_admin: "Admin",
  platform_manager: "Manager",
  platform_operations: "Operations Staff",
  platform_finance: "Finance Staff",
  platform_support: "Customer Support",
  partner: "Partner",
  platform_viewer: "Read-only Viewer",
  super_admin: "Super Admin",
  admin: "Admin",
  manager: "Manager",
  operations: "Operations Staff",
  finance: "Finance Staff",
  support: "Customer Support",
  viewer: "Read-only Viewer",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  platform_super_admin: "Full access to all admin features including user and role management.",
  platform_admin: "Runs the business day to day, including finance and partners; no user/role management.",
  platform_manager: "Manages orders, products, categories, artists and inventory.",
  platform_operations: "Fulfils orders, manages shipments and inventory, handles support.",
  platform_finance: "Reviews refunds, finance records and partner settlements.",
  platform_support: "Handles support tickets and view-only order/customer context; may request refunds.",
  partner: "Partner-scoped access to their own orders and catalogue.",
  platform_viewer: "Read-only access to admin resources.",
  super_admin: "Full access to all admin features including user and role management.",
  admin: "Runs the business day to day, including finance and partners; no user/role management.",
  manager: "Manages orders, products, categories, artists and inventory.",
  operations: "Fulfils orders, manages shipments and inventory, handles support.",
  finance: "Reviews refunds, finance records and partner settlements.",
  support: "Handles support tickets and view-only order/customer context; may request refunds.",
  viewer: "Read-only access to admin resources.",
};

/** Legacy bare platform name → canonical platform role value. */
const LEGACY_TO_CANONICAL_PLATFORM: Record<PlatformRoleLegacy, Role> = {
  super_admin: "platform_super_admin",
  admin: "platform_admin",
  manager: "platform_manager",
  operations: "platform_operations",
  finance: "platform_finance",
  support: "platform_support",
  viewer: "platform_viewer",
};

const CANONICAL_PLATFORM_VALUES = new Set<string>([
  "platform_super_admin", "platform_admin", "platform_manager",
  "platform_operations", "platform_finance", "platform_support",
  "platform_viewer", "partner",
]);

export function isCanonicalPlatformRole(value: unknown): value is PlatformRoleCanonical {
  return typeof value === "string" && CANONICAL_PLATFORM_VALUES.has(value);
}

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(ROLE_PERMISSIONS, value);
}

/**
 * Fail-closed boundary between the partner and platform RBAC namespaces.
 *
 * Partner membership roles (partner_owner/... or legacy owner/...) live in a
 * different table. This guard is applied where an admin identity is built
 * (getAdminIdentity): only a string that is genuinely in the platform matrix
 * may become an admin role. A partner-only or unknown role yields `null`, so no
 * identity is produced at all (QA GAP-01 mitigation). Canonical `platform_*`
 * values and legacy platform aliases are both accepted; partner values are not.
 */
export function platformRoleOrNull(value: unknown): Role | null {
  return isRole(value) ? value : null;
}

/**
 * Canonicalise a value already accepted by `platformRoleOrNull` into its stable
 * `platform_*` role value. Returns null for anything outside the platform
 * namespace. Used at every trusted platform resolution boundary so that a
 * legacy, ambiguous bare name never reaches a permission check as a bare name.
 */
export function canonicalPlatformRole(value: unknown): Role | null {
  if (typeof value !== "string" || !isRole(value)) return null;
  if (isCanonicalPlatformRole(value)) return value;
  return LEGACY_TO_CANONICAL_PLATFORM[value as PlatformRoleLegacy] ?? null;
}

/** Unknown roles / permissions are always denied (fail closed). */
/** Seniority, keyed on the four legacy/canonical names only. */
const ROLE_RANK: Record<"super_admin" | "manager" | "support" | "viewer", number> = {
  super_admin: 4,
  manager: 3,
  support: 2,
  viewer: 1,
};

/**
 * Rank for any role string the app can encounter.
 *
 * Sessions carry `platform_super_admin`; older rows carry `super_admin`. Both mean
 * the same thing, and a lookup that knows only one of them silently returns zero
 * — which is how a signed-in owner ended up with an entirely empty admin sidebar.
 */
export function roleRank(value: Role | string | null | undefined): number {
  if (!value) return 0;
  const normalised = String(value).trim().toLowerCase().replace(/^platform_/, "");
  if (!isRole(normalised)) return 0;
  const canonical =
    normalised === "super_admin" ||
    normalised === "manager" ||
    normalised === "support" ||
    normalised === "viewer"
      ? normalised
      : // Any remaining platform role ranks at manager: it is an operational
        // role, not a viewer, and never an owner.
        "manager";
  return ROLE_RANK[canonical] ?? 0;
}

export function hasPermission(role: Role | string, permission: Permission): boolean {
  if (!isRole(role)) return false;
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function can(role: Role | string, ...permissions: Permission[]): boolean {
  return permissions.every((p) => hasPermission(role, p));
}

/**
 * Explicit owner-configured bootstrap identity, with no built-in default.
 * Production must set ADMIN_EMAILS (or ADMIN_EMAIL); no private address is
 * hard-coded as a permanent super admin.
 */
export function getDefaultSuperAdminEmail(): string | null {
  return (
    process.env.ADMIN_EMAILS?.split(",")[0]?.trim() ||
    process.env.ADMIN_EMAIL?.trim() ||
    null
  );
}
