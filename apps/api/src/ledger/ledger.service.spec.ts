import { PrismaTransaction } from '../prisma/prisma.types';
import {
  InvalidLedgerEntryError,
  LedgerService,
  UnbalancedLedgerTransactionError,
} from './ledger.service';
import { LedgerEntryInput } from './ledger.types';

function createFakeTx() {
  const ledgerTransactionCreate = jest.fn().mockResolvedValue({ id: 'ltx_1' });
  const walletUpdate = jest.fn().mockResolvedValue({});
  const tx = {
    ledgerTransaction: { create: ledgerTransactionCreate },
    wallet: { update: walletUpdate },
  } as unknown as PrismaTransaction;
  return { tx, ledgerTransactionCreate, walletUpdate };
}

describe('LedgerService', () => {
  let service: LedgerService;

  beforeEach(() => {
    service = new LedgerService();
  });

  it('rejects a transaction with fewer than two entries', async () => {
    const { tx } = createFakeTx();
    const entries: LedgerEntryInput[] = [
      {
        accountType: 'PLATFORM_COMMISSION',
        entryType: 'COMMISSION',
        amountXaf: 0,
      },
    ];

    await expect(
      service.postEntries(tx, 'WITHDRAWAL', entries),
    ).rejects.toThrow(InvalidLedgerEntryError);
  });

  it('rejects unbalanced entries', async () => {
    const { tx } = createFakeTx();
    const entries: LedgerEntryInput[] = [
      {
        accountType: 'PAYMENT_PROVIDER',
        entryType: 'PAYMENT_COLLECTED',
        amountXaf: -1000,
      },
      {
        accountType: 'USER_ESCROW',
        entryType: 'ESCROW_HOLD',
        amountXaf: 900,
        userId: 'owner-1',
      },
    ];

    await expect(
      service.postEntries(tx, 'MEMBERSHIP_PAYMENT_COLLECTION', entries),
    ).rejects.toThrow(UnbalancedLedgerTransactionError);
  });

  it('rejects a non-integer amount', async () => {
    const { tx } = createFakeTx();
    const entries: LedgerEntryInput[] = [
      {
        accountType: 'PAYMENT_PROVIDER',
        entryType: 'PAYMENT_COLLECTED',
        amountXaf: -1000.5,
      },
      {
        accountType: 'USER_ESCROW',
        entryType: 'ESCROW_HOLD',
        amountXaf: 1000.5,
        userId: 'owner-1',
      },
    ];

    await expect(
      service.postEntries(tx, 'MEMBERSHIP_PAYMENT_COLLECTION', entries),
    ).rejects.toThrow(InvalidLedgerEntryError);
  });

  it('rejects a wallet account entry without a userId', async () => {
    const { tx } = createFakeTx();
    const entries: LedgerEntryInput[] = [
      {
        accountType: 'PAYMENT_PROVIDER',
        entryType: 'PAYMENT_COLLECTED',
        amountXaf: -1000,
      },
      { accountType: 'USER_ESCROW', entryType: 'ESCROW_HOLD', amountXaf: 1000 },
    ];

    await expect(
      service.postEntries(tx, 'MEMBERSHIP_PAYMENT_COLLECTION', entries),
    ).rejects.toThrow(InvalidLedgerEntryError);
  });

  it('rejects a platform account entry that carries a userId', async () => {
    const { tx } = createFakeTx();
    const entries: LedgerEntryInput[] = [
      {
        accountType: 'PAYMENT_PROVIDER',
        entryType: 'PAYMENT_COLLECTED',
        amountXaf: -1000,
        userId: 'owner-1',
      },
      {
        accountType: 'USER_ESCROW',
        entryType: 'ESCROW_HOLD',
        amountXaf: 1000,
        userId: 'owner-1',
      },
    ];

    await expect(
      service.postEntries(tx, 'MEMBERSHIP_PAYMENT_COLLECTION', entries),
    ).rejects.toThrow(InvalidLedgerEntryError);
  });

  it('posts a balanced collection transaction and credits the escrow of the beneficiary', async () => {
    const { tx, ledgerTransactionCreate, walletUpdate } = createFakeTx();
    const entries: LedgerEntryInput[] = [
      {
        accountType: 'PAYMENT_PROVIDER',
        entryType: 'PAYMENT_COLLECTED',
        amountXaf: -2500,
      },
      {
        accountType: 'USER_ESCROW',
        entryType: 'ESCROW_HOLD',
        amountXaf: 2500,
        userId: 'owner-1',
      },
    ];

    const result = await service.postEntries(
      tx,
      'MEMBERSHIP_PAYMENT_COLLECTION',
      entries,
      'co-member payment',
    );

    expect(result).toEqual({ id: 'ltx_1' });
    expect(ledgerTransactionCreate).toHaveBeenCalledWith({
      data: {
        type: 'MEMBERSHIP_PAYMENT_COLLECTION',
        description: 'co-member payment',
        entries: { create: entries },
      },
    });
    expect(walletUpdate).toHaveBeenCalledTimes(1);
    expect(walletUpdate).toHaveBeenCalledWith({
      where: { userId: 'owner-1' },
      data: { escrowBalanceXaf: { increment: 2500 } },
    });
  });

  it('posts an escrow release, moving funds from escrow to available and crediting the commission', async () => {
    const { tx, walletUpdate } = createFakeTx();
    const entries: LedgerEntryInput[] = [
      {
        accountType: 'USER_ESCROW',
        entryType: 'ESCROW_RELEASE',
        amountXaf: -2500,
        userId: 'owner-1',
      },
      {
        accountType: 'USER_AVAILABLE',
        entryType: 'ESCROW_RELEASE',
        amountXaf: 2250,
        userId: 'owner-1',
      },
      {
        accountType: 'PLATFORM_COMMISSION',
        entryType: 'COMMISSION',
        amountXaf: 250,
      },
    ];

    await service.postEntries(tx, 'MEMBERSHIP_ESCROW_RELEASE', entries);

    expect(walletUpdate).toHaveBeenCalledTimes(2);
    expect(walletUpdate).toHaveBeenCalledWith({
      where: { userId: 'owner-1' },
      data: { escrowBalanceXaf: { increment: -2500 } },
    });
    expect(walletUpdate).toHaveBeenCalledWith({
      where: { userId: 'owner-1' },
      data: { availableBalanceXaf: { increment: 2250 } },
    });
  });

  it('does not touch any wallet when only platform accounts are involved', async () => {
    const { tx, walletUpdate } = createFakeTx();
    const entries: LedgerEntryInput[] = [
      {
        accountType: 'WITHDRAWAL_CLEARING',
        entryType: 'WITHDRAWAL',
        amountXaf: -100,
      },
      {
        accountType: 'PLATFORM_COMMISSION',
        entryType: 'COMMISSION',
        amountXaf: 100,
      },
    ];

    await service.postEntries(tx, 'WITHDRAWAL', entries);

    expect(walletUpdate).not.toHaveBeenCalled();
  });
});
