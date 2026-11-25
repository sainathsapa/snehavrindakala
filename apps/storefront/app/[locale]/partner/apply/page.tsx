import type { Metadata } from "next";
import { Link } from "@/i18n/routing";
import { SectionHeading, Card, CardContent, Badge } from "@snehavrinda-kala/ui";
import { localeAlternates } from "@/lib/seo";
import ApplyForm from "./apply-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: "Apply as a partner — SnehaVrinda Kala",
    description:
      "Apply to become a marketplace partner with SnehaVrinda Kala. Tell us about your business, your practice, and the work you make.",
    alternates: localeAlternates("/partner/apply", locale),
  };
}

export default function PartnerApplyPage() {
  return (
    <main className="py-10">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          as="h1"
          eyebrow="For makers & studios"
          title="Apply to partner with us"
          description="We work with makers whose process, quality, and story deserve a wider audience. Tell us about your business and the work you create — our team reviews every application before anything goes live."
        />

        <div className="mt-8">
          <ApplyForm />
        </div>

        <div className="mt-8 rounded-xl border border-border bg-surface p-6">
          <Badge variant="peacock">What happens next</Badge>
          <ol className="mt-4 space-y-2 text-sm text-muted-ink font-sans">
            <li>1. We review your studio details, quality, and capacity.</li>
            <li>2. You receive an application reference you can use to check status.</li>
            <li>3. Approved partners set up their account and begin listing work.</li>
          </ol>
          <p className="mt-4 text-sm text-muted-ink font-sans">
            Already applied?{" "}
            <Link
              href="/partner/status"
              className="text-sindoor underline underline-offset-2 hover:text-sindoor/80"
            >
              Check your application status
            </Link>
            .
          </p>
        </div>
      </div>
    </main>
  );
}
