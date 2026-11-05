export default function ReturnsPolicyPage() {
  return (
    <main className="py-10">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl md:text-4xl font-serif font-semibold text-ink mb-6">
          Returns &amp; refunds
        </h1>
        <div className="space-y-6 text-muted font-sans leading-relaxed">
          <p>
            Return conditions vary by product type because some work is made
            especially for you:
          </p>
          <ul className="list-disc list-inside space-y-2">
            <li>
              <strong>Ready to ship:</strong> eligible for return within 7 days
              of delivery if unused and in original condition.
            </li>
            <li>
              <strong>Made to order and personalized:</strong> not eligible for
              return unless damaged, incorrect, or not as described, since it
              is produced for your order.
            </li>
            <li>
              <strong>Custom commissions:</strong> governed by the milestone
              agreement in your quote. Deposits are non-refundable once work
              begins unless the artist is unable to proceed.
            </li>
            <li>
              <strong>Damaged or incorrect goods:</strong> contact us with
              photos within 48 hours of delivery for a replacement or refund.
            </li>
          </ul>
          <p>
            Refunds are processed to the original payment method after the
            return is received and inspected.
          </p>
        </div>
      </div>
    </main>
  );
}
