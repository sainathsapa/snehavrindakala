import { describe, expect, it, beforeEach } from "vitest";
import {
  parseWishlist,
  loadWishlist,
  saveWishlist,
  toggleWishlist,
  removeFromWishlist,
  isWishlisted,
  WISHLIST_KEY,
  type StorageLike,
  type WishlistEntry,
} from "../lib/wishlist-store";

function memoryStorage(): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
  };
}

const entry = (handle: string): WishlistEntry => ({
  handle,
  title: `Work ${handle}`,
});

describe("parseWishlist", () => {
  it("returns [] for null or empty", () => {
    expect(parseWishlist(null)).toEqual([]);
    expect(parseWishlist("")).toEqual([]);
  });

  it("returns [] for invalid JSON", () => {
    expect(parseWishlist("{not json")).toEqual([]);
  });

  it("returns [] when the value is not an array", () => {
    expect(parseWishlist(JSON.stringify({ a: 1 }))).toEqual([]);
  });

  it("drops malformed entries but keeps valid ones", () => {
    const raw = JSON.stringify([
      { handle: "a", title: "A" },
      { handle: 123 },
      { title: "no handle" },
      null,
    ]);
    expect(parseWishlist(raw)).toEqual([{ handle: "a", title: "A" }]);
  });
});

describe("load/save round-trip", () => {
  it("saves and loads back the same list", () => {
    const s = memoryStorage();
    const list = [entry("a"), entry("b")];
    saveWishlist(s, list);
    expect(s.map.get(WISHLIST_KEY)).toBeTruthy();
    expect(loadWishlist(s)).toEqual(list);
  });

  it("loads [] from an empty storage", () => {
    expect(loadWishlist(memoryStorage())).toEqual([]);
  });
});

describe("toggleWishlist", () => {
  it("adds an entry that is not present", () => {
    const out = toggleWishlist([], entry("a"));
    expect(out).toEqual([entry("a")]);
  });

  it("prepends new entries (most recent first)", () => {
    const out = toggleWishlist([entry("a")], entry("b"));
    expect(out.map((e) => e.handle)).toEqual(["b", "a"]);
  });

  it("removes an entry that is already present", () => {
    const out = toggleWishlist([entry("a"), entry("b")], entry("a"));
    expect(out.map((e) => e.handle)).toEqual(["b"]);
  });

  it("does not duplicate on a second add of the same handle", () => {
    let list: WishlistEntry[] = [];
    list = toggleWishlist(list, entry("a"));
    list = toggleWishlist(list, entry("b"));
    list = toggleWishlist(list, entry("b")); // removes
    expect(list.map((e) => e.handle)).toEqual(["a"]);
  });
});

describe("removeFromWishlist / isWishlisted", () => {
  it("removes by handle and leaves others", () => {
    const out = removeFromWishlist([entry("a"), entry("b")], "a");
    expect(out.map((e) => e.handle)).toEqual(["b"]);
  });

  it("is a no-op for an unknown handle", () => {
    const list = [entry("a")];
    expect(removeFromWishlist(list, "z")).toEqual(list);
  });

  it("reports membership", () => {
    const list = [entry("a")];
    expect(isWishlisted(list, "a")).toBe(true);
    expect(isWishlisted(list, "b")).toBe(false);
  });
});
