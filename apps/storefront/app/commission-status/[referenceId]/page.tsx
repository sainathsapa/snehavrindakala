import { medusa } from "@/lib/medusa";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function CommissionStatusPage({
  params,
}: {
  params: Promise<{ referenceId: string }>;
}) {
  const { referenceId } = await params;
  let commission: any = null;
  try {
    const { commission_request } = await medusa.getCommissionRequest(
      referenceId
    );
    commission = commission_request;
  } catch (err) {
    notFound();
  }

  if (!commission) {
    notFound();
  }

  const statusLabels: Record<string, string> = {
    New: "New request",
    "Needs clarification": "Needs clarification",
    "Feasibility review": "Feasibility review",
    "Awaiting artist/capacity": "Awaiting artist & capacity",
    "Quote drafted": "Quote drafted",
    "Quote sent": "Quote sent",
    "Awaiting payment": "Awaiting payment",
    Accepted: "Quote accepted",
    "In production": "In production",
    "Proof review": "Proof review",
    Approved: "Approved",
    "Ready to dispatch": "Ready to dispatch",
    Shipped: "Shipped",
    Completed: "Completed",
    Declined: "Declined",
    Cancelled: "Cancelled",
    "On hold": "On hold",
    Expired: "Expired",
    "Refund pending": "Refund pending",
    Refunded: "Refunded",
    Disputed: "Disputed",
  };

  return (
    <main className="py-10">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <nav className="mb-8 text-sm text-muted font-sans">
          <Link href="/" className="hover:text-terracotta transition-colors">
            ← Back home
          </Link>
        </nav>

        <h1 className="text-3xl md:text-4xl font-serif font-semibold text-ink mb-6">
          Commission status
        </h1>

        <div className="rounded-xl border border-border bg-surface p-8">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-xl font-serif font-semibold text-ink">
                {commission.art_form} Commission
              </h2>
              <p className="text-sm text-muted font-sans">
                Reference: {commission.reference_id}
              </p>
            </div>
            <span className="px-3 py-1 rounded-full bg-terracotta/10 text-terracotta text-xs font-medium border border-terracotta/20">
              {statusLabels[commission.status] || commission.status}
            </span>
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-ink uppercase tracking-wider mb-3">
                Brief
              </h3>
              <p className="text-muted font-sans leading-relaxed">
                {commission.brief}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-6 text-sm text-muted font-sans">
              <div>
                <p className="text-xs font-medium text-terracotta uppercase">
                  Art form
                </p>
                <p className="text-ink">{commission.art_form}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-terracotta uppercase">
                  Target date
                </p>
                <p className="text-ink">
                  {commission.target_date || "Not specified"}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-terracotta uppercase">
                  Delivery region
                </p>
                <p className="text-ink">
                  {commission.delivery_region || "Not specified"}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-terracotta uppercase">
                  Status
                </p>
                <p className="text-ink">{commission.status}</p>
              </div>
            </div>

            <div className="mt-8 pt-8 border-t border-border">
              <h3 className="text-lg font-serif font-semibold text-ink mb-4">
                What happens next
              </h3>
              <p className="text-muted font-sans leading-relaxed mb-6">
                Our team will review your request and get back to you with a
                quote. You can track the status here at any time using your
                reference ID.
              </p>

              <div className="flex items-center gap-3 text-sm text-muted font-sans">
                <p className="flex items-center gap-2">
                  <span>✓</span> Request received
                </p>
                {commission.status !== "New" && (
                  <p className="flex items-center gap-2">
                    <span>✓</span> Under review
                  </p>
                )}
                {commission.status === "Quote sent" || commission.status === "Awaiting payment" || ["Accepted","In production","Proof review","Approved","Ready to dispatch","Shipped","Completed"].includes(commission.status) && (
                  <p className="flex items-center gap-2">
                    <span>✓</span> Quote sent
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
