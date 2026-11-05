export default function ShopPage() {
  return (
    <main className="py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl md:text-4xl font-serif font-semibold text-ink mb-8">
          All products
        </h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Products will be rendered here from Medusa once the backend is connected. */}
        </div>
        <p className="mt-8 text-sm text-muted font-sans">
          Product catalogue coming soon — connect the Medusa backend to render
          live catalogue data.
        </p>
      </div>
    </main>
  );
}
