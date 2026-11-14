import { describe, expect, it } from "vitest";
import { nextActiveIndex, activeResult } from "../lib/search-keyboard";

describe("nextActiveIndex", () => {
  it("starts at 0 when nothing is highlighted yet", () => {
    expect(nextActiveIndex(-1, 1, 3)).toBe(0);
  });

  it("moves down one at a time", () => {
    expect(nextActiveIndex(0, 1, 3)).toBe(1);
    expect(nextActiveIndex(1, 1, 3)).toBe(2);
  });

  it("wraps from the last result back to the first", () => {
    expect(nextActiveIndex(2, 1, 3)).toBe(0);
  });

  it("moves up one at a time", () => {
    expect(nextActiveIndex(2, -1, 3)).toBe(1);
  });

  it("wraps from the first result up to the last", () => {
    expect(nextActiveIndex(0, -1, 3)).toBe(2);
  });

  it("returns -1 for an empty list", () => {
    expect(nextActiveIndex(-1, 1, 0)).toBe(-1);
    expect(nextActiveIndex(0, -1, 0)).toBe(-1);
  });
});

describe("activeResult", () => {
  const items = ["a", "b", "c"];

  it("returns the item at a valid index", () => {
    expect(activeResult(items, 1)).toBe("b");
  });

  it("returns null when nothing is highlighted", () => {
    expect(activeResult(items, -1)).toBeNull();
  });

  it("returns null for a stale index past the end of the list", () => {
    expect(activeResult(items, 9)).toBeNull();
  });

  it("returns null for an empty list", () => {
    expect(activeResult([], 0)).toBeNull();
  });
});