import { getOrder, updateOrderStatus } from "../../actions";
import { hasPermission } from "@/lib/rbac";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Order Details | SnehaVrinda Kala Admin",
  robots: { index: false, follow: false },
};

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userRole = "super_admin";

  if (!hasPermission(userRole as any, "orders:read")) {
    redirect("/admin?error=unauthorized");
  }

  let order: any = null;
  try {
    const res = await getOrder(id);
    order = res.order;
  } catch {
    notFound();
  }

  if (!order) notFound();

  const handleStatusChange = async (formData: FormData) => {
    "use server";
    const newStatus = formData.get("status") as string;
    await updateOrderStatus(id, { status: newStatus });
    redirect(`/admin/orders/${id}?updated=1`);
  };

  return (
    <main className="py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <Link
            href="/admin/orders"
            className="inline-flex items-center gap-2 text-sindoor font-sans font-medium hover:underline mb-4"
          >
            ← Back to Orders
          </Link>
          <h1 className="text-3xl font-serif font-semibold text-deep-ink tracking-tight">
            Order #{order.id.slice(-8)}
          </h1>
          <p className="text-muted-ink font-sans">
            Order placed on{" "}
            {new Date(order.created_at).toLocaleDateString()}
          </p>
        </div>

        {typeof window === "undefined" && false}

        {/* Order summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatCard title="Order Total" value={(order.total / 100).toFixed(2)} currency={order.currency_code} />
          <StatCard title="Payment Status" value={order.payment_status} />
          <StatCard title="Fulfillment" value={order.fulfillment_status} />
        </div>

        {/* Customer info */}
        <div className="rounded-xl border border-sand-border bg-surface p-6 mb-8">
          <h2 className="text-lg font-serif font-semibold text-deep-ink mb-4">
            Customer Details
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">Name</p>
              <p className="text-sm font-sans text-deep-ink">
                {order.customer?.first_name} {order.customer?.last_name}
              </p>
            </div>
            <div>
              <p className="text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">Email</p>
              <p className="text-sm font-sans text-deep-ink">
                {order.customer?.email}
              </p>
            </div>
            <div>
              <p className="text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">Customer ID</p>
              <p className="text-sm font-sans text-deep-ink">
                {order.customer?.id}
              </p>
            </div>
          </div>
        </div>

        {/* Status update form */}
        {hasPermission(userRole as any, "orders:write") && (
          <div className="rounded-xl border border-sand-border bg-surface p-6 mb-8">
            <form action={handleStatusChange} className="space-y-4">
              <h2 className="text-lg font-serif font-semibold text-deep-ink mb-4">
                Update Order Status
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <select
                  name="status"
                  className="px-3 py-2 rounded-md border border-sand-border bg-surface text-sm font-sans"
                  defaultValue={order.status}
                >
                  <option value="pending">Pending</option>
                  <option value="processing">Processing</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="refunded">Refunded</option>
                </select>
                <button
                  type="submit"
                  className="px-4 py-2 bg-sindoor text-rang-paper rounded-md font-medium hover:bg-sindoor/90 transition-colors"
                >
                  Update Status
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Order items */}
        <div className="rounded-xl border border-sand-border bg-surface overflow-hidden">
          <div className="border-b border-sand-border bg-rang-paper p-6">
            <h2 className="text-lg font-serif font-semibold text-deep-ink">
              Order Items ({order.items?.length || 0})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left divide-y divide-sand-border">
              <thead>
                <tr className="bg-surface">
                  <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">Product</th>
                  <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider text-right">Unit Price</th>
                  <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider text-right">Qty</th>
                  <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand-border">
                {(order.items || []).map((item: any) => (
                  <tr key={item.id} className="hover:bg-rang-paper/50">
                    <td className="px-6 py-4 font-sans text-sm text-deep-ink">
                      {item.title || item.product_title}
                    </td>
                    <td className="px-6 py-4 font-sans text-sm text-deep-ink text-right">
                      {(item.unit_price / 100).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 font-sans text-sm text-deep-ink text-right">
                      {item.quantity}
                    </td>
                    <td className="px-6 py-4 font-sans text-sm text-deep-ink text-right">
                      {((item.unit_price || 0) * item.quantity / 100).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}

function StatCard({ title, value, currency }: { title: string; value: string | number; currency?: string }) {
  return (
    <div className="rounded-xl border border-sand-border bg-surface p-6">
      <p className="text-xs font-sans font-medium text-muted-ink uppercase tracking-wider mb-2">{title}</p>
      <p className="text-2xl font-serif font-bold text-deep-ink">
        {currency ? currency.toUpperCase() + " " : ""}{value}
      </p>
    </div>
  );
}
