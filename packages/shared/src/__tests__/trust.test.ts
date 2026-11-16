import { describe, expect, it } from "vitest";
import { computeDisplayTrustScore, computeReviewTrustImpact } from "../trust";

describe("computeReviewTrustImpact", () => {
  it("is neutral for a 3-star review", () => {
    expect(computeReviewTrustImpact(3)).toBe(0);
  });

  it("rewards a 5-star review", () => {
    expect(computeReviewTrustImpact(5)).toBe(4);
  });

  it("penalizes a 1-star review", () => {
    expect(computeReviewTrustImpact(1)).toBe(-4);
  });

  it("rejects an out-of-range rating", () => {
    expect(() => computeReviewTrustImpact(0)).toThrow(RangeError);
    expect(() => computeReviewTrustImpact(6)).toThrow(RangeError);
  });
});

describe("computeDisplayTrustScore", () => {
  it("adds one point per full month of account age", () => {
    const createdAt = new Date("2026-01-01T00:00:00Z");
    const now = new Date("2026-04-01T00:00:00Z");
    expect(computeDisplayTrustScore(10, createdAt, now)).toBe(13);
  });

  it("caps the seniority bonus", () => {
    const createdAt = new Date("2020-01-01T00:00:00Z");
    const now = new Date("2026-01-01T00:00:00Z");
    expect(computeDisplayTrustScore(0, createdAt, now)).toBe(24);
  });

  it("never applies a negative bonus for a brand-new account", () => {
    const createdAt = new Date("2026-06-01T00:00:00Z");
    expect(computeDisplayTrustScore(5, createdAt, createdAt)).toBe(5);
  });
});
