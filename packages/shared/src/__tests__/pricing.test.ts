import { describe, expect, it } from "vitest";
import { computeGiftCardSaleAmount, computeMembershipPaymentAmount, resolveGiftCardMonthlyUsage } from "../pricing";

describe("computeMembershipPaymentAmount", () => {
  it("charges 250 XAF + 5% per month for a non-premium payer", () => {
    const result = computeMembershipPaymentAmount(2000, 1, false);
    expect(result.ownerShareXaf).toBe(2000);
    expect(result.commissionXaf).toBe(250 + 100); // 250 + 5% of 2000
    expect(result.totalXaf).toBe(2350);
  });

  it("halves the commission for a premium payer", () => {
    const result = computeMembershipPaymentAmount(2000, 1, true);
    expect(result.commissionXaf).toBe(125 + 50); // (250 + 5% of 2000) / 2
    expect(result.totalXaf).toBe(2175);
  });

  it("scales linearly with the number of months paid in advance", () => {
    const oneMonth = computeMembershipPaymentAmount(2000, 1, false);
    const sixMonths = computeMembershipPaymentAmount(2000, 6, false);
    expect(sixMonths.ownerShareXaf).toBe(oneMonth.ownerShareXaf * 6);
    expect(sixMonths.commissionXaf).toBe(oneMonth.commissionXaf * 6);
  });

  it("rejects an invalid number of months", () => {
    expect(() => computeMembershipPaymentAmount(2000, 0, false)).toThrow(RangeError);
    expect(() => computeMembershipPaymentAmount(2000, 1.5, false)).toThrow(RangeError);
  });
});

describe("computeGiftCardSaleAmount", () => {
  it("charges the seller an 8% commission for a non-premium seller", () => {
    const result = computeGiftCardSaleAmount(10_000, false);
    expect(result.commissionXaf).toBe(800);
    expect(result.netSellerAmountXaf).toBe(9_200);
  });

  it("halves the commission for a premium seller", () => {
    const result = computeGiftCardSaleAmount(10_000, true);
    expect(result.commissionXaf).toBe(400);
    expect(result.netSellerAmountXaf).toBe(9_600);
  });
});

describe("resolveGiftCardMonthlyUsage", () => {
  const now = new Date("2026-06-15T00:00:00Z");

  it("starts a fresh window for a seller who never sold before", () => {
    const usage = resolveGiftCardMonthlyUsage(0, null, now);
    expect(usage.currentAmountXaf).toBe(0);
    expect(usage.windowStartAt).toEqual(now);
  });

  it("keeps the running total within an active 30-day window", () => {
    const windowStartAt = new Date("2026-06-01T00:00:00Z");
    const usage = resolveGiftCardMonthlyUsage(250_000, windowStartAt, now);
    expect(usage.currentAmountXaf).toBe(250_000);
    expect(usage.windowStartAt).toEqual(windowStartAt);
    expect(usage.wouldExceedCap(60_000)).toBe(true);
    expect(usage.wouldExceedCap(40_000)).toBe(false);
  });

  it("resets the window once 30 days have elapsed", () => {
    const windowStartAt = new Date("2026-05-01T00:00:00Z");
    const usage = resolveGiftCardMonthlyUsage(280_000, windowStartAt, now);
    expect(usage.currentAmountXaf).toBe(0);
    expect(usage.windowStartAt).toEqual(now);
    expect(usage.wouldExceedCap(300_000)).toBe(false);
  });
});
