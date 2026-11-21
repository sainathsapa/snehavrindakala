/**
 * A certificate of authenticity, and its proof.
 *
 * The same page serves the buyer (who opens it from their order) and anyone
 * checking a printed copy: it states the work, the maker and the issue date,
 * and says plainly whether the reference resolves. It never shows the buyer's
 * name, address or what they paid — a certificate that leaked those would be a
 * privacy problem sold as a feature.
 *
 * Deliberately not a generated PDF. A PDF needs an embedded Devanagari font and
 * a renderer, and the browser already has both: the page is laid out for paper
 * and `Print` produces the file. The code is what carries the proof, not the
 * file format.
 */

import { Link } from "@/i18n/routing";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCertificate, formatCertificateCode } from "@/lib/certificates";
import { PrintButton } from "@/components/print-button";

// Absolute, because the verification line is read off paper and typed into a
// browser; a relative URL on a printed page is not a link.
const SITE_ORIGIN = (
  process.env.NEXT_PUBLIC_STOREFRONT_URL || "http://localhost:3000"
).replace(/\/$/, "");

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return {
    title: `Certificate ${formatCertificateCode(code.toUpperCase())}`,
    robots: { index: false, follow: false },
  };
}

function when(value: string, locale: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(locale === "hi" ? "hi-IN" : "en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function VerifyPage({
  params,
}: {
  params: Promise<{ locale: string; code: string }>;
}) {
  const { locale, code } = await params;
  if (!code || code.length > 40) notFound();

  const t = await getTranslations("certificate");
  const certificate = await getCertificate(code).catch(() => null);

  if (!certificate) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-20 sm:px-8">
        <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.28em] text-terracotta">
          {t("eyebrow")}
        </p>
        <h1 className="mt-3 font-serif text-3xl text-deep-ink">{t("notFoundTitle")}</h1>
        <p className="mt-3 font-sans text-sm leading-relaxed text-muted-ink">
          {t("notFoundBody", { code: formatCertificateCode(code.toUpperCase()) })}
        </p>
        <Link
          href="/authenticity"
          className="mt-6 inline-block font-sans text-sm text-sindoor hover:underline"
        >
          {t("howWeCertify")} →
        </Link>
      </main>
    );
  }

  const revoked = Boolean(certificate.revoked_at);
  const verifyUrl = `${SITE_ORIGIN}/verify/${certificate.code}`;

  return (
    <main className="mx-auto max-w-3xl px-5 py-16 sm:px-8 print:py-0">
      <div className="border border-sand-border bg-surface/40 p-6 sm:p-10 print:border-0 print:bg-white">
        <div className="flex items-start justify-between gap-6">
          <div>
            <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.3em] text-terracotta">
              {t("eyebrow")}
            </p>
            <h1 className="mt-2 font-serif text-3xl text-deep-ink">
              {t("title")}
            </h1>
          </div>
          <PrintButton label={t("print")} />
        </div>

        <dl className="mt-8 grid gap-4 border-t border-sand-border pt-6 sm:grid-cols-2">
          <div>
            <dt className="font-sans text-[10px] uppercase tracking-[0.22em] text-muted-ink/70">
              {t("work")}
            </dt>
            <dd className="mt-1 font-serif text-lg text-deep-ink">
              {certificate.title || t("untitled")}
            </dd>
          </div>
          <div>
            <dt className="font-sans text-[10px] uppercase tracking-[0.22em] text-muted-ink/70">
              {t("maker")}
            </dt>
            <dd className="mt-1 font-sans text-sm text-deep-ink">
              {certificate.artist || t("makerUnrecorded")}
            </dd>
          </div>
          {certificate.art_form && (
            <div>
              <dt className="font-sans text-[10px] uppercase tracking-[0.22em] text-muted-ink/70">
                {t("tradition")}
              </dt>
              <dd className="mt-1 font-sans text-sm text-deep-ink">{certificate.art_form}</dd>
            </div>
          )}
          {certificate.dimensions && (
            <div>
              <dt className="font-sans text-[10px] uppercase tracking-[0.22em] text-muted-ink/70">
                {t("dimensions")}
              </dt>
              <dd className="mt-1 font-sans text-sm text-deep-ink">{certificate.dimensions}</dd>
            </div>
          )}
          <div>
            <dt className="font-sans text-[10px] uppercase tracking-[0.22em] text-muted-ink/70">
              {t("edition")}
            </dt>
            <dd className="mt-1 font-sans text-sm text-deep-ink">{certificate.edition}</dd>
          </div>
          <div>
            <dt className="font-sans text-[10px] uppercase tracking-[0.22em] text-muted-ink/70">
              {t("issued")}
            </dt>
            <dd className="mt-1 font-sans text-sm text-deep-ink">
              {when(certificate.issued_at, locale)}
            </dd>
          </div>
        </dl>

        <div
          className={`mt-8 border-t border-sand-border pt-6 print:border-t`}
          role="status"
        >
          <p className="font-sans text-[10px] uppercase tracking-[0.22em] text-muted-ink/70">
            {t("reference")}
          </p>
          <p className="mt-1 font-mono text-base tracking-[0.14em] text-deep-ink">
            {formatCertificateCode(certificate.code)}
          </p>
          <p
            className={`mt-3 font-sans text-sm leading-relaxed ${
              revoked ? "text-[#8a2c14]" : "text-deep-ink"
            }`}
          >
            {revoked ? t("revoked") : t("verified")}
          </p>
          <p className="mt-2 break-all font-sans text-xs text-muted-ink">{verifyUrl}</p>
        </div>

        <p className="mt-8 border-t border-sand-border pt-6 font-sans text-xs leading-relaxed text-muted-ink print:mt-6">
          {t("footnote")}
        </p>
      </div>

      <div className="mt-6 print:hidden">
        <Link
          href={certificate.handle ? `/products/${certificate.handle}` : "/shop"}
          className="font-sans text-sm text-sindoor hover:underline"
        >
          {certificate.handle ? t("viewWork") : t("browseWork")} →
        </Link>
      </div>
    </main>
  );
}
