/**
 * Pure helpers for the header search dropdown's keyboard navigation.
 *
 * The component keeps `activeIndex` in state; these functions decide where the
 * highlight moves and which result Enter should open. They are extracted so the
 * wrapping behaviour (last → first, first → last) can be unit tested without a
 * DOM, since the test environment is plain node.
 */

/**
 * Move the highlight by `delta` through a list of `length` items, wrapping at
 * both ends. Returns -1 (nothing highlighted) when the list is empty.
 */
export function nextActiveIndex(
  current: number,
  delta: 1 | -1,
  length: number
): number {
  if (length <= 0) return -1;
  return (current + delta + length) % length;
}

/**
 * The result Enter should open, or null when nothing is highlighted or the
 * index is stale (e.g. results shrank under it).
 */
export function activeResult<T>(items: T[], index: number): T | null {
  if (index < 0 || index >= items.length) return null;
  return items[index] ?? null;
}