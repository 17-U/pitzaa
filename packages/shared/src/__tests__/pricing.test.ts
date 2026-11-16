import { describe, expect, it } from "vitest";
import { computeMembershipPaymentAmount } from "../pricing";

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
