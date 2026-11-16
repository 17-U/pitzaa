import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GiftCardListingsService } from './gift-card-listings.service';

const TEST_KEY = '0'.repeat(64);

function createFakeConfig(): ConfigService {
  return { getOrThrow: () => TEST_KEY } as unknown as ConfigService;
}

function createFakeVerifier() {
  return { verify: jest.fn().mockResolvedValue({ verified: false }) };
}

function createFakePrisma() {
  const giftCardBrand = { findUnique: jest.fn() };
  const user = { findUniqueOrThrow: jest.fn() };
  const giftCardListing = {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  };
  const auditLog = { create: jest.fn() };

  const prisma = { giftCardBrand, user, giftCardListing, auditLog };
  return { prisma, giftCardBrand, user, giftCardListing, auditLog };
}

describe('GiftCardListingsService', () => {
  describe('create', () => {
    it('rejects a brand whose resale is not allowed', async () => {
      const { prisma, giftCardBrand } = createFakePrisma();
      giftCardBrand.findUnique.mockResolvedValue({ resaleAllowed: false });
      const service = new GiftCardListingsService(
        prisma as never,
        createFakeConfig(),
        createFakeVerifier() as never,
      );

      await expect(
        service.create('seller_1', {
          brandId: 'brand_1',
          balanceXaf: 10_000,
          askingPriceXaf: 9_000,
          code: 'ABC',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a new listing that would exceed the monthly cap without KYC', async () => {
      const { prisma, giftCardBrand, user } = createFakePrisma();
      giftCardBrand.findUnique.mockResolvedValue({
        resaleAllowed: true,
        name: 'Amazon',
        country: 'US',
      });
      user.findUniqueOrThrow.mockResolvedValue({
        kycStatus: 'NONE',
        giftCardSalesCurrentMonthXaf: 280_000,
        giftCardSalesMonthStartAt: new Date(),
      });
      const service = new GiftCardListingsService(
        prisma as never,
        createFakeConfig(),
        createFakeVerifier() as never,
      );

      await expect(
        service.create('seller_1', {
          brandId: 'brand_1',
          balanceXaf: 30_000,
          askingPriceXaf: 25_000,
          code: 'ABC',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows exceeding the cap once the seller is KYC-approved', async () => {
      const { prisma, giftCardBrand, user, giftCardListing } =
        createFakePrisma();
      giftCardBrand.findUnique.mockResolvedValue({
        resaleAllowed: true,
        name: 'Amazon',
        country: 'US',
      });
      user.findUniqueOrThrow.mockResolvedValue({
        kycStatus: 'APPROVED',
        giftCardSalesCurrentMonthXaf: 280_000,
        giftCardSalesMonthStartAt: new Date(),
      });
      giftCardListing.create.mockResolvedValue({ id: 'listing_1' });
      const service = new GiftCardListingsService(
        prisma as never,
        createFakeConfig(),
        createFakeVerifier() as never,
      );

      const result = await service.create('seller_1', {
        brandId: 'brand_1',
        balanceXaf: 30_000,
        askingPriceXaf: 25_000,
        code: 'ABC',
      });

      expect(result).toEqual({ id: 'listing_1' });
    });

    it('never stores the plaintext code', async () => {
      const { prisma, giftCardBrand, user, giftCardListing } =
        createFakePrisma();
      giftCardBrand.findUnique.mockResolvedValue({
        resaleAllowed: true,
        name: 'Amazon',
        country: 'US',
      });
      user.findUniqueOrThrow.mockResolvedValue({
        kycStatus: 'NONE',
        giftCardSalesCurrentMonthXaf: 0,
        giftCardSalesMonthStartAt: null,
      });
      const service = new GiftCardListingsService(
        prisma as never,
        createFakeConfig(),
        createFakeVerifier() as never,
      );

      await service.create('seller_1', {
        brandId: 'brand_1',
        balanceXaf: 10_000,
        askingPriceXaf: 9_000,
        code: 'SECRET-CODE',
      });

      const data = giftCardListing.create.mock.calls[0][0].data;
      expect(Buffer.isBuffer(data.codeEncrypted)).toBe(true);
      expect(data.codeEncrypted.toString('utf8')).not.toContain('SECRET-CODE');
    });
  });

  describe('verify / reject', () => {
    it('rejects acting on a listing that is not pending verification', async () => {
      const { prisma, giftCardListing } = createFakePrisma();
      giftCardListing.findUnique.mockResolvedValue({
        id: 'listing_1',
        status: 'LISTED',
      });
      const service = new GiftCardListingsService(
        prisma as never,
        createFakeConfig(),
        createFakeVerifier() as never,
      );

      await expect(service.verify('admin_1', 'listing_1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('cancel', () => {
    it('rejects cancelling a listing that is already sold', async () => {
      const { prisma, giftCardListing } = createFakePrisma();
      giftCardListing.findUnique.mockResolvedValue({
        id: 'listing_1',
        sellerId: 'seller_1',
        status: 'SOLD',
      });
      const service = new GiftCardListingsService(
        prisma as never,
        createFakeConfig(),
        createFakeVerifier() as never,
      );

      await expect(service.cancel('seller_1', 'listing_1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('rejects cancelling a listing belonging to someone else', async () => {
      const { prisma, giftCardListing } = createFakePrisma();
      giftCardListing.findUnique.mockResolvedValue({
        id: 'listing_1',
        sellerId: 'someone_else',
        status: 'LISTED',
      });
      const service = new GiftCardListingsService(
        prisma as never,
        createFakeConfig(),
        createFakeVerifier() as never,
      );

      await expect(service.cancel('seller_1', 'listing_1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
