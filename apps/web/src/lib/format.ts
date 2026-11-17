/** Formatage XAF : toujours un entier, jamais de décimale (voir @pitzaa/shared). */
export function formatXaf(amountXaf: number): string {
  return `${new Intl.NumberFormat("fr-FR").format(amountXaf)} XAF`;
}

export function formatDate(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

const LEDGER_ENTRY_TYPE_LABELS: Record<string, string> = {
  PAYMENT_COLLECTED: "Paiement collecté",
  ESCROW_HOLD: "Mise en séquestre",
  ESCROW_RELEASE: "Libération de séquestre",
  COMMISSION: "Commission Pitzaa",
  WITHDRAWAL: "Retrait",
  REFUND: "Remboursement",
  PREMIUM_FEE: "Frais Premium",
};

export function formatLedgerEntryType(entryType: string): string {
  return LEDGER_ENTRY_TYPE_LABELS[entryType] ?? entryType;
}

const WITHDRAWAL_STATUS_LABELS: Record<string, string> = {
  PENDING: "En attente",
  PROCESSING: "En cours",
  SUCCEEDED: "Réussi",
  FAILED: "Échoué",
};

export function formatWithdrawalStatus(status: string): string {
  return WITHDRAWAL_STATUS_LABELS[status] ?? status;
}

const KYC_STATUS_LABELS: Record<string, string> = {
  NONE: "Non requis",
  PENDING: "En cours de vérification",
  APPROVED: "Validé",
  REJECTED: "Rejeté",
};

export function formatKycStatus(status: string): string {
  return KYC_STATUS_LABELS[status] ?? status;
}

const GIFT_CARD_LISTING_STATUS_LABELS: Record<string, string> = {
  PENDING_VERIFICATION: "En attente de vérification",
  LISTED: "En vente",
  REJECTED: "Rejetée",
  SOLD: "Vendue",
  CANCELLED: "Annulée",
};

export function formatGiftCardListingStatus(status: string): string {
  return GIFT_CARD_LISTING_STATUS_LABELS[status] ?? status;
}

const GIFT_CARD_ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: "Paiement en cours",
  PAYMENT_FAILED: "Paiement échoué",
  PAID: "Payée",
  CODE_REVEALED: "Code révélé",
  ESCROW_RELEASED: "Séquestre libéré",
  DISPUTED: "En litige",
  REFUNDED: "Remboursée",
};

export function formatGiftCardOrderStatus(status: string): string {
  return GIFT_CARD_ORDER_STATUS_LABELS[status] ?? status;
}
