import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentCustomer, getAuthToken } from "@/lib/auth";
import { medusa, formatPrice } from "@/lib/medusa";
import { logoutAction } from "./actions";
import { Card, CardContent, CardHeader, CardTitle } from "@snehavrinda-kala/ui";
import { Badge } from "@snehavrinda-kala/ui";

export default async function AccountPage() {
  const customer = await getCurrentCustomer();
  if (!customer) {
    redirect("/account/login");
  }

  const token = await getAuthToken();
  let orders: any[] = [];
  if (token) {
    try {
      const result = await medusa.listCustomerOrders(token, { limit: 20 });
      orders = result.orders ?? [];
    } catch (error) {
      console.error("Failed to load orders", error);
    }
  }

  return (
    <main className="py-10">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-8">
          <div>
            <p className="text-sm font-medium text-sindoor uppercase tracking-wider">
              Your account
            </p>
            <h1 className="text-3xl md:text-4xl font-serif font-semibold text-deep-ink">
              {customer.first_name || customer.email}
            </h1>
            <p className="mt-1 text-muted-ink font-sans">{customer.email}</p>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="text-sm text-muted-ink hover:text-sindoor transition-colors"
            >
              Sign out
            </button>
          </form>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card elevated className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Profile</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3 text-sm font-sans">
                <div>
                  <dt className="text-muted-ink">Name</dt>
                  <dd className="text-deep-ink">
                    {[customer.first_name, customer.last_name].filter(Boolean).join(" ") || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-ink">Email</dt>
                  <dd className="text-deep-ink">{customer.email}</dd>
                </div>
                <div>
                  <dt className="text-muted-ink">Phone</dt>
                  <dd className="text-deep-ink">{customer.phone || "—"}</dd>
                </div>
              </dl>
              <div className="mt-6">
                <Link href="/custom-art" className="text-sm text-sindoor underline">
                  Request custom art
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card elevated className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Recent orders</CardTitle>
            </CardHeader>
            <CardContent>
              {orders.length === 0 ? (
                <p className="text-muted-ink font-sans">
                  Your order history will appear here once you place an order.
                </p>
              ) : (
                <ul className="space-y-4">
                  {orders.map((order: any) => (
                    <li
                      key={order.id}
                      className="flex flex-col gap-2 border-b border-sand-border pb-4 last:border-0 last:pb-0"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <span className="font-medium text-deep-ink">{order.display_id ?? order.id}</span>
                        <Badge variant="outline">{order.status ?? "processing"}</Badge>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-ink font-sans">
                        <span>
                          {order.items?.length ?? 0} item
                          {(order.items?.length ?? 0) === 1 ? "" : "s"}
                        </span>
                        <span>{formatPrice(order.total, order.currency_code)}</span>
                        <div className="flex items-center gap-3">
                          <Link
                            href={`/order/${order.id}`}
                            className="text-xs font-medium text-sindoor hover:underline"
                          >
                            View order
                          </Link>
                          <Link
                            href={`/account/returns?order_id=${order.id}`}
                            className="rounded-md border border-sand-border px-3 py-1 text-xs font-medium text-sindoor hover:bg-sindoor/10 transition-colors"
                          >
                            Request return
                          </Link>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
