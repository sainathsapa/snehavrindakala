import { requireAdmin } from "@/app/admin/actions";
import { listAllHeroSlides, listAllArtForms, listAllFeaturedCategories } from "@/lib/site-content";
import {
  saveHeroSlideAction,
  deleteHeroSlideAction,
  saveArtFormAction,
  deleteArtFormAction,
  saveFeaturedCategoryAction,
  deleteFeaturedCategoryAction,
  reorderContentAction,
} from "@/app/admin/actions";
import { Icon } from "@snehavrinda-kala/ui";
import { ImageFieldInput } from "./image-field-input";

export const dynamic = "force-dynamic";

/**
 * Storefront content editor.
 *
 * The hero slides, art forms and featured categories are editorial, not derived
 * from the catalogue — so they are edited here and nowhere else. Changes
 * revalidate the public pages immediately.
 */
export default async function AdminContentPage() {
  if (!(await requireAdmin())) {
    return (
      <div className="p-8">
        <p className="font-sans text-muted-ink">Please sign in to edit content.</p>
      </div>
    );
  }

  const [slides, artForms, categories] = await Promise.all([
    listAllHeroSlides(),
    listAllArtForms(),
    listAllFeaturedCategories(),
  ]);

  return (
    <div className="mx-auto max-w-5xl p-6 lg:p-8">
      <header className="mb-8">
        <h1 className="font-serif text-3xl font-semibold text-deep-ink">
          Storefront content
        </h1>
        <p className="mt-2 max-w-2xl font-sans text-sm text-muted-ink">
          Everything on the homepage that is curated rather than generated —
          hero slides, the art-form row and featured categories. Saved changes
          appear on the storefront immediately.
        </p>
      </header>

      {/* ── Hero slides ─────────────────────────────────────────────────── */}
      <Section
        title="Hero slides"
        hint="The first slide is what visitors see on the homepage."
        count={slides.length}
      >
        {slides.map((slide, index) => (
          <Row
            key={slide.id}
            table="site_hero_slide"
            id={slide.id}
            index={index}
            total={slides.length}
            published={slide.published}
          >
            <form action={saveHeroSlideAction} className="grid gap-3">
              <input type="hidden" name="id" value={slide.id} />
              <Field label="Eyebrow" name="eyebrow" value={slide.eyebrow} />
              <Field label="Title" name="title" value={slide.title} required />
              <Field label="Tagline" name="tagline" value={slide.tagline} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Button label" name="cta_label" value={slide.cta_label} />
                <Field label="Button link" name="cta_href" value={slide.cta_href} />
              </div>
              <ImageField label="Image" name="image" value={slide.image} />
              <div className="flex flex-wrap items-center gap-4">
                <Toggle name="published" checked={slide.published} />
                <SaveButton />
              </div>
            </form>
          </Row>
        ))}

        <form action={saveHeroSlideAction} className="grid gap-3 rounded-lg border border-dashed border-sand-border p-4">
          <p className="font-sans text-xs font-semibold uppercase tracking-wider text-terracotta">
            Add a slide
          </p>
          <Field label="Eyebrow" name="eyebrow" value="" />
          <Field label="Title" name="title" value="" required />
          <Field label="Tagline" name="tagline" value="" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Button label" name="cta_label" value="" />
            <Field label="Button link" name="cta_href" value="/shop" />
          </div>
          <ImageField label="Image" name="image" value="/images/hero/hero-art.jpg" />
          <div className="flex flex-wrap items-center gap-4">
            <Toggle name="published" checked />
            <SaveButton label="Add slide" />
          </div>
        </form>
      </Section>

      {/* ── Art forms ───────────────────────────────────────────────────── */}
      <Section
        title="Art forms"
        hint="Shown in the homepage row and on /art-forms. The slug is the URL."
        count={artForms.length}
      >
        {artForms.map((form, index) => (
          <Row
            key={form.id}
            table="site_art_form"
            id={form.id}
            index={index}
            total={artForms.length}
            published={form.published}
          >
            <form action={saveArtFormAction} className="grid gap-3">
              <input type="hidden" name="id" value={form.id} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Name" name="name" value={form.name} required />
                <Field label="Slug" name="slug" value={form.slug} required />
              </div>
              <Field label="Description" name="description" value={form.description} />
              <ImageField label="Image" name="image" value={form.image} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Origin" name="origin" value={form.origin ?? ""} />
                <Field label="Materials" name="materials" value={form.materials ?? ""} />
              </div>
              <Field label="Pull quote" name="quote" value={form.quote ?? ""} />
              <TextArea
                label="The story"
                name="story"
                value={form.story ?? ""}
                rows={10}
                hint="Shown on /art-forms/{slug}. Blank line separates paragraphs; **double asterisks** make bold. Plain text only."
              />
              <div className="flex flex-wrap items-center gap-4">
                <Toggle name="published" checked={form.published} />
                <SaveButton />
                <a
                  href={`/art-forms/${form.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-sans text-[11px] uppercase tracking-wider text-terracotta underline-offset-2 hover:underline"
                >
                  View page
                </a>
              </div>
            </form>
          </Row>
        ))}

        <form action={saveArtFormAction} className="grid gap-3 rounded-lg border border-dashed border-sand-border p-4">
          <p className="font-sans text-xs font-semibold uppercase tracking-wider text-terracotta">
            Add an art form
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name" name="name" value="" required />
            <Field label="Slug" name="slug" value="" required />
          </div>
          <Field label="Description" name="description" value="" />
          <ImageField label="Image" name="image" value="/images/artforms/painting.jpg" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Origin" name="origin" value="" />
            <Field label="Materials" name="materials" value="" />
          </div>
          <Field label="Pull quote" name="quote" value="" />
          <TextArea
            label="The story"
            name="story"
            value=""
            rows={10}
            hint="Blank line separates paragraphs; **double asterisks** make bold."
          />
          <div className="flex flex-wrap items-center gap-4">
            <Toggle name="published" checked />
            <SaveButton label="Add art form" />
          </div>
        </form>
      </Section>

      {/* ── Featured categories ─────────────────────────────────────────── */}
      <Section
        title="Featured categories"
        hint="The 'Discover' menu and featured row. Link to a collection path."
        count={categories.length}
      >
        {categories.map((category, index) => (
          <Row
            key={category.id}
            table="site_featured_category"
            id={category.id}
            index={index}
            total={categories.length}
            published={category.published}
          >
            <form action={saveFeaturedCategoryAction} className="grid gap-3">
              <input type="hidden" name="id" value={category.id} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Label" name="label" value={category.label} required />
                <Field label="Link" name="href" value={category.href} required />
              </div>
              <ImageField label="Image" name="image" value={category.image} />
              <div className="flex flex-wrap items-center gap-4">
                <Toggle name="published" checked={category.published} />
                <SaveButton />
              </div>
            </form>
          </Row>
        ))}

        <form action={saveFeaturedCategoryAction} className="grid gap-3 rounded-lg border border-dashed border-sand-border p-4">
          <p className="font-sans text-xs font-semibold uppercase tracking-wider text-terracotta">
            Add a featured category
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Label" name="label" value="" required />
            <Field label="Link" name="href" value="/shop" required />
          </div>
          <ImageField label="Image" name="image" value="" />
          <div className="flex flex-wrap items-center gap-4">
            <Toggle name="published" checked />
            <SaveButton label="Add category" />
          </div>
        </form>
      </Section>
    </div>
  );
}

function Section({
  title,
  hint,
  count,
  children,
}: {
  title: string;
  hint: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-12">
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <h2 className="font-serif text-xl font-semibold text-deep-ink">{title}</h2>
        <span className="font-sans text-xs text-muted-ink">{count} item{count === 1 ? "" : "s"}</span>
      </div>
      <p className="mb-4 font-sans text-xs text-muted-ink">{hint}</p>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Row({
  table,
  id,
  index,
  total,
  published,
  children,
}: {
  table: string;
  id: number;
  index: number;
  total: number;
  published: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-sand-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="font-sans text-xs text-muted-ink">
          #{index + 1} {published ? "" : "· hidden"}
        </span>
        <div className="flex items-center gap-1">
          <OrderButton table={table} id={id} direction="up" disabled={index === 0} />
          <OrderButton
            table={table}
            id={id}
            direction="down"
            disabled={index === total - 1}
          />
          <form action={deleteActionFor(table)}>
            <input type="hidden" name="id" value={id} />
            <button
              type="submit"
              className="ml-2 rounded-md px-2 py-1 font-sans text-xs text-sindoor hover:bg-sindoor/10"
            >
              Delete
            </button>
          </form>
        </div>
      </div>
      {children}
    </div>
  );
}

function deleteActionFor(table: string) {
  if (table === "site_hero_slide") return deleteHeroSlideAction;
  if (table === "site_art_form") return deleteArtFormAction;
  return deleteFeaturedCategoryAction;
}

function OrderButton({
  table,
  id,
  direction,
  disabled,
}: {
  table: string;
  id: number;
  direction: "up" | "down";
  disabled: boolean;
}) {
  return (
    <form action={reorderContentAction}>
      <input type="hidden" name="table" value={table} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="direction" value={direction} />
      <button
        type="submit"
        disabled={disabled}
        aria-label={`Move ${direction}`}
        className="rounded-md border border-sand-border px-2 py-1 font-sans text-xs text-muted-ink transition-colors hover:border-kumkum hover:text-kumkum disabled:opacity-30"
      >
        {direction === "up" ? "↑" : "↓"}
      </button>
    </form>
  );
}

/**
 * An image field: upload or drag an image, with the URL kept in a hidden input
 * so the surrounding server action still receives it as `name`.
 *
 * These fields were plain text boxes reading "Image path" — an editor had to
 * know that /images/artforms/painting.jpg existed and spell it correctly. The
 * upload endpoint had been in the codebase the whole time, unused.
 */
function ImageField({
  label,
  name,
  value,
  required,
}: {
  label: string;
  name: string;
  value: string;
  required?: boolean;
}) {
  return (
    <div>
      <span className="mb-1 block font-sans text-[11px] font-medium uppercase tracking-wider text-muted-ink">
        {label}
      </span>
      <ImageFieldInput name={name} value={value} required={required} />
    </div>
  );
}

function Field({
  label,
  name,
  value,
  required,
}: {
  label: string;
  name: string;
  value: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block font-sans text-[11px] font-medium uppercase tracking-wider text-muted-ink">
        {label}
      </span>
      <input
        name={name}
        defaultValue={value}
        required={required}
        className="w-full rounded-md border border-sand-border bg-rang-paper/40 px-3 py-2 font-sans text-sm text-deep-ink focus:outline-none focus:ring-1 focus:ring-kumkum/40"
      />
    </label>
  );
}

/**
 * Long-form text. Art-form stories run to paragraphs, so they get a real
 * textarea rather than a one-line input.
 */
function TextArea({
  label,
  name,
  value,
  rows = 4,
  hint,
}: {
  label: string;
  name: string;
  value: string;
  rows?: number;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block font-sans text-[11px] font-medium uppercase tracking-wider text-muted-ink">
        {label}
      </span>
      <textarea
        name={name}
        defaultValue={value}
        rows={rows}
        className="w-full resize-y rounded-md border border-sand-border bg-rang-paper/40 px-3 py-2 font-sans text-sm leading-relaxed text-deep-ink focus:outline-none focus:ring-1 focus:ring-kumkum/40"
      />
      {hint && (
        <span className="mt-1 block font-sans text-[11px] text-muted-ink/70">{hint}</span>
      )}
    </label>
  );
}

function Toggle({ name, checked }: { name: string; checked: boolean }) {
  return (
    <label className="flex items-center gap-2 font-sans text-xs text-muted-ink">
      <input
        type="checkbox"
        name={name}
        defaultChecked={checked}
        className="rounded border-sand-border text-kumkum focus:ring-kumkum"
      />
      Visible on storefront
    </label>
  );
}

function SaveButton({ label = "Save" }: { label?: string }) {
  return (
    <button
      type="submit"
      className="inline-flex items-center gap-1.5 rounded-full bg-kumkum px-4 py-1.5 font-sans text-xs font-medium text-rang-paper transition-colors hover:bg-sindoor"
    >
      <Icon name="save" size={13} />
      {label}
    </button>
  );
}
