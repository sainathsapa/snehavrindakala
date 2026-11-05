export default function AccountPage() {
  return (
    <main className="py-10">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl md:text-4xl font-serif font-semibold text-ink mb-8">
          Your account
        </h1>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <aside className="lg:col-span-1 space-y-6">
            <nav>
              <h2 className="text-sm font-semibold text-ink uppercase tracking-wider mb-4">
                Account
              </h2>
              <ul className="space-y-1 text-sm text-muted font-sans">
                <li>
                  <a href="#" className="block px-3 py-2 rounded-md bg-terracotta/10 text-terracotta">
                    Orders
                  </a>
                </li>
                <li>
                  <a href="#" className="block px-3 py-2 rounded-md text-muted hover:bg-paper hover:text-terracotta">
                    Addresses
                  </a>
                </li>
                <li>
                  <a href="#" className="block px-3 py-2 rounded-md text-muted hover:bg-paper hover:text-terracotta">
                    Commission requests
                  </a>
                </li>
                <li>
                  <a href="#" className="block px-3 py-2 rounded-md text-muted hover:bg-paper hover:text-terracotta">
                    Preferences
                  </a>
                </li>
              </ul>
            </nav>
          </aside>
          <div className="lg:col-span-3 rounded-xl border border-border bg-surface p-8">
            <h2 className="text-xl font-serif font-semibold text-ink mb-6">
              Orders
            </h2>
            <p className="text-muted font-sans">
              Your order history will appear here once you place an order.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
