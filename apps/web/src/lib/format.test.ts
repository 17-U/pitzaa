import { describe, expect, it } from "vitest";
import {
  formatDisputeRelatedEntity,
  formatDisputeStatus,
  formatGiftCardListingStatus,
  formatGiftCardOrderStatus,
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

describe("formatGiftCardListingStatus", () => {
  it("maps a known status to a French label", () => {
    expect(formatGiftCardListingStatus("LISTED")).toBe("En vente");
  });

  it("falls back to the raw value for an unknown status", () => {
    expect(formatGiftCardListingStatus("SOMETHING_NEW")).toBe("SOMETHING_NEW");
  });
});

describe("formatGiftCardOrderStatus", () => {
  it("maps a known status to a French label", () => {
    expect(formatGiftCardOrderStatus("CODE_REVEALED")).toBe("Code révélé");
  });

  it("falls back to the raw value for an unknown status", () => {
    expect(formatGiftCardOrderStatus("SOMETHING_NEW")).toBe("SOMETHING_NEW");
  });
});

describe("formatDisputeStatus", () => {
  it("maps a known status to a French label", () => {
    expect(formatDisputeStatus("UNDER_ARBITRATION")).toBe("En arbitrage");
  });

  it("falls back to the raw value for an unknown status", () => {
    expect(formatDisputeStatus("SOMETHING_NEW")).toBe("SOMETHING_NEW");
  });
});

describe("formatDisputeRelatedEntity", () => {
  it("maps a known related entity type to a French label", () => {
    expect(formatDisputeRelatedEntity("GIFT_CARD_ORDER")).toBe("Commande de carte cadeau");
  });

  it("falls back to the raw value for an unknown type", () => {
    expect(formatDisputeRelatedEntity("SOMETHING_NEW")).toBe("SOMETHING_NEW");
  });
});
