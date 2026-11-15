import { describe, expect, it } from "vitest";
import {
  cheapestRateKey,
  rateKeyOf,
  resolveSelectedRate,
  type QuotedRate,
} from "@/lib/shipping/select-rate";

const quote = (name: string, rate: number): QuotedRate => ({
  courier_name: name,
  service_name: "Surface",
  rate,
  expected_delivery: "3-5 days",
});

const QUOTES = [quote("DTDC", 118), quote("Xpressbees", 99), quote("Delhivery", 105)];

describe("cheapestRateKey", () => {
  it("picks the lowest quote regardless of order", () => {
    expect(cheapestRateKey(QUOTES)).toBe("Xpressbees::Surface");
  });

  it("returns an empty key when there is nothing to choose", () => {
    expect(cheapestRateKey([])).toBe("");
  });

  it("breaks ties deterministically rather than by array order", () => {
    const tied = [quote("B", 100), quote("A", 100)];
    expect(cheapestRateKey(tied)).toBe("A::Surface");
    expect(cheapestRateKey(tied.slice().reverse())).toBe("A::Surface");
  });
});

describe("resolveSelectedRate", () => {
  it("selects the cheapest once quotes arrive", () => {
    // The regression: checkout opened with no quotes, so the selection was "".
    expect(resolveSelectedRate([], "")).toBe("");
    expect(resolveSelectedRate(QUOTES, "")).toBe("Xpressbees::Surface");
  });

  it("keeps the buyer's choice when it is still offered", () => {
    expect(resolveSelectedRate(QUOTES, "DTDC::Surface")).toBe("DTDC::Surface");
  });

  it("falls back to the cheapest when the chosen courier disappears", () => {
    const withoutDtdc = QUOTES.filter((rate) => rate.courier_name !== "DTDC");
    expect(resolveSelectedRate(withoutDtdc, "DTDC::Surface")).toBe(
      "Xpressbees::Surface"
    );
  });

  it("clears the selection when there are no quotes at all", () => {
    expect(resolveSelectedRate([], "DTDC::Surface")).toBe("");
  });

  it("distinguishes services from the same courier", () => {
    const rates: QuotedRate[] = [
      {
        courier_name: "Delhivery",
        service_name: "Express",
        rate: 200,
        expected_delivery: "1-2 days",
      },
      {
        courier_name: "Delhivery",
        service_name: "Surface",
        rate: 105,
        expected_delivery: "4-6 days",
      },
    ];
    expect(rateKeyOf(rates[0])).not.toBe(rateKeyOf(rates[1]));
    // The cheaper *service* wins, not merely the cheaper courier name.
    expect(resolveSelectedRate(rates, "")).toBe("Delhivery::Surface");
  });
});
