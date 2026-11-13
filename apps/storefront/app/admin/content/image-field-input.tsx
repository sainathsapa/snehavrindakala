"use client";

import { useState } from "react";
import { ImageUpload } from "@/components/image-upload";

/**
 * Binds the image uploader to a server-action form.
 *
 * The chosen URL lives in React state and is mirrored into a hidden input, so
 * the surrounding `<form action={serverAction}>` still receives it by name.
 * Without this the uploader is purely cosmetic: it would show a preview while
 * submitting nothing.
 */
export function ImageFieldInput({
  name,
  value,
  required,
}: {
  name: string;
  value: string;
  required?: boolean;
}) {
  const [url, setUrl] = useState(value);

  return (
    <>
      {/* Constrained: an art-sized preview made each slide card tall enough to
          push the next one off the screen, which turned a row of five slides
          into a long scroll. The editor needs to recognise the image, not
          admire it at full width. */}
      <div className="max-w-[240px]">
        <ImageUpload value={url} onChange={setUrl} />
      </div>
      <input type="hidden" name={name} value={url} required={required} />
      {/* A visible copy of the path: useful for an editor who wants to reuse an
          existing library image without re-uploading it. */}
      <input
        type="text"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="/images/..."
        className="mt-1.5 w-full max-w-[240px] rounded-md border border-sand-border bg-rang-paper/40 px-2 py-1 font-sans text-[11px] text-muted-ink focus:outline-none focus:ring-1 focus:ring-kumkum/40"
      />
    </>
  );
}
