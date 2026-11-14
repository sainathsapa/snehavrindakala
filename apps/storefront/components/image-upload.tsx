"use client";

import { useState, useCallback } from "react";

interface ImageUploadProps {
  value: string;
  onChange: (url: string) => void;
  accept?: string;
  maxSize?: number; // in MB
  multiple?: boolean;
  disabled?: boolean;
}

export function ImageUpload({
  value,
  onChange,
  accept = "image/jpeg,image/png,image/webp,image/gif",
  maxSize = 5,
  multiple = false,
  disabled = false,
}: ImageUploadProps) {
  const [isDragOver, setDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        await uploadFile(files[0]);
      }
    },
    [disabled, accept, maxSize]
  );

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        await uploadFile(file);
      }
      e.target.value = ""; // reset so same file can be selected again
    },
    []
  );

  const uploadFile = async (file: File) => {
    if (disabled) return;

    // Validate file type
    if (!file.type.match(accept)) {
      setError(`Invalid file type. Allowed: ${accept}`);
      setTimeout(() => setError(null), 4000);
      return;
    }

    // Validate file size
    const maxBytes = maxSize * 1024 * 1024;
    if (file.size > maxBytes) {
      setError(`File too large. Max size: ${maxSize}MB`);
      setTimeout(() => setError(null), 4000);
      return;
    }

    setIsUploading(true);
    setError(null);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append("file", file);

      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => (prev < 90 ? prev + 10 : prev));
      }, 200);

      const res = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Upload failed");
      }

      const data = await res.json();
      onChange(data.url);
    } catch (err: any) {
      setError(err.message || "Upload failed");
      setTimeout(() => setError(null), 4000);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <div
      className="relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* The file input is always mounted. It used to render only when there
          was no image yet, which meant a slide with an image could never have
          that image replaced — the click target had nothing behind it. */}
      <label
        className={`relative block aspect-[4/3] cursor-pointer overflow-hidden rounded-md border-2 border-dashed transition-all duration-200 ${
          disabled
            ? "cursor-not-allowed border-sand-border bg-surface/50 text-muted-ink"
            : isDragOver
              ? "border-kumkum bg-kumkum/5"
              : "border-sand-border bg-rang-paper/50 hover:border-kumkum/50 hover:bg-kumkum/5"
        }`}
      >
        <input
          type="file"
          accept={accept}
          onChange={handleFileSelect}
          disabled={disabled || isUploading}
          className="sr-only"
          aria-label={value ? "Replace image" : "Upload image"}
        />

        {value ? (
          <>
            { }
            <img
              src={value}
              alt="Selected image preview"
              className="h-full w-full object-cover"
            />
            <span className="absolute inset-x-0 bottom-0 bg-deep-ink/70 px-2 py-1.5 text-center font-sans text-[10px] font-medium uppercase tracking-wider text-rang-paper opacity-0 transition-opacity hover:opacity-100">
              Click to replace
            </span>
          </>
        ) : (
          <span className="flex h-full flex-col items-center justify-center gap-1.5 px-3 text-center">
            <span aria-hidden="true" className="text-xl text-terracotta">
              ✦
            </span>
            <span className="font-sans text-xs font-medium text-deep-ink">
              {isDragOver ? "Drop to upload" : "Click or drag an image"}
            </span>
            <span className="font-sans text-[10px] text-muted-ink">
              JPG, PNG, WebP, GIF · max {maxSize}MB
            </span>
          </span>
        )}

        {isUploading && (
          <span className="absolute inset-0 flex items-center justify-center bg-deep-ink/50 font-sans text-xs font-medium text-rang-paper">
            Uploading…
          </span>
        )}
      </label>

      {value && !disabled && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="mt-1.5 font-sans text-[10px] font-medium uppercase tracking-wider text-kumkum hover:text-sindoor"
        >
          Remove image
        </button>
      )}

      {error && (
        <p className="mt-1.5 font-sans text-[11px] text-kumkum">{error}</p>
      )}
    </div>
  );
}
