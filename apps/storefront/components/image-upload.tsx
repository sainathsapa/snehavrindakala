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
    []
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
      {/* Drop zone */}
      <div
        className={`aspect-square rounded-2xl border-2 border-dashed p-4 flex flex-col items-center justify-center transition-all duration-200 ${
          disabled
            ? "border-sand-border bg-surface/50 text-muted-ink cursor-not-allowed"
            : isDragOver
              ? "border-sindoor bg-sindoor/5 text-sindoor"
              : "border-sand-border bg-rang-paper/50 hover:border-sindoor/50 hover:bg-sindoor/5"
        }`}
      >
        {value && (
          <div className="absolute inset-0 flex items-center justify-center">
            <img
              src={value}
              alt="Preview"
              className="w-full h-full object-cover rounded-xl"
            />
            <button
              onClick={(e) => {
                e.preventDefault();
                onChange("");
              }}
              className="absolute top-2 right-2 p-1 bg-sindoor text-rang-paper rounded-full hover:bg-sindoor/90 transition-colors"
              title="Remove image"
            >
              ×
            </button>
          </div>
        )}
        {!value && (
          <>
            {isDragOver ? (
              <div className="space-y-2">
                <div className="text-xl">📁</div>
                <p className="text-sm font-medium text-sindoor font-sans">
                  Drop image here to upload
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-2xl">📷</div>
                <p className="text-sm font-medium text-muted-ink font-sans">
                  Click to upload or drag and drop
                </p>
                <p className="text-xs text-muted-ink font-sans">
                  Max {maxSize}MB • JPG, PNG, WebP, GIF
                </p>
              </div>
            )}
          </>
        )}
        {!value && !disabled && (
          <input
            type="file"
            accept={accept}
            onChange={handleFileSelect}
            className="hidden"
          />
        )}
      </div>

      {/* Upload progress */}
      {isUploading && (
        <div className="mt-2 w-full bg-sand-border rounded-full h-2">
          <div
            className="bg-sindoor h-full rounded-full transition-all duration-300"
            style={{ width: `${uploadProgress}%` }}
          ></div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <p className="mt-2 text-xs text-sindoor font-sans">{error}</p>
      )}
    </div>
  );
}
