import { describe, expect, it } from "vitest";
import {
  formatKycStatus,
  formatLedgerEntryType,
  formatWithdrawalStatus,
  formatXaf,
} from "./format";

describe("formatXaf", () => {
  it("formats a whole XAF amount with thousands separators and a suffix", () => {
    expect(formatXaf(2350)).toBe("2 350 XAF");
  });

  it("formats zero", () => {
    expect(formatXaf(0)).toBe("0 XAF");
  });
});

describe("formatLedgerEntryType", () => {
  it("maps a known entry type to a French label", () => {
    expect(formatLedgerEntryType("ESCROW_RELEASE")).toBe("Libération de séquestre");
  });

  it("falls back to the raw value for an unknown type", () => {
    expect(formatLedgerEntryType("SOMETHING_NEW")).toBe("SOMETHING_NEW");
  });
});

describe("formatWithdrawalStatus", () => {
  it("maps a known status to a French label", () => {
    expect(formatWithdrawalStatus("SUCCEEDED")).toBe("Réussi");
  });
});

describe("formatKycStatus", () => {
  it("maps a known status to a French label", () => {
    expect(formatKycStatus("APPROVED")).toBe("Validé");
  });
});
