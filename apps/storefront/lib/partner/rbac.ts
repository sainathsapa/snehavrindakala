/**
 * Partner-side RBAC. This matrix is advisory for the portal UI; the real
 * enforcement is `requirePartnerPermission()` which also re-reads the membership
 * from the database. Unknown roles/permissions are always denied (fail closed).
 */

import type { PartnerRole } from "./types";

export type PartnerPermission =
  | "dashboard:read"
  | "products:read"
  | "products:write"
  | "inventory:read"
  | "inventory:write"
  | "orders:read"
  | "orders:write"
  | "shipments:read"
  | "shipments:write"
  | "customers:read"
  | "earnings:read"
  | "statements:read"
  | "settlements:read"
  | "team:read"
  | "team:write"
  | "profile:read"
  | "profile:write"
  | "security:write";

const ALL: PartnerPermission[] = [
  "dashboard:read", "products:read", "products:write",
  "inventory:read", "inventory:write", "orders:read", "orders:write",
  "shipments:read", "shipments:write", "customers:read", "earnings:read",
  "statements:read", "settlements:read", "team:read", "team:write",
  "profile:read", "profile:write", "security:write",
];

export const PARTNER_ROLE_PERMISSIONS: Record<PartnerRole, PartnerPermission[]> = {
  owner: ALL,
  manager: [
    "dashboard:read", "products:read", "products:write",
    "inventory:read", "inventory:write", "orders:read", "orders:write",
    "shipments:read", "shipments:write", "customers:read",
    "earnings:read", "statements:read", "profile:read", "profile:write",
    "team:read", "team:write",
  ],
  operations: [
    "dashboard:read", "products:read", "inventory:read", "inventory:write",
    "orders:read", "orders:write", "shipments:read", "shipments:write",
    "customers:read", "profile:read",
  ],
  finance: [
    "dashboard:read", "orders:read", "earnings:read", "statements:read",
    "settlements:read", "profile:read",
  ],
  viewer: [
    "dashboard:read", "products:read", "inventory:read", "orders:read",
    "shipments:read", "profile:read",
  ],
};

export function partnerHasPermission(
  role: unknown,
  permission: PartnerPermission
): boolean {
  if (typeof role !== "string" || !(role in PARTNER_ROLE_PERMISSIONS)) return false;
  return (PARTNER_ROLE_PERMISSIONS as Record<string, PartnerPermission[]>)[role].includes(
    permission
  );
}

export function partnerCan(
  role: unknown,
  ...permissions: PartnerPermission[]
): boolean {
  return permissions.every((p) => partnerHasPermission(role, p));
}
