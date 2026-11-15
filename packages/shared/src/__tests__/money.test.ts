import { describe, expect, it } from "vitest";
import { InvalidAmountError, addAmounts, formatXaf, percentageOf, subtractAmounts } from "../money";

describe("money helpers", () => {
  it("adds integer amounts", () => {
    expect(addAmounts(1000, 2500, 500)).toBe(4000);
  });

  it("subtracts integer amounts", () => {
    expect(subtractAmounts(5000, 1200)).toBe(3800);
  });

  it("rejects non-integer amounts", () => {
    expect(() => addAmounts(100.5)).toThrow(InvalidAmountError);
  });

  it("rejects negative amounts", () => {
    expect(() => addAmounts(-100)).toThrow(InvalidAmountError);
  });

  it("computes a rounded percentage", () => {
    // commission co-abonné : 5% de 1990 XAF = 99.5 -> 100
    expect(percentageOf(1990, 0.05)).toBe(100);
  });

  it("formats XAF amounts without decimals", () => {
    const formatted = formatXaf(1500, "fr");
    expect(formatted).toContain("1");
    expect(formatted).not.toMatch(/[.,]\d{2}\s*(XAF|FCFA)/);
  });
});
