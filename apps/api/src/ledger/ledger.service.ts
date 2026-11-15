import { Injectable } from '@nestjs/common';
import { LedgerTransaction, LedgerTransactionType } from '@prisma/client';
import { PrismaTransaction } from '../prisma/prisma.types';
import { LedgerEntryInput } from './ledger.types';

const WALLET_ACCOUNT_TYPES = new Set(['USER_AVAILABLE', 'USER_ESCROW']);

export class UnbalancedLedgerTransactionError extends Error {
  constructor(entries: LedgerEntryInput[], sum: number) {
    super(
      `Les écritures ne sont pas équilibrées (somme = ${sum}) : ${JSON.stringify(entries)}`,
    );
    this.name = 'UnbalancedLedgerTransactionError';
  }
}

export class InvalidLedgerEntryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidLedgerEntryError';
  }
}

function assertValidEntries(entries: LedgerEntryInput[]): void {
  if (entries.length < 2) {
    throw new InvalidLedgerEntryError(
      'Une transaction du grand livre nécessite au moins deux écritures.',
    );
  }

  let sum = 0;
  for (const entry of entries) {
    if (!Number.isInteger(entry.amountXaf)) {
      throw new InvalidLedgerEntryError(
        `Montant non entier dans une écriture : ${entry.amountXaf}`,
      );
    }
    const isWalletAccount = WALLET_ACCOUNT_TYPES.has(entry.accountType);
    if (isWalletAccount && !entry.userId) {
      throw new InvalidLedgerEntryError(
        `${entry.accountType} nécessite un userId.`,
      );
    }
    if (!isWalletAccount && entry.userId) {
      throw new InvalidLedgerEntryError(
        `${entry.accountType} est un compte plateforme, il ne doit pas porter de userId.`,
      );
    }
    sum += entry.amountXaf;
  }

  if (sum !== 0) {
    throw new UnbalancedLedgerTransactionError(entries, sum);
  }
}

@Injectable()
export class LedgerService {
  /**
   * Enregistre une transaction équilibrée (somme des écritures = 0) et met à jour
   * les soldes de portefeuille en cache dans la même transaction DB. C'est l'unique
   * point d'entrée autorisé pour modifier un solde : aucun solde n'est modifié
   * sans écriture correspondante au grand livre.
   */
  async postEntries(
    tx: PrismaTransaction,
    type: LedgerTransactionType,
    entries: LedgerEntryInput[],
    description?: string,
  ): Promise<LedgerTransaction> {
    assertValidEntries(entries);

    const transaction = await tx.ledgerTransaction.create({
      data: {
        type,
        description,
        entries: { create: entries },
      },
    });

    for (const entry of entries) {
      if (entry.accountType === 'USER_AVAILABLE' && entry.userId) {
        await tx.wallet.update({
          where: { userId: entry.userId },
          data: { availableBalanceXaf: { increment: entry.amountXaf } },
        });
      } else if (entry.accountType === 'USER_ESCROW' && entry.userId) {
        await tx.wallet.update({
          where: { userId: entry.userId },
          data: { escrowBalanceXaf: { increment: entry.amountXaf } },
        });
      }
    }

    return transaction;
  }
}
