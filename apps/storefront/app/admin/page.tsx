"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function AdminPage() {
  return (
    <main className="py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-serif font-semibold text-deep-ink tracking-tight">
          Admin Dashboard
        </h1>
        <p className="text-muted-ink font-sans">
          Welcome to the SnehaVrinda Kala admin panel.
        </p>
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-6 rounded-xl border border-sand-border bg-surface">
            <p className="text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
              Total Orders
            </p>
            <p className="text-2xl font-serif font-semibold text-deep-ink mt-2">0</p>
          </div>
          <div className="p-6 rounded-xl border border-sand-border bg-surface">
            <p className="text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
              Total Products
            </p>
            <p className="text-2xl font-serif font-semibold text-deep-ink mt-2">0</p>
          </div>
          <div className="p-6 rounded-xl border border-sand-border bg-surface">
            <p className="text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
              Total Customers
            </p>
            <p className="text-2xl font-serif font-semibold text-deep-ink mt-2">0</p>
          </div>
          <div className="p-6 rounded-xl border border-sand-border bg-surface">
            <p className="text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
              Total Artists
            </p>
            <p className="text-2xl font-serif font-semibold text-deep-ink mt-2">0</p>
          </div>
        </div>
      </div>
    </main>
  );
}