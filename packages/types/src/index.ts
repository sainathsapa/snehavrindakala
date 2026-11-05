// Shared API/domain types for SnehaVrinda Kala.
// Do not duplicate Medusa internal models here; reference them by ID/handle.

export type Money = {
  amount: number; // minor currency units
  currency: string;
};

export type ProductStatus = "draft" | "published" | "archived";

export type StockType =
  | "ready_to_ship"
  | "made_to_order"
  | "custom_only"
  | "digital";

export type CommissionStatus =
  | "New"
  | "Needs clarification"
  | "Feasibility review"
  | "Awaiting artist/capacity"
  | "Quote drafted"
  | "Quote sent"
  | "Awaiting payment"
  | "Accepted"
  | "In production"
  | "Proof review"
  | "Approved"
  | "Ready to dispatch"
  | "Shipped"
  | "Completed"
  | "Declined"
  | "Cancelled"
  | "On hold"
  | "Expired"
  | "Refund pending"
  | "Refunded"
  | "Disputed";

export interface Artist {
  id: string;
  displayName: string;
  slug: string;
  bio?: string;
  disciplines: string[];
  techniques: string[];
  region?: string; // only if consented
  portraitMediaId?: string;
  status: "pending" | "approved" | "suspended";
  commissionAvailable: boolean;
}

export interface CommissionRequest {
  id: string;
  customerId: string;
  artForm: string;
  brief: string;
  status: CommissionStatus;
  assignedArtistId?: string;
}
