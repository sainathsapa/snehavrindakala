import { describe, expect, it } from "vitest";
import { progressFrom } from "../components/order-next-steps";

describe("progressFrom", () => {
  it("maps delivered/completed to the final beat", () => {
    expect(progressFrom("completed")).toBe(3);
    expect(progressFrom("delivered")).toBe(3);
    expect(progressFrom("COMPLETED")).toBe(3);
  });

  it("maps shipped/fulfilled to 'on its way'", () => {
    expect(progressFrom("shipped")).toBe(2);
    expect(progressFrom("fulfilled")).toBe(2);
    expect(progressFrom("partially_fulfilled")).toBe(2);
  });

  it("maps preparing states to beat 1", () => {
    expect(progressFrom("processing")).toBe(1);
    expect(progressFrom("pending")).toBe(1);
    expect(progressFrom("awaiting")).toBe(1);
  });

  it("advances to shipped if a shipment exists despite an early status", () => {
    expect(progressFrom("pending", true)).toBe(2);
  });

  it("defaults to beat 0 for unknown or missing status", () => {
    expect(progressFrom(undefined)).toBe(0);
    expect(progressFrom(null)).toBe(0);
    expect(progressFrom("something-else")).toBe(0);
  });
});
