"use client";

import { useState } from "react";
import Link from "next/link";

export default function TaxPage() {
  const [amount, setAmount] = useState("");
  const [state, setState] = useState("MH");
  const [result, setResult] = useState<any>(null);
  const [calculating, setCalculating] = useState(false);

  async function calculate() {
    setCalculating(true);
    try {
      const res = await fetch("/api/store/tax/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: parseFloat(amount), state }),
      });
      if (res.ok) {
        const data = await res.json();
        setResult(data);
      }
    } catch {
      // ignore
    } finally {
      setCalculating(false);
    }
  }

  return (
    <main className="py-8">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-serif font-semibold text-deep-ink tracking-tight">
            Tax Calculator (GST)
          </h1>
          <p className="text-muted-ink font-sans">
            Calculate GST for Indian orders.
          </p>
        </div>

        <div className="rounded-xl border border-sand-border bg-surface p-6">
          <h2 className="text-lg font-serif font-semibold text-deep-ink mb-6">Tax Calculator</h2>
          <form onSubmit={(e) => { e.preventDefault(); calculate(); }} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-sans font-medium text-deep-ink">Amount (₹)</label>
              <input name="amount" type="number" value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 1000" required
                className="w-full px-3 py-2 rounded-md border border-sand-border bg-surface text-sm font-sans"/>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-sans font-medium text-deep-ink">State</label>
              <select name="state" value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-sand-border bg-surface text-sm font-sans">
                <option value="MH">Maharashtra</option>
                <option value="KA">Karnataka</option>
                <option value="TN">Tamil Nadu</option>
                <option value="DL">Delhi</option>
                <option value="WB">West Bengal</option>
                <option value="GJ">Gujarat</option>
                <option value="RJ">Rajasthan</option>
                <option value="UP">Uttar Pradesh</option>
                <option value="PB">Punjab</option>
                <option value="HR">Haryana</option>
              </select>
            </div>
            <button type="submit" disabled={calculating || !amount}
              className="px-6 py-2 bg-sindoor text-rang-paper rounded-md font-medium hover:bg-sindoor/90 transition-colors disabled:opacity-50">
              {calculating ? "Calculating…" : "Calculate Tax"}
            </button>
          </form>
        </div>

        {result && (
          <div className="mt-8 rounded-xl border border-sand-border bg-surface p-6">
            <h2 className="text-lg font-serif font-semibold text-deep-ink mb-4">Tax Breakdown</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="border border-sand-border rounded-lg p-4 bg-surface/50">
                <p className="text-xs font-sans font-medium text-muted-ink uppercase tracking-wider mb-2">Base Amount</p>
                <p className="text-lg font-serif font-bold text-deep-ink">₹{result.amount.toLocaleString()}</p>
              </div>
              <div className="border border-sand-border rounded-lg p-4 bg-surface/50">
                <p className="text-xs font-sans font-medium text-muted-ink uppercase tracking-wider mb-2">CGST (9%)</p>
                <p className="text-lg font-serif font-bold text-deep-ink">₹{result.cgst.toLocaleString()}</p>
              </div>
              <div className="border border-sand-border rounded-lg p-4 bg-surface/50">
                <p className="text-xs font-sans font-medium text-muted-ink uppercase tracking-wider mb-2">SGST (9%)</p>
                <p className="text-lg font-serif font-bold text-deep-ink">₹{result.sgst.toLocaleString()}</p>
              </div>
              <div className="border border-sand-border rounded-lg p-4 bg-surface/50">
                <p className="text-xs font-sans font-medium text-muted-ink uppercase tracking-wider mb-2">IGST (18%)</p>
                <p className="text-lg font-serif font-bold text-deep-ink">₹{result.igst.toLocaleString()}</p>
              </div>
              <div className="border border-sand-border rounded-lg p-4 bg-terracotta/10">
                <p className="text-xs font-sans font-medium text-terracotta uppercase tracking-wider mb-2">Total Tax</p>
                <p className="text-lg font-serif font-bold text-terracotta">₹{result.total_tax.toLocaleString()}</p>
              </div>
              <div className="border border-sindoor/20 rounded-lg p-4 bg-sindoor/5">
                <p className="text-xs font-sans font-medium text-sindoor uppercase tracking-wider mb-2">Grand Total</p>
                <p className="text-2xl font-serif font-bold text-sindoor">₹{result.total.toLocaleString()}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <span className="text-xs text-muted-ink font-sans">
                {result.is_inter_state ? "Inter-state sale (IGST applies)" : "Intra-state sale (CGST + SGST applies)"}
              </span>
              {result.customer_gst && (
                <span className="text-xs text-leaf font-sans border border-leaf/20 bg-leaf/5 px-2 py-0.5 rounded">
                  GST: {result.customer_gst}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}