import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { TRUST_SCORE_DISPUTE_LOST_PENALTY } from '@pitzaa/shared';
import { DisputesService } from './disputes.service';

function createFakePrisma() {
  const membershipPayment = {
    findUnique: jest.fn(),
    update: jest.fn(),
    findUniqueOrThrow: jest.fn(),
  };
  const giftCardOrder = {
    findUnique: jest.fn(),
    update: jest.fn(),
    findUniqueOrThrow: jest.fn(),
  };
  const dispute = {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  };
  const user = { update: jest.fn(), findUniqueOrThrow: jest.fn() };
  const message = { create: jest.fn() };

  const tx = { membershipPayment, giftCardOrder, dispute, user, message };
  const prisma = {
    membershipPayment,
    giftCardOrder,
    dispute,
    user,
    message,
    $transaction: jest.fn((callback: (t: typeof tx) => Promise<unknown>) =>
      callback(tx),
    ),
  };

  return { prisma, membershipPayment, giftCardOrder, dispute, user, message };
}

function createFakeLedger() {
  return { postEntries: jest.fn().mockResolvedValue({ id: 'ltx_1' }) };
}

function createFakeMessaging() {
  return {
    createConversationForDispute: jest.fn().mockResolvedValue(undefined),
  };
}

function createFakeNotifications() {
  return { notify: jest.fn().mockResolvedValue(undefined) };
}

function buildService(
  overrides: Partial<ReturnType<typeof createFakePrisma>> = {},
) {
  const base = createFakePrisma();
  const prisma = { ...base.prisma, ...overrides };
  const ledger = createFakeLedger();
  const messaging = createFakeMessaging();
  const notifications = createFakeNotifications();
  const service = new DisputesService(
    prisma as never,
    ledger as never,
    messaging as never,
    notifications as never,
  );
  return { service, ...base, ledger, messaging, notifications };
}

describe('DisputesService', () => {
  describe('createForMembershipPayment', () => {
    it('rejects when the caller is not the payer', async () => {
      const { service, membershipPayment } = buildService();
      membershipPayment.findUnique.mockResolvedValue({
        status: 'PAID',
        membership: { userId: 'other_user', group: { ownerId: 'owner_1' } },
      });

      await expect(
        service.createForMembershipPayment('user_1', 'mp_1', 'Pas accès'),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects a payment that is not PAID', async () => {
      const { service, membershipPayment } = buildService();
      membershipPayment.findUnique.mockResolvedValue({
        status: 'ESCROW_RELEASED',
        membership: { userId: 'user_1', group: { ownerId: 'owner_1' } },
      });

      await expect(
        service.createForMembershipPayment('user_1', 'mp_1', 'Pas accès'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('freezes the payment, opens a dispute, creates a conversation and notifies the owner', async () => {
      const { service, membershipPayment, dispute, messaging, notifications } =
        buildService();
      membershipPayment.findUnique.mockResolvedValue({
        status: 'PAID',
        membership: { userId: 'user_1', group: { ownerId: 'owner_1' } },
      });
      dispute.create.mockResolvedValue({ id: 'dispute_1' });

      await service.createForMembershipPayment('user_1', 'mp_1', 'Pas accès');

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
      expect(messaging.createConversationForDispute).toHaveBeenCalledWith(
        expect.anything(),
        'dispute_1',
      );
      expect(notifications.notify).toHaveBeenCalledWith(
        'owner_1',
        'DISPUTE_OPENED',
        expect.any(String),
        expect.any(String),
      );
    });
  });

  describe('createForGiftCardOrder', () => {
    it('rejects when the caller is not the buyer', async () => {
      const { service, giftCardOrder } = buildService();
      giftCardOrder.findUnique.mockResolvedValue({
        buyerId: 'other_user',
        status: 'CODE_REVEALED',
        listing: { sellerId: 'seller_1' },
      });

      await expect(
        service.createForGiftCardOrder('buyer_1', 'order_1', 'Code invalide'),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects an order whose code has not been revealed yet', async () => {
      const { service, giftCardOrder } = buildService();
      giftCardOrder.findUnique.mockResolvedValue({
        buyerId: 'buyer_1',
        status: 'PAID',
        listing: { sellerId: 'seller_1' },
      });

      await expect(
        service.createForGiftCardOrder('buyer_1', 'order_1', 'Code invalide'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('respond', () => {
    it('rejects a response from anyone other than the counterparty', async () => {
      const { service, dispute } = buildService();
      dispute.findUnique.mockResolvedValue({
        id: 'dispute_1',
        raisedById: 'user_1',
        againstId: 'owner_1',
        status: 'OPEN',
        conversation: null,
      });

      await expect(
        service.respond('user_1', 'dispute_1', 'Voici ma réponse'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects responding to a dispute that is no longer OPEN', async () => {
      const { service, dispute } = buildService();
      dispute.findUnique.mockResolvedValue({
        id: 'dispute_1',
        raisedById: 'user_1',
        againstId: 'owner_1',
        status: 'UNDER_ARBITRATION',
        conversation: null,
      });

      await expect(
        service.respond('owner_1', 'dispute_1', 'Voici ma réponse'),
      ).rejects.toThrow(BadRequestException);
    });

    it('posts a filtered message, escalates to arbitration and notifies the raiser', async () => {
      const { service, dispute, message, notifications } = buildService();
      dispute.findUnique.mockResolvedValue({
        id: 'dispute_1',
        raisedById: 'user_1',
        againstId: 'owner_1',
        status: 'OPEN',
        conversation: { id: 'conv_1' },
      });
      dispute.update.mockResolvedValue({
        id: 'dispute_1',
        status: 'UNDER_ARBITRATION',
      });

      await service.respond(
        'owner_1',
        'dispute_1',
        'Appelez-moi au 0612345678',
      );

      expect(message.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          conversationId: 'conv_1',
          senderId: 'owner_1',
          content: expect.stringContaining('[masqué]'),
          flagged: true,
        }),
      });
      expect(dispute.update).toHaveBeenCalledWith({
        where: { id: 'dispute_1' },
        data: expect.objectContaining({ status: 'UNDER_ARBITRATION' }),
      });
      expect(notifications.notify).toHaveBeenCalledWith(
        'user_1',
        expect.any(String),
        expect.any(String),
        expect.any(String),
      );
    });
  });

  describe('cancel', () => {
    it('rejects a cancellation from someone other than the raiser', async () => {
      const { service, dispute } = buildService();
      dispute.findUnique.mockResolvedValue({
        id: 'dispute_1',
        raisedById: 'user_1',
        status: 'OPEN',
      });

      await expect(service.cancel('owner_1', 'dispute_1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejects cancelling a dispute that is no longer OPEN', async () => {
      const { service, dispute } = buildService();
      dispute.findUnique.mockResolvedValue({
        id: 'dispute_1',
        raisedById: 'user_1',
        status: 'UNDER_ARBITRATION',
      });

      await expect(service.cancel('user_1', 'dispute_1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('reverts the membership payment to PAID and cancels the dispute', async () => {
      const { service, dispute, membershipPayment } = buildService();
      dispute.findUnique.mockResolvedValue({
        id: 'dispute_1',
        raisedById: 'user_1',
        status: 'OPEN',
        membershipPaymentId: 'mp_1',
        giftCardOrderId: null,
      });
      dispute.update.mockResolvedValue({
        id: 'dispute_1',
        status: 'CANCELLED',
      });

      await service.cancel('user_1', 'dispute_1');

      expect(membershipPayment.update).toHaveBeenCalledWith({
        where: { id: 'mp_1' },
        data: { status: 'PAID' },
      });
      expect(dispute.update).toHaveBeenCalledWith({
        where: { id: 'dispute_1' },
        data: { status: 'CANCELLED' },
      });
    });
  });

  describe('resolve', () => {
    it('rejects resolving a dispute that is already resolved', async () => {
      const { service, dispute } = buildService();
      dispute.findUnique.mockResolvedValue({
        id: 'dispute_1',
        status: 'RESOLVED_FOR_INITIATOR',
      });

      await expect(
        service.resolve('admin_1', 'dispute_1', 'INITIATOR', 'notes'),
      ).rejects.toThrow(BadRequestException);
    });

    it('refunds the payer in full and penalizes the owner when the initiator wins a membership dispute', async () => {
      const {
        service,
        dispute,
        membershipPayment,
        user,
        ledger,
        notifications,
      } = buildService();
      dispute.findUnique.mockResolvedValue({
        id: 'dispute_1',
        status: 'OPEN',
        relatedEntityType: 'MEMBERSHIP_PAYMENT',
        membershipPaymentId: 'mp_1',
        raisedById: 'payer_1',
        againstId: 'owner_1',
      });
      membershipPayment.findUniqueOrThrow.mockResolvedValue({
        id: 'mp_1',
        amountXaf: 2350,
        commissionXaf: 350,
        membership: { userId: 'payer_1', group: { ownerId: 'owner_1' } },
      });
      dispute.update.mockResolvedValue({
        id: 'dispute_1',
        status: 'RESOLVED_FOR_INITIATOR',
      });

      await service.resolve(
        'admin_1',
        'dispute_1',
        'INITIATOR',
        'Preuve acceptée',
      );

      expect(ledger.postEntries).toHaveBeenCalledWith(
        expect.anything(),
        'REFUND',
        [
          {
            accountType: 'USER_ESCROW',
            entryType: 'REFUND',
            amountXaf: -2350,
            userId: 'owner_1',
          },
          {
            accountType: 'USER_AVAILABLE',
            entryType: 'REFUND',
            amountXaf: 2350,
            userId: 'payer_1',
          },
        ],
        expect.any(String),
      );
      expect(membershipPayment.update).toHaveBeenCalledWith({
        where: { id: 'mp_1' },
        data: { status: 'REFUNDED' },
      });
      expect(user.update).toHaveBeenCalledWith({
        where: { id: 'owner_1' },
        data: { trustScore: { decrement: TRUST_SCORE_DISPUTE_LOST_PENALTY } },
      });
      expect(notifications.notify).toHaveBeenCalledTimes(2);
    });

    it('releases escrow normally and penalizes the payer when the counterparty wins a membership dispute', async () => {
      const { service, dispute, membershipPayment, user, ledger } =
        buildService();
      dispute.findUnique.mockResolvedValue({
        id: 'dispute_1',
        status: 'UNDER_ARBITRATION',
        relatedEntityType: 'MEMBERSHIP_PAYMENT',
        membershipPaymentId: 'mp_1',
        raisedById: 'payer_1',
        againstId: 'owner_1',
      });
      membershipPayment.findUniqueOrThrow.mockResolvedValue({
        id: 'mp_1',
        amountXaf: 2350,
        commissionXaf: 350,
        membership: { userId: 'payer_1', group: { ownerId: 'owner_1' } },
      });
      dispute.update.mockResolvedValue({
        id: 'dispute_1',
        status: 'RESOLVED_FOR_COUNTERPARTY',
      });

      await service.resolve(
        'admin_1',
        'dispute_1',
        'COUNTERPARTY',
        'Accès prouvé',
      );

      expect(ledger.postEntries).toHaveBeenCalledWith(
        expect.anything(),
        'MEMBERSHIP_ESCROW_RELEASE',
        [
          {
            accountType: 'USER_ESCROW',
            entryType: 'ESCROW_RELEASE',
            amountXaf: -2350,
            userId: 'owner_1',
          },
          {
            accountType: 'USER_AVAILABLE',
            entryType: 'ESCROW_RELEASE',
            amountXaf: 2000,
            userId: 'owner_1',
          },
          {
            accountType: 'PLATFORM_COMMISSION',
            entryType: 'COMMISSION',
            amountXaf: 350,
          },
        ],
        expect.any(String),
      );
      expect(user.update).toHaveBeenCalledWith({
        where: { id: 'payer_1' },
        data: { trustScore: { decrement: TRUST_SCORE_DISPUTE_LOST_PENALTY } },
      });
    });

    it('refunds the buyer in full when the initiator wins a gift card dispute', async () => {
      const { service, dispute, giftCardOrder, user, ledger } = buildService();
      dispute.findUnique.mockResolvedValue({
        id: 'dispute_1',
        status: 'OPEN',
        relatedEntityType: 'GIFT_CARD_ORDER',
        giftCardOrderId: 'order_1',
        raisedById: 'buyer_1',
        againstId: 'seller_1',
      });
      giftCardOrder.findUniqueOrThrow.mockResolvedValue({
        id: 'order_1',
        pricePaidXaf: 10_000,
        commissionXaf: 800,
        buyerId: 'buyer_1',
        listing: { sellerId: 'seller_1' },
      });
      dispute.update.mockResolvedValue({
        id: 'dispute_1',
        status: 'RESOLVED_FOR_INITIATOR',
      });

      await service.resolve(
        'admin_1',
        'dispute_1',
        'INITIATOR',
        'Code invalide confirmé',
      );

      expect(ledger.postEntries).toHaveBeenCalledWith(
        expect.anything(),
        'REFUND',
        [
          {
            accountType: 'USER_ESCROW',
            entryType: 'REFUND',
            amountXaf: -10_000,
            userId: 'seller_1',
          },
          {
            accountType: 'USER_AVAILABLE',
            entryType: 'REFUND',
            amountXaf: 10_000,
            userId: 'buyer_1',
          },
        ],
        expect.any(String),
      );
      expect(giftCardOrder.update).toHaveBeenCalledWith({
        where: { id: 'order_1' },
        data: { status: 'REFUNDED' },
      });
      expect(user.update).toHaveBeenCalledWith({
        where: { id: 'seller_1' },
        data: { trustScore: { decrement: TRUST_SCORE_DISPUTE_LOST_PENALTY } },
      });
    });
  });
});
