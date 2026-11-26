/**
 * Social marks as icons.
 *
 * The footer used to print the platform names in small caps, which read like a
 * list of words rather than a row of ways to follow the studio. These are drawn
 * as paths so they inherit `currentColor`, print crisply and add no request —
 * the alternative was a sprite sheet for three glyphs.
 *
 * Each link keeps an accessible name: the icon is `aria-hidden`, and the network
 * name is present as `sr-only` text, so a screen reader announces "Instagram"
 * rather than "link".
 */

export type SocialIconName = "instagram" | "youtube" | "facebook" | "pinterest" | "linkedin" | "x";

const PATHS: Record<string, { viewBox: string; path: string }> = {
  instagram: {
    viewBox: "0 0 24 24",
    path:
      "M12 2.2c3.2 0 3.6 0 4.9.07 1.2.06 2 .25 2.7.53.7.28 1.3.65 1.9 1.22.6.6.9 1.2 1.2 1.9.3.7.5 1.5.5 2.7.1 1.3.1 1.7.1 4.9s0 3.6-.1 4.9c0 1.2-.2 2-.5 2.7-.3.7-.6 1.3-1.2 1.9-.6.6-1.2.9-1.9 1.2-.7.3-1.5.5-2.7.5-1.3.1-1.7.1-4.9.1s-3.6 0-4.9-.1c-1.2 0-2-.2-2.7-.5-.7-.3-1.3-.6-1.9-1.2-.6-.6-.9-1.2-1.2-1.9-.3-.7-.5-1.5-.5-2.7C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.9c0-1.2.2-2 .5-2.7.3-.7.6-1.3 1.2-1.9.6-.6 1.2-.9 1.9-1.2C6.6 1 7.4.8 8.6.7 9.9.7 10.3.7 12 .7Z",
  },
  youtube: {
    viewBox: "0 0 24 24",
    path:
      "M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8ZM10 15.2V8.8L15.5 12Z",
  },
  facebook: {
    viewBox: "0 0 24 24",
    path:
      "M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.7-3.9 1.1 0 2.2.2 2.2.2v2.4h-1.2c-1.2 0-1.6.8-1.6 1.6V12h2.7l-.4 2.9h-2.3v7A10 10 0 0 0 22 12Z",
  },
  pinterest: {
    viewBox: "0 0 24 24",
    path:
      "M12 2a10 10 0 0 0-3.6 19.3c-.1-.8-.2-2 0-2.9l1.2-5s-.3-.6-.3-1.5c0-1.4.8-2.4 1.8-2.4.9 0 1.3.6 1.3 1.4 0 .9-.6 2.2-.9 3.4-.2 1 .5 1.9 1.6 1.9 1.9 0 3.3-2 3.3-4.9 0-2.5-1.8-4.3-4.4-4.3-3 0-4.7 2.2-4.7 4.5 0 .9.3 1.9.8 2.4.1.1.1.2.1.3l-.3 1.2c0 .2-.2.2-.4.1-1.3-.6-2.1-2.5-2.1-4 0-3.2 2.4-6.2 6.8-6.2 3.6 0 6.3 2.5 6.3 5.9 0 3.6-2.2 6.4-5.4 6.4-1 0-2-.5-2.4-1.2l-.6 2.5c-.2.9-.8 2-1.2 2.6A10 10 0 1 0 12 2Z",
  },
  linkedin: {
    viewBox: "0 0 24 24",
    path:
      "M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9h4v12H3Zm7 0h3.8v1.7h.1a4.2 4.2 0 0 1 3.8-2.1c4 0 4.7 2.6 4.7 6V21h-4v-5.6c0-1.3 0-3-1.9-3s-2.1 1.5-2.1 2.9V21h-4Z",
  },
  x: {
    viewBox: "0 0 24 24",
    path:
      "M17.5 3h3.2l-7 8 8.2 10h-6.4l-5-6.1-5.7 6.1H1.6l7.5-8.6L1.2 3h6.6l4.5 5.6Zm-1.1 16h1.8L6.6 4.8H4.7Z",
  },
};

export function SocialIcon({
  name,
  className = "h-4 w-4",
}: {
  name: string;
  className?: string;
}) {
  const glyph = PATHS[name];
  if (!glyph) return null;
  return (
    <svg
      aria-hidden
      viewBox={glyph.viewBox}
      className={className}
      fill="currentColor"
      focusable="false"
    >
      <path d={glyph.path} />
    </svg>
  );
}
