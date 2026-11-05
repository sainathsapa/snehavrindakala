export default function CustomArtPage() {
  return (
    <main className="py-10">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl md:text-4xl font-serif font-semibold text-ink mb-4">
          Request custom art
        </h1>
        <p className="mb-10 text-lg text-muted font-sans leading-relaxed">
          Commission a bespoke piece from one of our artists. Share your brief,
          upload references, and receive a versioned quote with milestones and
          proofs before production begins.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <section className="space-y-6">
            <h2 className="text-2xl font-serif font-semibold text-ink">
              How it works
            </h2>
            <ol className="space-y-4 text-muted font-sans leading-relaxed list-decimal list-inside">
              <li>
                <strong className="text-ink">Submit your brief</strong> — art
                form, medium, size, budget, target date, and reference files.
              </li>
              <li>
                <strong className="text-ink">Feasibility review</strong> — we
                review completeness, rights, schedule, and artist availability.
              </li>
              <li>
                <strong className="text-ink">Receive a quote</strong> — scope,
                deliverables, timeline, revisions, deposit, and expiry.
              </li>
              <li>
                <strong className="text-ink">Approve &amp; pay</strong> — accept
                the quote and pay the deposit through a secure order flow.
              </li>
              <li>
                <strong className="text-ink">Proofs &amp; delivery</strong> —
                review private proofs, request in-scope revisions, then receive
                the finished work.
              </li>
            </ol>
          </section>
          <section className="rounded-xl border border-border bg-surface p-8">
            <h2 className="text-2xl font-serif font-semibold text-ink mb-4">
              Start your request
            </h2>
            <form className="space-y-4" noValidate>
              <div>
                <label className="block text-sm font-medium text-ink mb-1">
                  Art form
                </label>
                <select
                  defaultValue=""
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-terracotta"
                >
                  <option value="">Select an art form</option>
                  <option>Painting &amp; drawing</option>
                  <option>Traditional &amp; folk art</option>
                  <option>Home &amp; décor</option>
                  <option>Textile &amp; fibre</option>
                  <option>Paper &amp; stationery</option>
                  <option>Wearable art</option>
                  <option>Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-ink mb-1">
                  Brief / description
                </label>
                <textarea
                  defaultValue=""
                  rows={4}
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-terracotta"
                  placeholder="Describe the piece you have in mind…"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-ink mb-1">
                    Budget range (₹)
                  </label>
                  <input
                    type="text"
                    defaultValue=""
                    className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-terracotta"
                    placeholder="e.g. 5,000 – 15,000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink mb-1">
                    Target date
                  </label>
                  <input
                    type="date"
                    defaultValue=""
                    className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-terracotta"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-ink mb-1">
                  Reference uploads (optional)
                </label>
                <input
                  type="file"
                  multiple
                  accept="image/*,application/pdf"
                  className="block w-full text-sm text-muted file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-terracotta file:text-white hover:file:bg-terracotta/90"
                />
                <p className="mt-1 text-xs text-muted">
                  Images or PDFs only. Files are stored privately and scanned.
                </p>
              </div>
              <button
                type="submit"
                className="w-full py-3 bg-terracotta text-white rounded-md font-medium hover:bg-terracotta/90 focus:outline-none focus:ring-2 focus:ring-terracotta focus:ring-offset-2 transition-colors"
              >
                Submit request
              </button>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}
