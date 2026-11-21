/**
 * Certificates of authenticity.
 *
 * Every page of the site claims that each work is one of one and certified, but
 * a buyer received nothing they could hold. This issues one certificate per
 * purchased work, tied to the order item so it cannot be minted twice, and gives
 * it a short unguessable code that resolves on a public page. The public page
 * proves the certificate is genuine; it never shows the buyer's name, address or
 * what they paid.
 *
 * Facts are captured at issue time rather than read from the catalogue at view
 * time. A certificate is a record of what was sold on the day it was sold: if
 * the product is later retitled or repriced, the certificate must not change
 * with it.
 */

import crypto from "crypto";
import { query, queryResult } from "@/lib/db";

let schemaReady: Promise<void> | null = null;

async function createTable(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS certificates (
      id SERIAL PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      order_id TEXT NOT NULL,
      order_item_id TEXT NOT NULL UNIQUE,
      handle TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL DEFAULT '',
      artist TEXT NOT NULL DEFAULT '',
      art_form TEXT NOT NULL DEFAULT '',
      dimensions TEXT NOT NULL DEFAULT '',
      edition TEXT NOT NULL DEFAULT '1/1',
      issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      revoked_at TIMESTAMPTZ
    )
  `);
  await query(
    `CREATE INDEX IF NOT EXISTS certificates_order_idx ON certificates (order_id)`
  );
}

export function ensureCertificatesTable(): Promise<void> {
  if (!schemaReady) {
    schemaReady = createTable().catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  return schemaReady;
}

/**
 * A reference someone can read off a printed certificate and type back in.
 *
 * Crockford's alphabet without I, L, O and U: the characters people mistype when
 * copying from paper. 16 characters from a 32-symbol alphabet is 80 bits, which
 * is far beyond guessing, and the code is never derived from the order id — a
 * certificate that could be computed from an order number would let anyone
 * enumerate the shop's sales.
 */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export function makeCertificateCode(length = 16): string {
  const bytes = crypto.randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

/** Grouped for reading aloud and typing: ABCD-EFGH-JKMN-PQRS. */
export function formatCertificateCode(code: string): string {
  return (code.match(/.{1,4}/g) ?? []).join("-");
}

export interface Certificate {
  id: number;
  code: string;
  order_id: string;
  order_item_id: string;
  handle: string;
  title: string;
  artist: string;
  art_form: string;
  dimensions: string;
  edition: string;
  issued_at: string;
  revoked_at: string | null;
}

type OrderLike = {
  id: string;
  items?: Array<{
    id: string;
    title?: string;
    product_title?: string;
    product_handle?: string;
    variant_title?: string | null;
    metadata?: Record<string, unknown> | null;
  }>;
};

function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

/**
 * Issue one certificate per item, once.
 *
 * `ON CONFLICT (order_item_id) DO NOTHING` is what makes this safe to call on
 * every checkout response, including a retried one: a buyer who refreshes the
 * confirmation page must not collect a second certificate for the same work.
 * A failure here is logged by the caller and never fails the order — the sale
 * happened, the paperwork can be reissued.
 */
export async function issueCertificatesForOrder(order: OrderLike): Promise<Certificate[]> {
  if (!order?.id || !Array.isArray(order.items)) return [];
  await ensureCertificatesTable();

  for (const item of order.items) {
    if (!item?.id) continue;
    const metadata = (item.metadata ?? {}) as Record<string, unknown>;
    await query(
      `INSERT INTO certificates
         (code, order_id, order_item_id, handle, title, artist, art_form, dimensions)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (order_item_id) DO NOTHING`,
      [
        makeCertificateCode(),
        order.id,
        item.id,
        firstString(item.product_handle),
        firstString(item.product_title, item.title),
        firstString(metadata.artist, metadata.maker),
        firstString(metadata.art_form, metadata.artForm),
        firstString(metadata.dimensions),
      ]
    );
  }

  return listCertificatesForOrder(order.id);
}

export async function listCertificatesForOrder(orderId: string): Promise<Certificate[]> {
  if (!orderId) return [];
  await ensureCertificatesTable();
  const result = await queryResult<Certificate>(
    `SELECT id, code, order_id, order_item_id, handle, title, artist, art_form,
            dimensions, edition, issued_at, revoked_at
       FROM certificates WHERE order_id=$1
      ORDER BY id`,
    [orderId]
  );
  return result.rows;
}

export async function getCertificate(code: string): Promise<Certificate | null> {
  const normalised = String(code || "")
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "");
  if (normalised.length < 8) return null;
  await ensureCertificatesTable();
  const result = await queryResult<Certificate>(
    `SELECT id, code, order_id, order_item_id, handle, title, artist, art_form,
            dimensions, edition, issued_at, revoked_at
       FROM certificates WHERE code=$1`,
    [normalised]
  );
  return result.rows[0] ?? null;
}

/** Revocation is a record, not a deletion: a forged or returned certificate must stay auditable. */
export async function revokeCertificate(code: string): Promise<boolean> {
  await ensureCertificatesTable();
  const result = await queryResult(
    `UPDATE certificates SET revoked_at=NOW() WHERE code=$1 AND revoked_at IS NULL`,
    [code]
  );
  return (result.rowCount ?? 0) > 0;
}
