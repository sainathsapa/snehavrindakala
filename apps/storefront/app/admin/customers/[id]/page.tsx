"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

interface Customer {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  has_account: boolean;
  created_at: string;
  updated_at: string;
}

interface Order {
  id: string;
  status: string;
  fulfillment_status: string;
  payment_status: string;
  total: number;
  currency_code: string;
  created_at: string;
}

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : "";
  const [customer, setCustomer] = useState<any>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (id) {
      loadCustomer(id);
      loadCustomerOrders(id);
    }
  }, [id]);

  async function loadCustomer(customerId: string) {
    try {
      const res = await fetch(
        `/api/admin/customers/${customerId}`,
        { cache: "no-store" }
      );
      if (res.ok) {
        const data = await res.json();
        const value = data.customer || data;
        setCustomer(value);
        setEditForm({
          first_name: value.first_name || "",
          last_name: value.last_name || "",
          email: value.email || "",
          phone: value.phone || "",
        });
      }
    } catch (err) {
      console.error("Failed to load customer", err);
    }
  }

  async function loadCustomerOrders(customerId: string) {
    try {
      const res = await fetch(
        `/api/admin/orders?limit=50&offset=0`,
        { cache: "no-store" }
      );
      if (res.ok) {
        const data = await res.json();
        const customerOrders = (data.orders || []).filter(
          (o: any) => o.customer?.id === customerId
        );
        setOrders(customerOrders);
      }
    } catch (err) {
      console.error("Failed to load customer orders", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const res = await fetch(`/api/admin/customers/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update customer");
      const value = data.customer || data;
      setCustomer(value);
      setEditing(false);
      setMessage("Customer updated.");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (
      !confirm(
        `Delete customer ${customer.email}? Their orders will remain in the system.`
      )
    )
      return;
    setDeleting(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/customers/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete customer");
      router.push("/admin/customers");
    } catch (err: any) {
      setError(err.message);
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <main className="py-8">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <p className="text-muted-ink font-sans">Loading customer...</p>
        </div>
      </main>
    );
  }

  if (!customer) {
    return (
      <main className="py-8">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <p className="text-muted-ink font-sans">Customer not found.</p>
        </div>
      </main>
    );
  }

  const totalSpent = orders
    .filter((o) => o.payment_status === "paid")
    .reduce((sum, o) => sum + o.total, 0);

  return (
    <main className="py-8">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <Link
            href="/admin/customers"
            className="inline-flex items-center gap-2 text-sindoor font-sans font-medium hover:underline mb-4"
          >
            ← Back to Customers
          </Link>
          <h1 className="text-3xl font-serif font-semibold text-deep-ink tracking-tight">
            Customer Details
          </h1>
          <p className="text-muted-ink font-sans">
            Profile and order history for{" "}
            {`${customer.first_name || ""} ${customer.last_name || ""}`.trim() ||
              customer.email}
          </p>
        </div>

        {message && (
          <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-4 py-3 font-sans text-sm text-green-700">
            {message}
          </div>
        )}
        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 font-sans text-sm text-red-700">
            {error}
          </div>
        )}

        {editing && (
          <form
            onSubmit={handleSave}
            className="rounded-xl border border-sand-border bg-surface p-6 mb-8"
          >
            <h2 className="text-lg font-serif font-semibold text-deep-ink mb-4">
              Edit Customer
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block">
                <span className="mb-1 block text-xs font-sans font-medium uppercase tracking-wider text-muted-ink">
                  First name
                </span>
                <input
                  value={editForm.first_name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, first_name: e.target.value })
                  }
                  className="w-full rounded-md border border-sand-border bg-white px-3 py-2 font-sans text-sm text-deep-ink"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-sans font-medium uppercase tracking-wider text-muted-ink">
                  Last name
                </span>
                <input
                  value={editForm.last_name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, last_name: e.target.value })
                  }
                  className="w-full rounded-md border border-sand-border bg-white px-3 py-2 font-sans text-sm text-deep-ink"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-sans font-medium uppercase tracking-wider text-muted-ink">
                  Email *
                </span>
                <input
                  required
                  type="email"
                  value={editForm.email}
                  onChange={(e) =>
                    setEditForm({ ...editForm, email: e.target.value })
                  }
                  className="w-full rounded-md border border-sand-border bg-white px-3 py-2 font-sans text-sm text-deep-ink"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-sans font-medium uppercase tracking-wider text-muted-ink">
                  Phone
                </span>
                <input
                  value={editForm.phone}
                  onChange={(e) =>
                    setEditForm({ ...editForm, phone: e.target.value })
                  }
                  className="w-full rounded-md border border-sand-border bg-white px-3 py-2 font-sans text-sm text-deep-ink"
                />
              </label>
            </div>
            <div className="mt-5 flex items-center gap-3">
              <button
                type="submit"
                disabled={saving}
                className="rounded-md bg-sindoor px-4 py-2 text-sm font-sans font-medium text-white hover:bg-sindoor/90 transition-colors disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-md border border-sand-border px-4 py-2 text-sm font-sans font-medium text-deep-ink hover:bg-rang-paper transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Customer info */}
        <div className="rounded-xl border border-sand-border bg-surface p-6 mb-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-serif font-semibold text-deep-ink">
              Profile
            </h2>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setEditing((v) => !v)}
                className="text-sindoor font-sans text-sm font-medium hover:underline"
              >
                {editing ? "Close editor" : "Edit"}
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="text-red-600 font-sans text-sm font-medium hover:underline disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">Name</p>
              <p className="text-lg font-serif font-semibold text-deep-ink">
                {customer.first_name} {customer.last_name}
              </p>
            </div>
            <div>
              <p className="text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">Email</p>
              <p className="text-lg font-serif font-semibold text-deep-ink">
                {customer.email}
              </p>
            </div>
            <div>
              <p className="text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">Phone</p>
              <p className="text-lg font-serif font-semibold text-deep-ink">
                {customer.phone || "Not provided"}
              </p>
            </div>
            <div>
              <p className="text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">Account</p>
              <span
                className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium font-sans ${
                  customer.has_account
                    ? "bg-leaf/10 text-leaf border border-leaf/20"
                    : "bg-muted-ink/10 text-muted-ink border border-muted-ink/20"
                }`}
              >
                {customer.has_account ? "Registered" : "Guest"}
              </span>
            </div>
            <div>
              <p className="text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">Customer ID</p>
              <p className="text-lg font-serif font-semibold text-deep-ink">
                {customer.id.slice(-8)}
              </p>
            </div>
            <div>
              <p className="text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">Joined</p>
              <p className="text-lg font-serif font-semibold text-deep-ink">
                {new Date(customer.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>

        {/* Customer stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="rounded-xl border border-sand-border bg-surface p-6 text-center">
            <p className="text-xs font-sans font-medium text-muted-ink uppercase tracking-wider mb-2">Total Orders</p>
            <p className="text-2xl font-serif font-bold text-deep-ink">{orders.length}</p>
          </div>
          <div className="rounded-xl border border-sand-border bg-surface p-6 text-center">
            <p className="text-xs font-sans font-medium text-muted-ink uppercase tracking-wider mb-2">Total Spent</p>
            <p className="text-2xl font-serif font-bold text-deep-ink">
              ₹{(totalSpent / 100).toLocaleString()}
            </p>
          </div>
          <div className="rounded-xl border border-sand-border bg-surface p-6 text-center">
            <p className="text-xs font-sans font-medium text-muted-ink uppercase tracking-wider mb-2">Avg Order Value</p>
            <p className="text-2xl font-serif font-bold text-deep-ink">
              {orders.length > 0 ? `₹${(totalSpent / orders.length / 100).toFixed(2)}` : "₹0"}
            </p>
          </div>
        </div>

        {/* Order history */}
        <div className="rounded-xl border border-sand-border bg-surface overflow-hidden">
          <div className="border-b border-sand-border bg-rang-paper p-6">
            <h2 className="text-lg font-serif font-semibold text-deep-ink">
              Order History ({orders.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left divide-y divide-sand-border">
              <thead>
                <tr className="bg-surface">
                  <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">Order</th>
                  <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">Payment</th>
                  <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider text-right">Total</th>
                  <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand-border">
                {orders.length > 0 ? (
                  orders.map((order: Order) => (
                    <tr key={order.id} className="hover:bg-rang-paper/50">
                      <td className="px-6 py-4 font-sans text-sm text-deep-ink">
                        #{order.id.slice(-8)}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium font-sans ${
                            order.status === "completed"
                              ? "bg-leaf/10 text-leaf border border-leaf/20"
                              : order.status === "cancelled"
                                ? "bg-sindoor/10 text-sindoor border border-sindoor/20"
                                : order.status === "pending"
                                  ? "bg-terracotta/10 text-terracotta border border-terracotta/20"
                                  : "bg-muted-ink/10 text-muted-ink border border-muted-ink/20"
                          }`}
                        >
                          {order.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`font-sans text-sm ${
                            order.payment_status === "paid"
                              ? "text-leaf"
                              : order.payment_status === "refunded"
                                ? "text-sindoor"
                                : "text-muted-ink"
                          } font-medium`}
                        >
                          {order.payment_status}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-sans text-sm text-deep-ink text-right">
                        {(order.total / 100).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 font-sans text-sm text-muted-ink">
                        {new Date(order.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <p className="text-muted-ink font-sans">No orders yet.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}
