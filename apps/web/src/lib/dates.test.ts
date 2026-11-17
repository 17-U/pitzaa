import { describe, expect, it } from "vitest";
import { isDateInFuture } from "./dates";

describe("isDateInFuture", () => {
  it("is true for a date in the future", () => {
    expect(isDateInFuture(new Date(Date.now() + 86_400_000).toISOString())).toBe(true);
  });

  it("is false for a date in the past", () => {
    expect(isDateInFuture(new Date(Date.now() - 86_400_000).toISOString())).toBe(false);
  });
});
