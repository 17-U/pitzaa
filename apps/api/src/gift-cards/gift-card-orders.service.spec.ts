import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as cryptoUtil from '../common/crypto.util';
import { encryptVaultPayload } from '../vault/vault-crypto.util';
import { GiftCardOrdersService } from './gift-card-orders.service';

jest.mock('../common/crypto.util', () => ({ verifySecret: jest.fn() }));

const TEST_KEY = '0'.repeat(64);
const verifySecretMock = cryptoUtil.verifySecret as jest.Mock;

function createFakeConfig(): ConfigService {
  return { getOrThrow: () => TEST_KEY } as unknown as ConfigService;
}

function createFakePrisma() {
  const giftCardListing = { findUnique: jest.fn(), update: jest.fn() };
  const user = { findUniqueOrThrow: jest.fn() };
  const wallet = { findUnique: jest.fn() };
  const giftCardOrder = {
    create: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    findMany: jest.fn(),
  };
  const giftCardCodeAccessLog = { create: jest.fn() };

  const tx = { giftCardListing, giftCardOrder };
  const prisma = {
    giftCardListing,
    user,
    wallet,
    giftCardOrder,
    giftCardCodeAccessLog,
    $transaction: jest.fn((arg: unknown) => {
      if (Array.isArray(arg)) return Promise.all(arg);
      return (arg as (t: typeof tx) => Promise<unknown>)(tx);
    }),
  };

  return {
    prisma,
    giftCardListing,
    user,
    wallet,
    giftCardOrder,
    giftCardCodeAccessLog,
  };
}

function createFakeLedger() {
  return { postEntries: jest.fn().mockResolvedValue({ id: 'ltx_1' }) };
}

function createFakePaymentsService() {
  return {
    initiateCollection: jest
      .fn()
      .mockResolvedValue({ id: 'pay_1', status: 'PENDING' }),
  };
}

function createFakeMessaging() {
  return {
    createConversationForGiftCardOrder: jest.fn().mockResolvedValue(undefined),
  };
}

function createFakeNotifications() {
  return { notify: jest.fn().mockResolvedValue(undefined) };
}

describe('GiftCardOrdersService', () => {
  beforeEach(() => {
    verifySecretMock.mockReset();
  });

  describe('buy', () => {
    it('rejects the seller buying their own listing', async () => {
      const { prisma, giftCardListing } = createFakePrisma();
      giftCardListing.findUnique.mockResolvedValue({
        id: 'listing_1',
        status: 'LISTED',
        sellerId: 'seller_1',
        expiresAt: null,
      });
      const service = new GiftCardOrdersService(
        prisma as never,
        createFakeLedger() as never,
        createFakePaymentsService() as never,
        createFakeConfig(),
        createFakeMessaging() as never,
        createFakeNotifications() as never,
      );

      await expect(
        service.buy('seller_1', 'listing_1', { pin: '1234', method: 'WALLET' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects buying a listing that is no longer available', async () => {
      const { prisma, giftCardListing } = createFakePrisma();
      giftCardListing.findUnique.mockResolvedValue({
        id: 'listing_1',
        status: 'SOLD',
      });
      const service = new GiftCardOrdersService(
        prisma as never,
        createFakeLedger() as never,
        createFakePaymentsService() as never,
        createFakeConfig(),
        createFakeMessaging() as never,
        createFakeNotifications() as never,
      );

      await expect(
        service.buy('buyer_1', 'listing_1', { pin: '1234', method: 'WALLET' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects an expired listing', async () => {
      const { prisma, giftCardListing } = createFakePrisma();
      giftCardListing.findUnique.mockResolvedValue({
        id: 'listing_1',
        status: 'LISTED',
        sellerId: 'seller_1',
        expiresAt: new Date(Date.now() - 1000),
      });
      const service = new GiftCardOrdersService(
        prisma as never,
        createFakeLedger() as never,
        createFakePaymentsService() as never,
        createFakeConfig(),
        createFakeMessaging() as never,
        createFakeNotifications() as never,
      );

      await expect(
        service.buy('buyer_1', 'listing_1', { pin: '1234', method: 'WALLET' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects an incorrect PIN', async () => {
      const { prisma, giftCardListing, user } = createFakePrisma();
      giftCardListing.findUnique.mockResolvedValue({
        id: 'listing_1',
        status: 'LISTED',
        sellerId: 'seller_1',
        expiresAt: null,
      });
      user.findUniqueOrThrow.mockResolvedValue({ pinHash: 'hash' });
      verifySecretMock.mockResolvedValue(false);
      const service = new GiftCardOrdersService(
        prisma as never,
        createFakeLedger() as never,
        createFakePaymentsService() as never,
        createFakeConfig(),
        createFakeMessaging() as never,
        createFakeNotifications() as never,
      );

      await expect(
        service.buy('buyer_1', 'listing_1', { pin: '0000', method: 'WALLET' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a wallet purchase when the balance is insufficient', async () => {
      const { prisma, giftCardListing, user, wallet } = createFakePrisma();
      giftCardListing.findUnique.mockResolvedValue({
        id: 'listing_1',
        status: 'LISTED',
        sellerId: 'seller_1',
        expiresAt: null,
        askingPriceXaf: 10_000,
      });
      user.findUniqueOrThrow.mockImplementation(
        ({ where }: { where: { id: string } }) =>
          where.id === 'buyer_1' ? { pinHash: 'hash' } : { isPremium: false },
      );
      verifySecretMock.mockResolvedValue(true);
      wallet.findUnique.mockResolvedValue({ availableBalanceXaf: 1_000 });
      const service = new GiftCardOrdersService(
        prisma as never,
        createFakeLedger() as never,
        createFakePaymentsService() as never,
        createFakeConfig(),
        createFakeMessaging() as never,
        createFakeNotifications() as never,
      );

      await expect(
        service.buy('buyer_1', 'listing_1', { pin: '1234', method: 'WALLET' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('debits the buyer wallet and credits the seller escrow on a wallet purchase', async () => {
      const { prisma, giftCardListing, user, wallet, giftCardOrder } =
        createFakePrisma();
      giftCardListing.findUnique.mockResolvedValue({
        id: 'listing_1',
        status: 'LISTED',
        sellerId: 'seller_1',
        expiresAt: null,
        askingPriceXaf: 10_000,
      });
      user.findUniqueOrThrow.mockImplementation(
        ({ where }: { where: { id: string } }) =>
          where.id === 'buyer_1' ? { pinHash: 'hash' } : { isPremium: false },
      );
      verifySecretMock.mockResolvedValue(true);
      wallet.findUnique.mockResolvedValue({ availableBalanceXaf: 50_000 });
      giftCardOrder.create.mockResolvedValue({ id: 'order_1' });
      giftCardOrder.update.mockResolvedValue({ id: 'order_1', status: 'PAID' });
      const ledger = createFakeLedger();
      const service = new GiftCardOrdersService(
        prisma as never,
        ledger as never,
        createFakePaymentsService() as never,
        createFakeConfig(),
        createFakeMessaging() as never,
        createFakeNotifications() as never,
      );

      const result = await service.buy('buyer_1', 'listing_1', {
        pin: '1234',
        method: 'WALLET',
      });

      expect(giftCardListing.update).toHaveBeenCalledWith({
        where: { id: 'listing_1' },
        data: { status: 'SOLD' },
      });
      expect(ledger.postEntries).toHaveBeenCalledWith(
        expect.anything(),
        'GIFT_CARD_PURCHASE_COLLECTION',
        [
          {
            accountType: 'USER_AVAILABLE',
            entryType: 'PAYMENT_COLLECTED',
            amountXaf: -10_000,
            userId: 'buyer_1',
          },
          {
            accountType: 'USER_ESCROW',
            entryType: 'ESCROW_HOLD',
            amountXaf: 10_000,
            userId: 'seller_1',
          },
        ],
        expect.any(String),
      );
      expect(result).toEqual({ id: 'order_1', status: 'PAID' });
    });

    it('requires an operator and msisdn for a mobile money purchase', async () => {
      const { prisma, giftCardListing, user } = createFakePrisma();
      giftCardListing.findUnique.mockResolvedValue({
        id: 'listing_1',
        status: 'LISTED',
        sellerId: 'seller_1',
        expiresAt: null,
        askingPriceXaf: 10_000,
      });
      user.findUniqueOrThrow.mockImplementation(
        ({ where }: { where: { id: string } }) =>
          where.id === 'buyer_1' ? { pinHash: 'hash' } : { isPremium: false },
      );
      verifySecretMock.mockResolvedValue(true);
      const service = new GiftCardOrdersService(
        prisma as never,
        createFakeLedger() as never,
        createFakePaymentsService() as never,
        createFakeConfig(),
        createFakeMessaging() as never,
        createFakeNotifications() as never,
      );

      await expect(
        service.buy('buyer_1', 'listing_1', {
          pin: '1234',
          method: 'MOBILE_MONEY',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('revealCode', () => {
    it('rejects revealing an order that is not paid yet', async () => {
      const { prisma, giftCardOrder } = createFakePrisma();
      giftCardOrder.findUnique.mockResolvedValue({
        id: 'order_1',
        buyerId: 'buyer_1',
        status: 'PENDING_PAYMENT',
        listing: {},
      });
      const service = new GiftCardOrdersService(
        prisma as never,
        createFakeLedger() as never,
        createFakePaymentsService() as never,
        createFakeConfig(),
        createFakeMessaging() as never,
        createFakeNotifications() as never,
      );

      await expect(service.revealCode('buyer_1', 'order_1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('rejects revealing an order a second time', async () => {
      const { prisma, giftCardOrder } = createFakePrisma();
      giftCardOrder.findUnique.mockResolvedValue({
        id: 'order_1',
        buyerId: 'buyer_1',
        status: 'CODE_REVEALED',
        listing: {},
      });
      const service = new GiftCardOrdersService(
        prisma as never,
        createFakeLedger() as never,
        createFakePaymentsService() as never,
        createFakeConfig(),
        createFakeMessaging() as never,
        createFakeNotifications() as never,
      );

      await expect(service.revealCode('buyer_1', 'order_1')).rejects.toThrow(
        'Le code a déjà été révélé.',
      );
    });

    it('decrypts and logs the one allowed reveal', async () => {
      const { prisma, giftCardOrder, giftCardCodeAccessLog } =
        createFakePrisma();
      const { encryptedPayload, iv, authTag } = encryptVaultPayload(
        'SECRET-CODE',
        TEST_KEY,
      );
      giftCardOrder.findUnique.mockResolvedValue({
        id: 'order_1',
        buyerId: 'buyer_1',
        status: 'PAID',
        listing: {
          codeEncrypted: encryptedPayload,
          codeIv: iv,
          codeAuthTag: authTag,
        },
      });
      const service = new GiftCardOrdersService(
        prisma as never,
        createFakeLedger() as never,
        createFakePaymentsService() as never,
        createFakeConfig(),
        createFakeMessaging() as never,
        createFakeNotifications() as never,
      );

      const result = await service.revealCode('buyer_1', 'order_1');

      expect(result).toEqual({ code: 'SECRET-CODE' });
      expect(giftCardCodeAccessLog.create).toHaveBeenCalledWith({
        data: { orderId: 'order_1', userId: 'buyer_1' },
      });
      expect(giftCardOrder.update).toHaveBeenCalledWith({
        where: { id: 'order_1' },
        data: {
          status: 'CODE_REVEALED',
          codeRevealedAt: expect.any(Date),
          escrowReleaseAt: expect.any(Date),
        },
      });
    });
  });

  describe('listMine', () => {
    it('never selects the encrypted code fields of the underlying listing', async () => {
      const { prisma, giftCardOrder } = createFakePrisma();
      giftCardOrder.findMany.mockResolvedValue([]);
      const service = new GiftCardOrdersService(
        prisma as never,
        createFakeLedger() as never,
        createFakePaymentsService() as never,
        createFakeConfig(),
        createFakeMessaging() as never,
        createFakeNotifications() as never,
      );

      await service.listMine('buyer_1');

      const listingSelect =
        giftCardOrder.findMany.mock.calls[0][0].include.listing.select;
      for (const field of ['codeEncrypted', 'codeIv', 'codeAuthTag']) {
        expect(listingSelect).not.toHaveProperty(field);
      }
    });
  });
});
