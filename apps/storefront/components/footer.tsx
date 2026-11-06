export function Footer() {
  return (
    <footer className="mt-auto border-t border-border bg-surface">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          <div className="col-span-2 md:col-span-1">
            <span className="text-xl font-serif font-bold text-ink tracking-tight">
              SnehaVrinda Kala
            </span>
            <p className="mt-4 max-w-xs text-sm text-muted font-sans leading-relaxed">
              Art made, curated, personalized, and shared by creators.
            </p>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-ink uppercase tracking-wider mb-4">
              Shop
            </h4>
            <ul className="space-y-2 text-sm text-muted font-sans">
              <li><a href="/shop" className="hover:text-terracotta transition-colors">All products</a></li>
              <li><a href="/art-forms" className="hover:text-terracotta transition-colors">Art forms</a></li>
              <li><a href="/custom-art" className="hover:text-terracotta transition-colors">Custom art</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-ink uppercase tracking-wider mb-4">
              Learn
            </h4>
            <ul className="space-y-2 text-sm text-muted font-sans">
              <li><a href="/journal" className="hover:text-terracotta transition-colors">Journal</a></li>
              <li><a href="/artists" className="hover:text-terracotta transition-colors">Artists</a></li>
              <li><a href="/about" className="hover:text-terracotta transition-colors">About</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-ink uppercase tracking-wider mb-4">
              Policies
            </h4>
            <ul className="space-y-2 text-sm text-muted font-sans">
              <li><a href="/policies/shipping" className="hover:text-terracotta transition-colors">Shipping</a></li>
              <li><a href="/policies/returns" className="hover:text-terracotta transition-colors">Returns &amp; refunds</a></li>
              <li><a href="/policies/privacy" className="hover:text-terracotta transition-colors">Privacy</a></li>
              <li><a href="/policies/terms" className="hover:text-terracotta transition-colors">Terms</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-border pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-muted font-sans">
            SnehaVrinda Kala. All rights reserved.
          </p>
          <div className="flex items-center gap-6 text-xs text-muted font-sans">
            <a href="mailto:hello@snehavrindakala.example" className="hover:text-terracotta transition-colors">Contact</a>
            <a href="/about" className="hover:text-terracotta transition-colors">Partner with us</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
