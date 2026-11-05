export default function ShippingPolicyPage() {
  return (
    <main className="py-10">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl md:text-4xl font-serif font-semibold text-ink mb-6">
          Shipping &amp; delivery
        </h1>
        <div className="space-y-6 text-muted font-sans leading-relaxed">
          <p>
            We ship across India through our fulfilment partner. Dispatch
            timelines depend on the product type:
          </p>
          <ul className="list-disc list-inside space-y-2">
            <li>
              <strong>Ready to ship:</strong> dispatched within 2–3 business
              days of order confirmation.
            </li>
            <li>
              <strong>Made to order:</strong> production lead time is shown on
              each product page before you order.
            </li>
            <li>
              <strong>Custom commissions:</strong> timeline is agreed in the
              quote and tracked through milestones.
            </li>
          </ul>
          <p>
            Tracking details are shared once the shipment is created. Fragile
            and oversized items use material-specific packaging and may require
            special handling.
          </p>
        </div>
      </div>
    </main>
  );
}
