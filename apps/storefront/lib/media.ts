/**
 * Where admin-uploaded media lives.
 *
 * Kept out of `public/` on purpose: Next's standalone build takes a snapshot of
 * `public/` at compile time, so files written there after the server starts are
 * never served. The upload route writes here and `app/uploads/[...path]` reads
 * it back.
 *
 * The path is an absolute directory that compose mounts as a volume, so a
 * redeploy does not delete every image an editor has attached.
 */
export const MEDIA_ROOT =
  process.env.MEDIA_ROOT || "/data/uploads";

/** Public URL prefix that `app/uploads/[...path]/route.ts` answers on. */
export const MEDIA_URL_PREFIX = "/uploads";