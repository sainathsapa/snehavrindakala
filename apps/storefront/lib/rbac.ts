/**
 * RBAC (Role-Based Access Control) for SnehaVrinda Kala admin.
 *
 * Roles:
 *   - super_admin: Full access to everything (users, roles, all resources)
 *   - manager: Manage orders, products, categories, artists (no user/role mgmt)
 *   - support: Manage support tickets, view orders/customers (no edits to core data)
 *   - viewer: Read-only access to all resources
 *
 * Permissions are checked server-side in every Server Action and API route.
 */

export type Role =
  | "super_admin"
  | "manager"
  | "support"
  | "viewer";

export type Permission =
  | "orders:read" | "orders:write" | "orders:delete"
  | "products:read" | "products:write" | "products:delete"
  | "categories:read" | "categories:write" | "categories:delete"
  | "customers:read" | "customers:write"
  | "artists:read" | "artists:write" | "artists:delete"
  | "tickets:read" | "tickets:write" | "tickets:assign"
  | "users:read" | "users:write" | "users:delete"
  | "roles:read" | "roles:write"
  | "settings:read" | "settings:write";

/** Role → Permissions matrix */
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  super_admin: [
    "orders:read", "orders:write", "orders:delete",
    "products:read", "products:write", "products:delete",
    "categories:read", "categories:write", "categories:delete",
    "customers:read", "customers:write",
    "artists:read", "artists:write", "artists:delete",
    "tickets:read", "tickets:write", "tickets:assign",
    "users:read", "users:write", "users:delete",
    "roles:read", "roles:write",
    "settings:read", "settings:write",
  ],
  manager: [
    "orders:read", "orders:write",
    "products:read", "products:write", "products:delete",
    "categories:read", "categories:write", "categories:delete",
    "customers:read",
    "artists:read", "artists:write",
    "tickets:read",
  ],
  support: [
    "orders:read",
    "customers:read",
    "tickets:read", "tickets:write", "tickets:assign",
  ],
  viewer: [
    "orders:read",
    "products:read",
    "categories:read",
    "customers:read",
    "artists:read",
    "tickets:read",
  ],
};

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: "Super Admin",
  manager: "Manager",
  support: "Support",
  viewer: "Viewer",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  super_admin: "Full access to all admin features including user and role management.",
  manager: "Manage orders, products, categories, and artists. No user/role management.",
  support: "Manage support tickets and view orders/customers.",
  viewer: "Read-only access to all admin resources.",
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function can(role: Role, ...permissions: Permission[]): boolean {
  return permissions.every((p) => hasPermission(role, p));
}

/** Default super admin email — from ADMIN_EMAILS env */
export function getDefaultSuperAdminEmail(): string {
  return (
    process.env.ADMIN_EMAILS?.split(",")[0]?.trim() ||
    process.env.ADMIN_EMAIL ||
    "sneha@sainath.com"
  );
}
