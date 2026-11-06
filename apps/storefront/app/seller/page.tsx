import Link from "next/link";
import { requireCustomer, getAuthToken } from "@/lib/auth";
import { applySellerAction } from "./actions";
import { Card, CardContent, CardHeader, CardTitle } from "@snehavrinda-kala/ui";
import { Badge } from "@snehavrinda-kala/ui";

export default async function SellerDashboardPage() {
  const customer = await requireCustomer();
  const application = (customer.metadata?.seller_application as any) ?? null;

  let commissions: any[] = [];
  const token = await getAuthToken();
  if (token && customer.id) {
    try {
      const result = await fetch(
        `${process.env.MEDUSA_BACKEND_URL || process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000"}/store/commissions?customer_id=${encodeURIComponent(customer.id)}`,
        {
          headers: {
            "x-publishable-api-key": process.env.MEDUSA_PUBLISHABLE_KEY || "",
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        }
      ).then((r) => (r.ok ? r.json() : { commission_requests: [] }));
      commissions = result.commission_requests ?? [];
    } catch (error) {
      console.error("Failed to load seller commissions", error);
    }
  }

  return (
    <main className="py-10">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <p className="text-sm font-medium text-madder uppercase tracking-wider">
          Creator studio
        </p>
        <h1 className="text-3xl md:text-4xl font-serif font-semibold text-deep-ink">
          Sell with SnehaVrinda Kala
        </h1>
        <p className="mt-2 max-w-2xl text-muted-ink font-sans">
          Apply, track your application, and manage the work you create for our
          customers.
        </p>

        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <Card elevated className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Application status</CardTitle>
            </CardHeader>
            <CardContent>
              {application ? (
                <div className="space-y-3">
                  <Badge
                    variant={
                      application.status === "approved"
                        ? "peacock"
                        : application.status === "rejected"
                        ? "sindoor"
                        : "haldi"
                    }
                  >
                    {application.status ?? "submitted"}
                  </Badge>
                  <p className="text-sm text-muted-ink font-sans">
                    {application.studio_name || "Your studio"}
                  </p>
                  <p className="text-xs text-muted-ink font-sans">
                    Submitted {application.submitted_at ? new Date(application.submitted_at).toLocaleDateString("en-IN") : "recently"}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-ink font-sans">
                  You have not submitted an application yet.
                </p>
              )}
            </CardContent>
          </Card>

          <Card elevated className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Apply as a creator</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={applySellerAction} className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label htmlFor="studio_name" className="block text-sm font-medium text-deep-ink mb-1">
                    Studio / artist name
                  </label>
                  <input
                    id="studio_name"
                    name="studio_name"
                    type="text"
                    required
                    defaultValue={application?.studio_name ?? ""}
                    className="w-full rounded-md border border-sand-border bg-surface px-3 py-2 text-sm text-deep-ink focus:outline-none focus:ring-2 focus:ring-sindoor"
                  />
                </div>
                <div>
                  <label htmlFor="disciplines" className="block text-sm font-medium text-deep-ink mb-1">
                    Disciplines
                  </label>
                  <input
                    id="disciplines"
                    name="disciplines"
                    type="text"
                    placeholder="Painting, ceramics, textile..."
                    defaultValue={application?.disciplines ?? ""}
                    className="w-full rounded-md border border-sand-border bg-surface px-3 py-2 text-sm text-deep-ink focus:outline-none focus:ring-2 focus:ring-sindoor"
                  />
                </div>
                <div>
                  <label htmlFor="capacity" className="block text-sm font-medium text-deep-ink mb-1">
                    Monthly capacity
                  </label>
                  <input
                    id="capacity"
                    name="capacity"
                    type="text"
                    placeholder="e.g. 10-15 pieces"
                    defaultValue={application?.capacity ?? ""}
                    className="w-full rounded-md border border-sand-border bg-surface px-3 py-2 text-sm text-deep-ink focus:outline-none focus:ring-2 focus:ring-sindoor"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="portfolio" className="block text-sm font-medium text-deep-ink mb-1">
                    Portfolio / Instagram / website
                  </label>
                  <input
                    id="portfolio"
                    name="portfolio"
                    type="url"
                    placeholder="https://"
                    defaultValue={application?.portfolio ?? ""}
                    className="w-full rounded-md border border-sand-border bg-surface px-3 py-2 text-sm text-deep-ink focus:outline-none focus:ring-2 focus:ring-sindoor"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="notes" className="block text-sm font-medium text-deep-ink mb-1">
                    Tell us about your practice
                  </label>
                  <textarea
                    id="notes"
                    name="notes"
                    rows={4}
                    defaultValue={application?.notes ?? ""}
                    className="w-full rounded-md border border-sand-border bg-surface px-3 py-2 text-sm text-deep-ink focus:outline-none focus:ring-2 focus:ring-sindoor"
                  />
                </div>
                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    className="py-3 px-6 bg-madder text-white rounded-md font-medium hover:bg-madder/90 transition-colors"
                  >
                    Submit application
                  </button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        <Card elevated className="mt-6">
          <CardHeader>
            <CardTitle>Your commission requests</CardTitle>
          </CardHeader>
          <CardContent>
            {commissions.length === 0 ? (
              <p className="text-muted-ink font-sans">
                Commission requests linked to your account will appear here.
              </p>
            ) : (
              <ul className="space-y-3">
                {commissions.map((request: any) => (
                  <li key={request.reference_id} className="border-b border-sand-border pb-3 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between gap-4">
                      <span className="font-medium text-deep-ink">{request.art_form}</span>
                      <Badge variant="outline">{request.status}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-ink font-sans line-clamp-2">
                      {request.brief}
                    </p>
                    <p className="mt-1 text-xs text-muted-ink font-sans">
                      {request.reference_id}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
