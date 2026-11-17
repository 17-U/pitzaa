import { describe, expect, it } from "vitest";
import { decodeJwtExpiry, isJwtExpiringSoon } from "./jwt";

function makeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: "none" }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.signature`;
}

describe("decodeJwtExpiry", () => {
  it("extracts the exp claim from a well-formed token", () => {
    const exp = Math.floor(Date.now() / 1000) + 900;
    expect(decodeJwtExpiry(makeJwt({ sub: "user_1", exp }))).toBe(exp);
  });

  it("returns null for a token with no exp claim", () => {
    expect(decodeJwtExpiry(makeJwt({ sub: "user_1" }))).toBeNull();
  });

  it("returns null for a malformed token", () => {
    expect(decodeJwtExpiry("not-a-jwt")).toBeNull();
  });
});

describe("isJwtExpiringSoon", () => {
  it("is false for a token far from expiry", () => {
    const exp = Math.floor(Date.now() / 1000) + 900;
    expect(isJwtExpiringSoon(makeJwt({ exp }))).toBe(false);
  });

  it("is true for a token expiring within the skew window", () => {
    const exp = Math.floor(Date.now() / 1000) + 30;
    expect(isJwtExpiringSoon(makeJwt({ exp }), 60)).toBe(true);
  });

  it("is true for an already-expired token", () => {
    const exp = Math.floor(Date.now() / 1000) - 10;
    expect(isJwtExpiringSoon(makeJwt({ exp }))).toBe(true);
  });

  it("is true for an unreadable token (fail safe toward refreshing)", () => {
    expect(isJwtExpiringSoon("garbage")).toBe(true);
  });
});
