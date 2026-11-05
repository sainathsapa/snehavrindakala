export default function CartPage() {
  return (
    <main className="py-10">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl md:text-4xl font-serif font-semibold text-ink mb-8">
          Your cart
        </h1>
        <div className="rounded-xl border border-border bg-surface p-8">
          <p className="text-muted font-sans">
            Your cart is empty. Explore the catalogue and add items to get
            started.
          </p>
          <div className="mt-8">
            <a
              href="/shop"
              className="inline-flex items-center gap-2 text-sm font-medium text-terracotta hover:underline"
            >
              Browse products →
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
