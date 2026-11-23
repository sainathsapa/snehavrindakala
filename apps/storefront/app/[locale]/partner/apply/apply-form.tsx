"use client";

import { useState, type FormEvent } from "react";
import { Link } from "@/i18n/routing";
import { Card, CardContent, Badge } from "@snehavrinda-kala/ui";

/**
 * The public status lookup is owned by the onboarding workstream. Keeping the
 * path in one place means it can be repointed in a single edit if the final
 * route differs.
 */
const STATUS_PAGE_PATH = "/partner/status";

const PRODUCT_CATEGORY_OPTIONS = [
  "Painting & fine art",
  "Ceramics & pottery",
  "Textiles & fibre",
  "Jewellery",
  "Wood & bamboo",
  "Home & decor",
  "Paper & stationery",
  "Mixed media",
  "Other",
];

const INPUT_CLASS =
  "w-full rounded-md border border-sand-border bg-surface px-3 py-2 text-sm text-deep-ink placeholder:text-muted-ink focus:outline-none focus:ring-2 focus:ring-sindoor";

type FieldErrors = Record<string, string>;

interface FormState {
  legal_name: string;
  display_name: string;
  contact_email: string;
  contact_phone: string;
  description: string;
  business_type: string;
  years_in_business: string;
  website: string;
  studio_name: string;
  practice: string;
  story: string;
  portfolio_url: string;
  number_of_makers: string;
  document_keys: string;
}

const INITIAL_FORM: FormState = {
  legal_name: "",
  display_name: "",
  contact_email: "",
  contact_phone: "",
  description: "",
  business_type: "",
  years_in_business: "",
  website: "",
  studio_name: "",
  practice: "",
  story: "",
  portfolio_url: "",
  number_of_makers: "",
  document_keys: "",
};

export default function ApplyForm() {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [categories, setCategories] = useState<string[]>([]);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submission, setSubmission] = useState<{ id: string; status: string } | null>(null);

  function update(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function toggleCategory(category: string) {
    setCategories((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]
    );
  }

  function errorFor(field: string) {
    return errors[field] ? (
      <p className="mt-1 text-xs text-sindoor font-sans" role="alert">
        {errors[field]}
      </p>
    ) : null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setServerError(null);
    setErrors({});

    const payload = {
      legal_name: form.legal_name.trim(),
      display_name: form.display_name.trim(),
      contact_email: form.contact_email.trim(),
      contact_phone: form.contact_phone.trim(),
      business_details: {
        description: form.description.trim(),
        business_type: form.business_type.trim(),
        years_in_business: form.years_in_business.trim(),
        website: form.website.trim(),
      },
      artist_information: {
        studio_name: form.studio_name.trim(),
        practice: form.practice.trim(),
        story: form.story.trim(),
        portfolio_url: form.portfolio_url.trim(),
        number_of_makers: form.number_of_makers.trim(),
      },
      product_categories: categories,
      document_keys: form.document_keys
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    };

    try {
      const response = await fetch("/api/store/partner-applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (data && typeof data.errors === "object" && data.errors !== null) {
          setErrors(data.errors as FieldErrors);
        }
        setServerError(
          data?.error || "We could not submit your application. Please try again."
        );
        return;
      }

      setSubmission({ id: data.id, status: data.status });
    } catch {
      setServerError("We could not reach the server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submission) {
    return (
      <Card elevated>
        <CardContent className="p-8">
          <Badge variant="peacock">Application received</Badge>
          <h2 className="mt-4 font-serif text-2xl font-semibold text-deep-ink">
            Thank you for applying
          </h2>
          <p className="mt-2 text-sm text-muted-ink font-sans">
            Our team will review your details. Keep the reference below — you can
            use it to check the progress of your application at any time.
          </p>
          <dl className="mt-6 grid gap-4 rounded-lg border border-sand-border bg-surface p-5 sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-ink font-sans">
                Application reference
              </dt>
              <dd className="mt-1 font-mono text-sm text-deep-ink">{submission.id}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-ink font-sans">
                Status
              </dt>
              <dd className="mt-1 text-sm capitalize text-deep-ink font-sans">
                {submission.status}
              </dd>
            </div>
          </dl>
          <Link
            href={`${STATUS_PAGE_PATH}?application=${encodeURIComponent(submission.id)}`}
            className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-sindoor text-white rounded-md font-medium hover:bg-sindoor/90 transition-colors"
          >
            Check application status
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card elevated>
      <CardContent className="p-6 sm:p-8">
        <form onSubmit={handleSubmit} noValidate className="grid gap-8">
          <fieldset className="grid gap-4">
            <legend className="font-serif text-xl font-semibold text-deep-ink">
              1. Business details
            </legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="legal_name" className="block text-sm font-medium text-deep-ink mb-1">
                  Legal name <span className="text-sindoor">*</span>
                </label>
                <input
                  id="legal_name"
                  value={form.legal_name}
                  onChange={(e) => update("legal_name", e.target.value)}
                  aria-invalid={Boolean(errors.legal_name)}
                  className={INPUT_CLASS}
                  placeholder="Registered business or entity name"
                />
                {errorFor("legal_name")}
              </div>
              <div>
                <label htmlFor="display_name" className="block text-sm font-medium text-deep-ink mb-1">
                  Display name <span className="text-sindoor">*</span>
                </label>
                <input
                  id="display_name"
                  value={form.display_name}
                  onChange={(e) => update("display_name", e.target.value)}
                  aria-invalid={Boolean(errors.display_name)}
                  className={INPUT_CLASS}
                  placeholder="Name shown to customers"
                />
                {errorFor("display_name")}
              </div>
              <div>
                <label htmlFor="contact_email" className="block text-sm font-medium text-deep-ink mb-1">
                  Contact email <span className="text-sindoor">*</span>
                </label>
                <input
                  id="contact_email"
                  type="email"
                  value={form.contact_email}
                  onChange={(e) => update("contact_email", e.target.value)}
                  aria-invalid={Boolean(errors.contact_email)}
                  className={INPUT_CLASS}
                  placeholder="you@example.com"
                />
                {errorFor("contact_email")}
              </div>
              <div>
                <label htmlFor="contact_phone" className="block text-sm font-medium text-deep-ink mb-1">
                  Contact phone
                </label>
                <input
                  id="contact_phone"
                  type="tel"
                  value={form.contact_phone}
                  onChange={(e) => update("contact_phone", e.target.value)}
                  aria-invalid={Boolean(errors.contact_phone)}
                  className={INPUT_CLASS}
                  placeholder="+91 ..."
                />
                {errorFor("contact_phone")}
              </div>
              <div>
                <label htmlFor="business_type" className="block text-sm font-medium text-deep-ink mb-1">
                  Business type
                </label>
                <input
                  id="business_type"
                  value={form.business_type}
                  onChange={(e) => update("business_type", e.target.value)}
                  className={INPUT_CLASS}
                  placeholder="Sole proprietor, studio, partnership..."
                />
              </div>
              <div>
                <label htmlFor="years_in_business" className="block text-sm font-medium text-deep-ink mb-1">
                  Years in business
                </label>
                <input
                  id="years_in_business"
                  value={form.years_in_business}
                  onChange={(e) => update("years_in_business", e.target.value)}
                  className={INPUT_CLASS}
                  placeholder="e.g. 4"
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="website" className="block text-sm font-medium text-deep-ink mb-1">
                  Website
                </label>
                <input
                  id="website"
                  type="url"
                  value={form.website}
                  onChange={(e) => update("website", e.target.value)}
                  className={INPUT_CLASS}
                  placeholder="https://"
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="description" className="block text-sm font-medium text-deep-ink mb-1">
                  About your business
                </label>
                <textarea
                  id="description"
                  rows={4}
                  value={form.description}
                  onChange={(e) => update("description", e.target.value)}
                  aria-invalid={Boolean(errors.business_details)}
                  className={INPUT_CLASS}
                  placeholder="What do you make, and how do you work?"
                />
                {errorFor("business_details")}
              </div>
            </div>
          </fieldset>

          <fieldset className="grid gap-4">
            <legend className="font-serif text-xl font-semibold text-deep-ink">
              2. Artist / maker information
            </legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="studio_name" className="block text-sm font-medium text-deep-ink mb-1">
                  Studio or artist name
                </label>
                <input
                  id="studio_name"
                  value={form.studio_name}
                  onChange={(e) => update("studio_name", e.target.value)}
                  className={INPUT_CLASS}
                />
                {errorFor("artist_information")}
              </div>
              <div>
                <label htmlFor="practice" className="block text-sm font-medium text-deep-ink mb-1">
                  Practice / discipline
                </label>
                <input
                  id="practice"
                  value={form.practice}
                  onChange={(e) => update("practice", e.target.value)}
                  className={INPUT_CLASS}
                  placeholder="e.g. hand-built ceramics"
                />
              </div>
              <div>
                <label htmlFor="portfolio_url" className="block text-sm font-medium text-deep-ink mb-1">
                  Portfolio URL
                </label>
                <input
                  id="portfolio_url"
                  type="url"
                  value={form.portfolio_url}
                  onChange={(e) => update("portfolio_url", e.target.value)}
                  className={INPUT_CLASS}
                  placeholder="https://"
                />
              </div>
              <div>
                <label htmlFor="number_of_makers" className="block text-sm font-medium text-deep-ink mb-1">
                  Number of makers
                </label>
                <input
                  id="number_of_makers"
                  value={form.number_of_makers}
                  onChange={(e) => update("number_of_makers", e.target.value)}
                  className={INPUT_CLASS}
                  placeholder="e.g. 1-3"
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="story" className="block text-sm font-medium text-deep-ink mb-1">
                  Your story
                </label>
                <textarea
                  id="story"
                  rows={4}
                  value={form.story}
                  onChange={(e) => update("story", e.target.value)}
                  className={INPUT_CLASS}
                  placeholder="Tell us about the people and process behind the work."
                />
              </div>
            </div>
          </fieldset>

          <fieldset className="grid gap-3">
            <legend className="font-serif text-xl font-semibold text-deep-ink">
              3. Product categories <span className="text-sindoor">*</span>
            </legend>
            <p className="text-sm text-muted-ink font-sans">
              Select all that describe what you make.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {PRODUCT_CATEGORY_OPTIONS.map((category) => (
                <label
                  key={category}
                  className="flex items-center gap-2 text-sm text-deep-ink font-sans"
                >
                  <input
                    type="checkbox"
                    checked={categories.includes(category)}
                    onChange={() => toggleCategory(category)}
                    className="h-4 w-4 rounded border-sand-border text-sindoor focus:ring-sindoor"
                  />
                  {category}
                </label>
              ))}
            </div>
            {errorFor("product_categories")}
          </fieldset>

          <fieldset className="grid gap-4">
            <legend className="font-serif text-xl font-semibold text-deep-ink">
              4. Document references
            </legend>
            <p className="text-sm text-muted-ink font-sans">
              Provide comma-separated references or links to portfolios,
              registration certificates, or other supporting material.
            </p>
            <div>
              <label htmlFor="document_keys" className="block text-sm font-medium text-deep-ink mb-1">
                References
              </label>
              <input
                id="document_keys"
                value={form.document_keys}
                onChange={(e) => update("document_keys", e.target.value)}
                aria-invalid={Boolean(errors.document_keys)}
                className={INPUT_CLASS}
                placeholder="doc_abc123, https://..."
              />
              {errorFor("document_keys")}
            </div>
          </fieldset>

          {serverError ? (
            <p className="rounded-md border border-sindoor/30 bg-sindoor/5 px-4 py-3 text-sm text-sindoor font-sans" role="alert">
              {serverError}
            </p>
          ) : null}

          <div>
            <button
              type="submit"
              disabled={submitting}
              className="py-3 px-6 bg-madder text-white rounded-md font-medium hover:bg-madder/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? "Submitting…" : "Submit application"}
            </button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
