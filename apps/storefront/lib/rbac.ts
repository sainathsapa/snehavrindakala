/**
 * RBAC (Role-Based Access Control) for SnehaVrinda Kala admin.
 *
 * IMPORTANT: this is enforced on the SERVER, not just in the UI.
 * `requirePermission()` in app/admin/actions.ts reads the role from the signed
 * admin session and checks it against this matrix before any privileged
 * mutation. The client hooks use the same matrix only to hide controls.
 *
 * Roles (all values are valid values of admin_users.role / session.role):
 *   - super_admin: full access, including users, roles and settings
 *   - admin:       operational + finance leadership; no user/role management
 *   - manager:     orders, products, categories, artists, inventory, shipping
 *   - operations:  order fulfilment, shipping, inventory, support
 *   - finance:     refunds, approvals, finance data, settlements
 *   - support:     tickets, view orders/customers, request refunds
 *   - partner:     partner-scoped read access (tenant isolation enforced separately)
 *   - viewer:      read-only
 *
 * Unknown roles are denied every permission (fail closed).
 */

export type Role =
  | "super_admin"
  | "admin"
  | "manager"
  | "operations"
  | "finance"
  | "support"
  | "partner"
  | "viewer";

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
  | "settings:read" | "settings:write";

/** Role → Permissions matrix. Additive; existing roles keep their old powers. */
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  super_admin: [
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
  ],
  admin: [
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
  ],
  manager: [
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
  ],
  operations: [
    "orders:read", "orders:write",
    "products:read",
    "customers:read",
    "partners:read",
    "inventory:read", "inventory:write",
    "shipments:write",
    "refunds:read",
    "tickets:read", "tickets:write", "tickets:assign",
  ],
  finance: [
    "orders:read",
    "customers:read",
    "partners:read",
    "products:read",
    "refunds:read", "refunds:write", "refunds:approve",
    "finance:read", "settlements:write",
    "tickets:read",
  ],
  support: [
    "orders:read",
    "customers:read", "customers:write",
    "refunds:read", "refunds:write",
    "tickets:read", "tickets:write", "tickets:assign",
  ],
  partner: [
    // Partner-scoped reads only. Tenant isolation is enforced in the partner
    // data layer, never by this matrix alone.
    "orders:read", "products:read", "partners:read",
  ],
  viewer: [
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
  ],
};

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  manager: "Manager",
  operations: "Operations Staff",
  finance: "Finance Staff",
  support: "Customer Support",
  partner: "Partner",
  viewer: "Read-only Viewer",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  super_admin: "Full access to all admin features including user and role management.",
  admin: "Runs the business day to day, including finance and partners; no user/role management.",
  manager: "Manages orders, products, categories, artists and inventory.",
  operations: "Fulfils orders, manages shipments and inventory, handles support.",
  finance: "Reviews refunds, finance records and partner settlements.",
  support: "Handles support tickets and view-only order/customer context; may request refunds.",
  partner: "Partner-scoped access to their own orders and catalogue.",
  viewer: "Read-only access to admin resources.",
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(ROLE_PERMISSIONS, value);
}

/** Unknown roles / permissions are always denied (fail closed). */
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
