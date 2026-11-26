"use client";

/**
 * Product photographs — several of them.
 *
 * A painting is not one picture: the front, a detail of the brushwork, the back
 * with the signature, the work in a room for scale. The admin form took a single
 * image (written to `thumbnail`) and the storefront gallery, which was built for
 * many, therefore only ever had one to show.
 *
 * The first image in the list is the card image. Up, down and "make main" are
 * here because the order is what the gallery follows, and a wrong first picture
 * is the whole first impression.
 */

import { useRef, useState } from "react";

export interface ProductImage {
  url: string;
  id?: string;
}

export function ProductImages({
  images,
  onChange,
  max = 8,
  disabled = false,
}: {
  images: ProductImage[];
  onChange: (next: ProductImage[]) => void;
  max?: number;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  async function upload(files: FileList | File[]) {
    if (disabled) return;
    const room = max - images.length;
    if (room <= 0) {
      setError(`That is the maximum of ${max} photographs.`);
      return;
    }

    setBusy(true);
    setError(null);
    const next: ProductImage[] = [...images];

    for (const file of Array.from(files).slice(0, room)) {
      const typeOk = ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type);
      if (!typeOk) {
        setError("Only JPEG, PNG, WebP or GIF can be uploaded.");
        continue;
      }
      if (file.size > 8 * 1024 * 1024) {
        setError(`"${file.name}" is over 8 MB.`);
        continue;
      }

      const form = new FormData();
      form.append("file", file);
      try {
        const res = await fetch("/api/admin/upload", { method: "POST", body: form });
        const body = await res.json().catch(() => ({}));
        if (!res.ok || !body.url) {
          setError(body.error || `"${file.name}" could not be uploaded.`);
          continue;
        }
        next.push({ url: body.url });
      } catch {
        setError(`"${file.name}" could not be uploaded.`);
      }
    }

    if (next.length !== images.length) onChange(next);
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= images.length) return;
    const next = [...images];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  function makeMain(index: number) {
    if (index === 0) return;
    const next = [...images];
    const [picked] = next.splice(index, 1);
    next.unshift(picked);
    onChange(next);
  }

  function remove(index: number) {
    onChange(images.filter((_, position) => position !== index));
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-sans text-xs uppercase tracking-[0.14em] text-muted-ink">
          Photographs
        </span>
        <span className="font-sans text-[11px] text-muted-ink">
          {images.length} of {max} · the first is the card image
        </span>
      </div>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {images.map((image, index) => (
          <li
            key={`${image.url}-${index}`}
            className="group relative overflow-hidden rounded-lg border border-sand-border bg-white"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image.url}
              alt=""
              className="aspect-square w-full object-cover"
              loading="lazy"
            />

            {index === 0 && (
              <span className="absolute left-2 top-2 rounded-full bg-deep-ink/85 px-2 py-0.5 font-sans text-[9px] uppercase tracking-[0.14em] text-rang-paper">
                Card image
              </span>
            )}

            <div className="flex items-center justify-between gap-1 border-t border-sand-border/70 px-1.5 py-1">
              <div className="flex gap-0.5">
                <button
                  type="button"
                  onClick={() => move(index, -1)}
                  disabled={index === 0 || disabled}
                  aria-label="Move earlier"
                  className="grid h-8 w-8 place-items-center rounded text-muted-ink hover:bg-sand-border/30 disabled:opacity-30"
                >
                  ←
                </button>
                <button
                  type="button"
                  onClick={() => move(index, 1)}
                  disabled={index === images.length - 1 || disabled}
                  aria-label="Move later"
                  className="grid h-8 w-8 place-items-center rounded text-muted-ink hover:bg-sand-border/30 disabled:opacity-30"
                >
                  →
                </button>
              </div>
              <div className="flex gap-0.5">
                <button
                  type="button"
                  onClick={() => makeMain(index)}
                  disabled={index === 0 || disabled}
                  aria-label="Make card image"
                  className="grid h-8 w-8 place-items-center rounded text-xs text-sindoor hover:bg-sindoor/10 disabled:opacity-30"
                >
                  ★
                </button>
                <button
                  type="button"
                  onClick={() => remove(index)}
                  disabled={disabled}
                  aria-label="Remove photograph"
                  className="grid h-8 w-8 place-items-center rounded text-terracotta hover:bg-terracotta/10 disabled:opacity-30"
                >
                  ×
                </button>
              </div>
            </div>
          </li>
        ))}

        {images.length < max && (
          <li>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragOver={(event) => {
                event.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragOver(false);
                if (event.dataTransfer.files?.length) upload(event.dataTransfer.files);
              }}
              disabled={disabled || busy}
              className={`flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed px-2 text-center transition-colors ${
                dragOver
                  ? "border-sindoor bg-sindoor/5"
                  : "border-sand-border hover:border-sindoor/60"
              } disabled:opacity-60`}
            >
              <span className="font-serif text-2xl text-sindoor">{busy ? "…" : "+"}</span>
              <span className="font-sans text-[11px] leading-tight text-muted-ink">
                {busy ? "Uploading" : "Add photograph"}
              </span>
            </button>
          </li>
        )}
      </ul>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        hidden
        onChange={(event) => {
          if (event.target.files?.length) upload(event.target.files);
        }}
      />

      {error && (
        <p role="alert" className="font-sans text-sm text-terracotta">
          {error}
        </p>
      )}
    </div>
  );
}
