/**
 * POST /api/store/tax/calculate - Calculate GST/tax for an order
 * Uses the tax_rate and tax_included settings managed in the admin panel.
 */

import { NextResponse } from "next/server";

const DATABASE_URL =
  process.env.DATABASE_URL || "postgresql://medusa:medusa@localhost:5432/medusa";

async function getTaxSettings() {
  try {
    const { Pool } = require("pg");
    const pool = new Pool({ connectionString: DATABASE_URL });
    const client = await pool.connect();
    try {
      const res = await client.query(
        "SELECT key, value FROM site_settings WHERE key IN ('tax_rate', 'tax_included')"
      );
      const values: Record<string, string> = {};
      for (const row of res.rows) values[row.key] = row.value;
      return {
        rate: Math.max(0, Number(values.tax_rate ?? 0)),
        included: values.tax_included === "true",
      };
    } finally {
      client.release();
      pool.end();
    }
  } catch {
    // Settings table may not exist before the admin panel is used.
    return { rate: 0, included: false };
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { amount, state, customer_gst } = body;

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: "Valid amount required" },
        { status: 400 }
      );
    }

    const { rate, included } = await getTaxSettings();
    const rateFraction = rate / 100;

    const amountNum = parseFloat(String(amount));
    const isInterState = state && state !== "MH";

    // When prices include tax, back the tax out of the total.
    const taxableBase = included
      ? amountNum / (1 + rateFraction)
      : amountNum;
    const totalTax = included
      ? amountNum - taxableBase
      : amountNum * rateFraction;

    const cgst = isInterState ? 0 : totalTax / 2;
    const sgst = isInterState ? 0 : totalTax / 2;
    const igst = isInterState ? totalTax : 0;
    const total = included ? amountNum : amountNum + totalTax;

    return NextResponse.json({
      amount: amountNum,
      tax_rate: rate,
      tax_included: included,
      taxable_amount: Math.round(taxableBase * 100) / 100,
      cgst: Math.round(cgst * 100) / 100,
      sgst: Math.round(sgst * 100) / 100,
      igst: Math.round(igst * 100) / 100,
      total_tax: Math.round(totalTax * 100) / 100,
      total: Math.round(total * 100) / 100,
      is_inter_state: isInterState,
      customer_gst: customer_gst || null,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
