/**
 * Studio progress on a commission.
 *
 * `commission_milestone` has existed since the commission module was written,
 * with columns for a name, a description, a due date and `proof_object_key` —
 * and nothing ever read it. So the buyer's status page showed a status, and a
 * commission that takes weeks looked like it had stalled the moment the quote
 * was accepted.
 *
 * These functions are the read and write paths for that table. A milestone is
 * an update the studio chooses to publish: a dated line, optionally with a
 * photograph of the work in progress. Nothing is derived or auto-generated,
 * because a progress note nobody wrote is not progress.
 */

import { query, queryResult } from "@/lib/db";

export interface Milestone {
  id: string;
  name: string;
  description: string;
  proof_url: string;
  status: string;
  due_date: string | null;
  created_at: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): boolean {
  return typeof value === "string" && UUID.test(value);
}

/**
 * Proof images are stored as a storage key by the commission upload route and as
 * a URL by the admin upload route. Both are accepted and normalised to something
 * an <img> can use; anything else is dropped rather than rendered as a broken
 * image.
 */
export function normaliseProofUrl(value: unknown): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("/uploads/")) return trimmed;
  if (/^[a-zA-Z0-9._-]+$/.test(trimmed)) return `/uploads/${trimmed}`;
  return "";
}

export async function listMilestones(commissionRequestId: string): Promise<Milestone[]> {
  if (!isUuid(commissionRequestId)) return [];
  const result = await queryResult<{
    id: string;
    name: string | null;
    description: string | null;
    proof_object_key: string | null;
    status: string | null;
    due_date: string | null;
    created_at: string;
  }>(
    `SELECT id, name, description, proof_object_key, status, due_date, created_at
       FROM commission_milestone
      WHERE commission_request_id=$1 AND deleted_at IS NULL
      ORDER BY sequence NULLS LAST, created_at`,
    [commissionRequestId]
  );

  return result.rows.map((row) => ({
    id: row.id,
    name: row.name || "",
    description: row.description || "",
    proof_url: normaliseProofUrl(row.proof_object_key),
    status: row.status || "pending",
    due_date: row.due_date,
    created_at: row.created_at,
  }));
}

/**
 * Publish an update.
 *
 * The sequence is taken from the current maximum rather than from a count, so a
 * deleted update does not cause the next one to collide with an existing number
 * and reorder the story.
 */
export async function addMilestone(input: {
  commissionRequestId: string;
  name: string;
  description?: string;
  proofUrl?: string;
}): Promise<Milestone | null> {
  if (!isUuid(input.commissionRequestId)) return null;
  const name = (input.name || "").trim().slice(0, 120);
  if (!name) return null;

  const next = await queryResult<{ sequence: number }>(
    `SELECT COALESCE(MAX(sequence), 0) + 1 AS sequence
       FROM commission_milestone WHERE commission_request_id=$1`,
    [input.commissionRequestId]
  );

  const result = await queryResult<{ id: string }>(
    `INSERT INTO commission_milestone
       (commission_request_id, name, description, sequence, status, proof_object_key)
     VALUES ($1,$2,$3,$4,'completed',$5)
     RETURNING id`,
    [
      input.commissionRequestId,
      name,
      (input.description || "").slice(0, 2000),
      next.rows[0]?.sequence ?? 1,
      normaliseProofUrl(input.proofUrl) || null,
    ]
  );

  const created = result.rows[0]?.id;
  if (!created) return null;
  return (await listMilestones(input.commissionRequestId)).find((m) => m.id === created) ?? null;
}

export async function deleteMilestone(id: string): Promise<boolean> {
  if (!isUuid(id)) return false;
  const result = await queryResult(
    `UPDATE commission_milestone SET deleted_at=NOW()
      WHERE id=$1 AND deleted_at IS NULL`,
    [id]
  );
  return (result.rowCount ?? 0) > 0;
}
