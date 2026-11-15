import { LedgerAccountType, LedgerEntryType } from '@prisma/client';

/**
 * Une écriture de grand livre. amountXaf est signé : positif pour un crédit,
 * négatif pour un débit. userId est requis pour les comptes USER_AVAILABLE/USER_ESCROW,
 * absent pour les comptes plateforme (PLATFORM_COMMISSION, WITHDRAWAL_CLEARING...).
 */
export interface LedgerEntryInput {
  accountType: LedgerAccountType;
  entryType: LedgerEntryType;
  amountXaf: number;
  userId?: string;
}
