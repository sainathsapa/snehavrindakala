/**
 * Validation rules for commission reference uploads.
 *
 * Extracted from the route so the rules can be unit-tested without touching the
 * filesystem, and so the client and server agree on exactly what is allowed.
 */
export const MAX_COMMISSION_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_COMMISSION_FILES = 5;

/** Allowed MIME types mapped to the extension we will store them under. */
export const COMMISSION_ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

export interface FileCheck {
  ok: boolean;
  /** Present when `ok` is false. */
  error?: string;
  /** The extension to store under, when `ok`. */
  ext?: string;
}

/** Validate a proposed upload by MIME type and size. */
export function validateCommissionFile(
  type: string,
  size: number
): FileCheck {
  const ext = COMMISSION_ALLOWED_TYPES[type];
  if (!ext) {
    return { ok: false, error: "Please use a JPG, PNG, WebP image or a PDF." };
  }
  if (size <= 0) {
    return { ok: false, error: "That file appears to be empty." };
  }
  if (size > MAX_COMMISSION_FILE_BYTES) {
    return {
      ok: false,
      error: "That file is larger than 10 MB. Please use a smaller one.",
    };
  }
  return { ok: true, ext };
}

/** Validate an attachment array coming back from the client before submit. */
export function parseAttachmentList(raw: string | null | undefined): {
  key: string;
  mime_type: string;
  size_bytes: number;
  original_filename?: string | null;
}[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((a) => a && typeof a.key === "string" && a.key.length > 0)
      .slice(0, MAX_COMMISSION_FILES)
      .map((a) => ({
        key: a.key,
        mime_type: String(a.mime_type || "application/octet-stream"),
        size_bytes: Number(a.size_bytes) || 0,
        original_filename:
          typeof a.original_filename === "string" ? a.original_filename : null,
      }));
  } catch {
    return [];
  }
}
