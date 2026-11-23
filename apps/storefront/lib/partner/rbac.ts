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

const MANAGER: PartnerPermission[] = [
  "dashboard:read", "products:read", "products:write",
  "inventory:read", "inventory:write", "orders:read", "orders:write",
  "shipments:read", "shipments:write", "customers:read",
  "earnings:read", "statements:read", "profile:read", "profile:write",
  "team:read", "team:write",
];

const OPERATIONS: PartnerPermission[] = [
  "dashboard:read", "products:read", "inventory:read", "inventory:write",
  "orders:read", "orders:write", "shipments:read", "shipments:write",
  "customers:read", "profile:read",
];

const FINANCE: PartnerPermission[] = [
  "dashboard:read", "orders:read", "earnings:read", "statements:read",
  "settlements:read", "profile:read",
];

const VIEWER: PartnerPermission[] = [
  "dashboard:read", "products:read", "inventory:read", "orders:read",
  "shipments:read", "profile:read",
];

/**
 * Canonical `partner_*` keys are the source of truth. Bare legacy names remain
 * as keys during the transition with identical permissions. Platform canonical
 * (`platform_*`) keys are deliberately absent, so a platform role evaluated by
 * this matrix fails closed.
 */
export const PARTNER_ROLE_PERMISSIONS: Record<PartnerRole, PartnerPermission[]> = {
  // --- canonical partner roles ---
  partner_owner: ALL,
  partner_manager: MANAGER,
  partner_operations: OPERATIONS,
  partner_finance: FINANCE,
  partner_viewer: VIEWER,
  // --- legacy partner aliases (transition only) ---
  owner: ALL,
  manager: MANAGER,
  operations: OPERATIONS,
  finance: FINANCE,
  viewer: VIEWER,
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
