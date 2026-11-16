import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import * as cryptoUtil from '../common/crypto.util';
import { MembershipPaymentsService } from './membership-payments.service';

jest.mock('../common/crypto.util', () => ({
  verifySecret: jest.fn(),
}));

function createFakePrisma() {
  const groupMembership = { findUnique: jest.fn(), update: jest.fn() };
  const user = { findUniqueOrThrow: jest.fn() };
  const wallet = { findUnique: jest.fn() };
  const membershipPayment = {
    create: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
  };
  const dispute = { create: jest.fn() };

  const tx = { membershipPayment, groupMembership, dispute };
  const prisma = {
    groupMembership,
    user,
    wallet,
    membershipPayment,
    dispute,
    $transaction: jest.fn(
      async (callback: (t: typeof tx) => Promise<unknown>) => callback(tx),
    ),
  };

  return { prisma, groupMembership, user, wallet, membershipPayment, dispute };
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

const verifySecretMock = cryptoUtil.verifySecret as jest.Mock;

describe('MembershipPaymentsService', () => {
  beforeEach(() => {
    verifySecretMock.mockReset();
  });

  describe('pay', () => {
    it('rejects paying for an adhesion that is not active', async () => {
      const { prisma, groupMembership } = createFakePrisma();
      groupMembership.findUnique.mockResolvedValue({
        userId: 'user_1',
        status: 'PENDING',
        group: {},
      });
      const service = new MembershipPaymentsService(
        prisma as never,
        createFakeLedger() as never,
        createFakePaymentsService() as never,
      );

      await expect(
        service.pay('user_1', 'ms_1', {
          pin: '1234',
          method: 'WALLET',
          monthsCount: 1,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('requires a PIN to already be set', async () => {
      const { prisma, groupMembership, user } = createFakePrisma();
      groupMembership.findUnique.mockResolvedValue({
        userId: 'user_1',
        status: 'ACTIVE',
        group: { pricePerSlotXaf: 2000, ownerId: 'owner_1' },
      });
      user.findUniqueOrThrow.mockResolvedValue({
        pinHash: null,
        isPremium: false,
      });
      const service = new MembershipPaymentsService(
        prisma as never,
        createFakeLedger() as never,
        createFakePaymentsService() as never,
      );

      await expect(
        service.pay('user_1', 'ms_1', {
          pin: '1234',
          method: 'WALLET',
          monthsCount: 1,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects an incorrect PIN', async () => {
      const { prisma, groupMembership, user } = createFakePrisma();
      groupMembership.findUnique.mockResolvedValue({
        userId: 'user_1',
        status: 'ACTIVE',
        group: { pricePerSlotXaf: 2000, ownerId: 'owner_1' },
      });
      user.findUniqueOrThrow.mockResolvedValue({
        pinHash: 'hash',
        isPremium: false,
      });
      verifySecretMock.mockResolvedValue(false);
      const service = new MembershipPaymentsService(
        prisma as never,
        createFakeLedger() as never,
        createFakePaymentsService() as never,
      );

      await expect(
        service.pay('user_1', 'ms_1', {
          pin: '0000',
          method: 'WALLET',
          monthsCount: 1,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a wallet payment when the balance is insufficient', async () => {
      const { prisma, groupMembership, user, wallet } = createFakePrisma();
      groupMembership.findUnique.mockResolvedValue({
        userId: 'user_1',
        status: 'ACTIVE',
        nextPaymentDueAt: null,
        group: { pricePerSlotXaf: 2000, ownerId: 'owner_1' },
      });
      user.findUniqueOrThrow.mockResolvedValue({
        pinHash: 'hash',
        isPremium: false,
      });
      verifySecretMock.mockResolvedValue(true);
      wallet.findUnique.mockResolvedValue({ availableBalanceXaf: 100 });
      const service = new MembershipPaymentsService(
        prisma as never,
        createFakeLedger() as never,
        createFakePaymentsService() as never,
      );

      await expect(
        service.pay('user_1', 'ms_1', {
          pin: '1234',
          method: 'WALLET',
          monthsCount: 1,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('debits the wallet, credits the owner escrow, and advances the next due date', async () => {
      const { prisma, groupMembership, user, wallet, membershipPayment } =
        createFakePrisma();
      groupMembership.findUnique.mockResolvedValue({
        userId: 'user_1',
        status: 'ACTIVE',
        nextPaymentDueAt: null,
        group: { pricePerSlotXaf: 2000, ownerId: 'owner_1' },
      });
      user.findUniqueOrThrow.mockResolvedValue({
        pinHash: 'hash',
        isPremium: false,
      });
      verifySecretMock.mockResolvedValue(true);
      wallet.findUnique.mockResolvedValue({ availableBalanceXaf: 100_000 });
      membershipPayment.create.mockResolvedValue({ id: 'mp_1' });
      membershipPayment.update.mockResolvedValue({
        id: 'mp_1',
        status: 'PAID',
      });
      const ledger = createFakeLedger();
      const service = new MembershipPaymentsService(
        prisma as never,
        ledger as never,
        createFakePaymentsService() as never,
      );

      await service.pay('user_1', 'ms_1', {
        pin: '1234',
        method: 'WALLET',
        monthsCount: 1,
      });

      expect(ledger.postEntries).toHaveBeenCalledWith(
        expect.anything(),
        'MEMBERSHIP_PAYMENT_COLLECTION',
        [
          {
            accountType: 'USER_AVAILABLE',
            entryType: 'PAYMENT_COLLECTED',
            amountXaf: -2350,
            userId: 'user_1',
          },
          {
            accountType: 'USER_ESCROW',
            entryType: 'ESCROW_HOLD',
            amountXaf: 2350,
            userId: 'owner_1',
          },
        ],
        expect.any(String),
      );
    });

    it('requires an operator and msisdn for a mobile money payment', async () => {
      const { prisma, groupMembership, user } = createFakePrisma();
      groupMembership.findUnique.mockResolvedValue({
        userId: 'user_1',
        status: 'ACTIVE',
        nextPaymentDueAt: null,
        group: { pricePerSlotXaf: 2000, ownerId: 'owner_1' },
      });
      user.findUniqueOrThrow.mockResolvedValue({
        pinHash: 'hash',
        isPremium: false,
      });
      verifySecretMock.mockResolvedValue(true);
      const service = new MembershipPaymentsService(
        prisma as never,
        createFakeLedger() as never,
        createFakePaymentsService() as never,
      );

      await expect(
        service.pay('user_1', 'ms_1', {
          pin: '1234',
          method: 'MOBILE_MONEY',
          monthsCount: 1,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('delegates a mobile money payment to PaymentsService.initiateCollection', async () => {
      const { prisma, groupMembership, user, membershipPayment } =
        createFakePrisma();
      groupMembership.findUnique.mockResolvedValue({
        userId: 'user_1',
        status: 'ACTIVE',
        nextPaymentDueAt: null,
        group: { pricePerSlotXaf: 2000, ownerId: 'owner_1' },
      });
      user.findUniqueOrThrow.mockResolvedValue({
        pinHash: 'hash',
        isPremium: false,
      });
      verifySecretMock.mockResolvedValue(true);
      membershipPayment.create.mockResolvedValue({ id: 'mp_1' });
      membershipPayment.findUniqueOrThrow.mockResolvedValue({
        id: 'mp_1',
        status: 'PENDING',
      });
      const payments = createFakePaymentsService();
      const service = new MembershipPaymentsService(
        prisma as never,
        createFakeLedger() as never,
        payments as never,
      );

      await service.pay('user_1', 'ms_1', {
        pin: '1234',
        method: 'MOBILE_MONEY',
        monthsCount: 1,
        operator: 'MTN_MOMO',
        msisdn: '+237612345678',
      });

      expect(payments.initiateCollection).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user_1',
          amountXaf: 2350,
          msisdn: '+237612345678',
          operator: 'MTN_MOMO',
          purpose: 'MEMBERSHIP_PAYMENT',
          membershipPaymentId: 'mp_1',
        }),
      );
    });
  });

  describe('reportNoAccess', () => {
    it('rejects a report from someone other than the payer', async () => {
      const { prisma, membershipPayment } = createFakePrisma();
      membershipPayment.findUnique.mockResolvedValue({
        status: 'PAID',
        membership: { userId: 'other_user', group: { ownerId: 'owner_1' } },
      });
      const service = new MembershipPaymentsService(
        prisma as never,
        createFakeLedger() as never,
        createFakePaymentsService() as never,
      );

      await expect(
        service.reportNoAccess('user_1', 'mp_1', 'Pas accès'),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects a report on a payment that is not PAID', async () => {
      const { prisma, membershipPayment } = createFakePrisma();
      membershipPayment.findUnique.mockResolvedValue({
        status: 'ESCROW_RELEASED',
        membership: { userId: 'user_1', group: { ownerId: 'owner_1' } },
      });
      const service = new MembershipPaymentsService(
        prisma as never,
        createFakeLedger() as never,
        createFakePaymentsService() as never,
      );

      await expect(
        service.reportNoAccess('user_1', 'mp_1', 'Pas accès'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('freezes the payment and opens a dispute against the group owner', async () => {
      const { prisma, membershipPayment, dispute } = createFakePrisma();
      membershipPayment.findUnique.mockResolvedValue({
        status: 'PAID',
        membership: { userId: 'user_1', group: { ownerId: 'owner_1' } },
      });
      const service = new MembershipPaymentsService(
        prisma as never,
        createFakeLedger() as never,
        createFakePaymentsService() as never,
      );

      await service.reportNoAccess('user_1', 'mp_1', 'Pas accès');

      expect(membershipPayment.update).toHaveBeenCalledWith({
        where: { id: 'mp_1' },
        data: { status: 'DISPUTED' },
      });
      expect(dispute.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          raisedById: 'user_1',
          againstId: 'owner_1',
          relatedEntityType: 'MEMBERSHIP_PAYMENT',
          membershipPaymentId: 'mp_1',
          reason: 'Pas accès',
        }),
      });
    });
  });
});
