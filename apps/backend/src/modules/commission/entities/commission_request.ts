/**
 * Commission request entity (DML).
 * Follows the strict status state machine (build plan Section 6.6).
 */
import { model } from "@medusajs/utils";

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

export const CommissionRequest = model.define("commission_request", {
  id: model.id().primaryKey(),
  reference_id: model.text().unique(),
  customer_id: model.id().nullable(),
  art_form: model.text(),
  brief: model.text(),
  intended_use: model.text().nullable(),
  dimensions: model.text().nullable(),
  budget_range: model.text().nullable(),
  target_date: model.dateTime().nullable(),
  delivery_region: model.text().nullable(),
  delivery_pin: model.text().nullable(),
  status: model.enum([
    "New",
    "Needs clarification",
    "Feasibility review",
    "Awaiting artist/capacity",
    "Quote drafted",
    "Quote sent",
    "Awaiting payment",
    "Accepted",
    "In production",
    "Proof review",
    "Approved",
    "Ready to dispatch",
    "Shipped",
    "Completed",
    "Declined",
    "Cancelled",
    "On hold",
    "Expired",
    "Refund pending",
    "Refunded",
    "Disputed",
  ]).default("New"),
  assigned_artist_id: model.id().nullable(),
  metadata: model.json().nullable(),
});

export const COMMISSION_TRANSITIONS: Record<CommissionStatus, CommissionStatus[]> = {
  New: ["Needs clarification", "Feasibility review", "Declined", "Expired"],
  "Needs clarification": ["Feasibility review", "New", "Declined"],
  "Feasibility review": ["Awaiting artist/capacity", "Needs clarification", "Declined"],
  "Awaiting artist/capacity": ["Quote drafted", "Declined", "On hold"],
  "Quote drafted": ["Quote sent", "Declined"],
  "Quote sent": ["Awaiting payment", "Expired", "Declined"],
  "Awaiting payment": ["Accepted", "Expired", "Declined", "Refund pending"],
  Accepted: ["In production", "Cancelled", "Refund pending"],
  "In production": ["Proof review", "On hold", "Cancelled"],
  "Proof review": ["Approved", "In production", "Cancelled"],
  Approved: ["Ready to dispatch", "On hold"],
  "Ready to dispatch": ["Shipped", "On hold"],
  Shipped: ["Completed", "Refund pending"],
  Completed: ["Refund pending"],
  Declined: ["New"],
  Cancelled: ["New"],
  "On hold": ["Awaiting artist/capacity", "In production", "Cancelled"],
  Expired: ["New"],
  "Refund pending": ["Refunded", "Declined"],
  Refunded: [],
  Disputed: ["Refund pending", "Completed"],
};
