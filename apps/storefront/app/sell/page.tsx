import Link from "next/link";
import { SectionHeading, Card, CardContent } from "@snehavrinda-kala/ui";
import { Badge } from "@snehavrinda-kala/ui";

export default function SellPage() {
  return (
    <main className="py-10">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="For creators"
          title="Make art with us, reach collectors who care"
          description="SnehaVrinda Kala is a curated home for handmade, made-to-order, and commissioned work. We partner with makers whose process, quality, and story deserve a wider audience."
        />

        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              title: "Curated visibility",
              body: "Your work is presented with artist attribution, process stories, and collection context.",
            },
            {
              title: "Fair terms",
              body: "Clear review, pricing, lead-time, and payout records before anything goes live.",
            },
            {
              title: "Commission flow",
              body: "High-intent custom requests are triaged, quoted, and tracked end to end.",
            },
          ].map((item) => (
            <Card key={item.title} elevated>
              <CardContent className="p-6">
                <Badge variant="peacock">Creator benefit</Badge>
                <h3 className="mt-4 font-serif text-xl font-semibold text-deep-ink">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm text-muted-ink font-sans">{item.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-10 rounded-xl border border-border bg-surface p-8">
          <h2 className="text-2xl font-serif font-semibold text-deep-ink">
            How it works
          </h2>
          <ol className="mt-4 grid gap-4 md:grid-cols-4 text-sm text-muted-ink font-sans">
            <li>1. Submit your studio profile and portfolio.</li>
            <li>2. Our team reviews quality, capacity, and fit.</li>
            <li>3. Approved creators list products and receive commissions.</li>
            <li>4. Orders, proofs, and payouts are tracked transparently.</li>
          </ol>
          <div className="mt-8">
            <Link
              href="/seller"
              className="inline-flex items-center gap-2 px-6 py-3 bg-sindoor text-white rounded-md font-medium hover:bg-sindoor/90 transition-colors"
            >
              Start your application
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
