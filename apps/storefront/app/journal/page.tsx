export default function JournalPage() {
  return (
    <main className="py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl md:text-4xl font-serif font-semibold text-ink mb-8">
          Journal
        </h1>
        <p className="mb-10 text-lg text-muted font-sans leading-relaxed">
          Artist stories, art-form explainers, technique tutorials, and
          collection edits from SnehaVrinda Kala.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Editorial articles from Sanity will render here once the CMS is connected. */}
        </div>
        <p className="mt-8 text-sm text-muted font-sans">
          Editorial content coming soon — connect Sanity CMS to publish and
          display articles.
        </p>
      </div>
    </main>
  );
}
