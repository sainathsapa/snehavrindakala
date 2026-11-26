"use client";

/**
 * Slug handling for every admin form that has one.
 *
 * The rule is the same everywhere — products, journal posts, art forms,
 * categories, partner pages:
 *
 *   · the address follows the title until a person edits it
 *   · after that it is theirs, and the title stops overwriting it
 *   · an existing record keeps the slug it already has, even if empty
 *
 * Keeping it in one hook means the behaviour cannot drift between six forms,
 * which is what had happened: two of them filled the slug, four left a person to
 * type a URL by hand.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { slugify, isValidSlug } from "@/lib/slug";

export function useAutoSlug(initial = "") {
  const [value, setValue] = useState(initial);
  // A record that already has an address counts as touched: it is live, and
  // regenerating it from the title would break inbound links.
  const [touched, setTouched] = useState(Boolean(initial));
  const lastAuto = useRef(initial);

  /** Call from the title field. No-op once the slug has been edited. */
  const fromTitle = useCallback(
    (title: string) => {
      if (touched) return;
      const next = slugify(title);
      lastAuto.current = next;
      setValue(next);
    },
    [touched]
  );

  const onChange = useCallback((next: string) => {
    setTouched(true);
    // Keep what is typed, but tidy it: pasting a title into the field should
    // still produce a usable address rather than a line with spaces in it.
    setValue(next === "" ? next : slugify(next));
  }, []);

  /** Clear the field and let the title take over again. */
  const reset = useCallback((title: string) => {
    setTouched(false);
    setValue(slugify(title));
  }, []);

  return {
    value,
    setValue,
    onChange,
    fromTitle,
    reset,
    touched,
    /** True when the field holds something a URL can use. */
    valid: isValidSlug(value),
    hint: touched
      ? "Your address. Changing it after the page is live breaks existing links."
      : "Filled from the title. Edit it and it stops following.",
  };
}

/**
 * The input itself, so the six forms look identical.
 *
 * The hint is not decoration: a slug is the one field in this admin where a
 * later correction silently breaks links people have already shared.
 */
export function SlugField({
  label = "Slug",
  slug,
  title,
  required = true,
  disabled = false,
  prefix,
}: {
  label?: string;
  slug: ReturnType<typeof useAutoSlug>;
  title?: string;
  required?: boolean;
  disabled?: boolean;
  prefix?: string;
}) {
  // Keep the address in step when the title changes and nobody has touched it.
  useEffect(() => {
    if (title !== undefined) slug.fromTitle(title);
  }, [title, slug]);

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <label className="block font-sans text-sm font-medium text-deep-ink" htmlFor="slug">
          {label}
        </label>
        {slug.touched && (
          <button
            type="button"
            onClick={() => title !== undefined && slug.reset(title)}
            className="font-sans text-[11px] text-sindoor underline-offset-2 hover:underline"
          >
            Use the title again
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        {prefix && (
          <span className="shrink-0 font-mono text-xs text-muted-ink/70">{prefix}</span>
        )}
        <input
          id="slug"
          type="text"
          name="slug"
          value={slug.value}
          onChange={(event) => slug.onChange(event.target.value)}
          required={required}
          disabled={disabled}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className={`w-full rounded-md border bg-surface px-3 py-2 font-mono text-sm text-deep-ink focus:outline-none focus:ring-2 focus:ring-sindoor ${
            slug.value && !slug.valid ? "border-terracotta" : "border-sand-border"
          }`}
        />
      </div>

      <p
        className={`mt-1 font-sans text-[11px] ${
          slug.value && !slug.valid ? "text-terracotta" : "text-muted-ink"
        }`}
      >
        {slug.value && !slug.valid
          ? "Only lowercase letters, numbers and single hyphens."
          : slug.value
            ? slug.hint
            : "A title in a non-Latin script needs an address typed here."}
      </p>
    </div>
  );
}
