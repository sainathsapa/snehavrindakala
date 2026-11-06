/**
 * POST /api/store/tax/calculate - Calculate GST tax for an order
 */

import { NextResponse } from "next/server";

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

    // GST rates in India
    const GST_RATE = 0.18; // 18% standard rate
    const CGST_RATE = GST_RATE / 2; // 9% Central GST
    const SGST_RATE = GST_RATE / 2; // 9% State GST
    const IGST_RATE = GST_RATE; // 18% Integrated GST (inter-state)

    const amountNum = parseFloat(amount);
    const isInterState = state && state !== "MH"; // Example: if not Maharashtra, treat as inter-state

    let cgst = 0;
    let sgst = 0;
    let igst = 0;
    let totalTax = 0;

    if (isInterState) {
      igst = amountNum * IGST_RATE;
      totalTax = igst;
    } else {
      cgst = amountNum * CGST_RATE;
      sgst = amountNum * SGST_RATE;
      totalTax = cgst + sgst;
    }

    const total = amountNum + totalTax;

    return NextResponse.json({
      amount: amountNum,
      tax_rate: GST_RATE * 100,
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
