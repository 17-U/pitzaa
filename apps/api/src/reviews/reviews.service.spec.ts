import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ReviewsService } from './reviews.service';

function createFakePrisma() {
  const review = {
    create: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
  };
  const membershipPayment = { findUnique: jest.fn() };
  const giftCardOrder = { findUnique: jest.fn() };
  const user = { update: jest.fn() };

  const tx = { review, user };
  const prisma = {
    review,
    membershipPayment,
    giftCardOrder,
    user,
    $transaction: jest.fn((callback: (t: typeof tx) => Promise<unknown>) =>
      callback(tx),
    ),
  };

  return { prisma, review, membershipPayment, giftCardOrder, user };
}

describe('ReviewsService', () => {
  describe('create', () => {
    it('rejects a review that references neither a membership payment nor a gift card order', async () => {
      const { prisma } = createFakePrisma();
      const service = new ReviewsService(prisma as never);

      await expect(service.create('user_1', { rating: 5 })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects a review that references both at once', async () => {
      const { prisma } = createFakePrisma();
      const service = new ReviewsService(prisma as never);

      await expect(
        service.create('user_1', {
          rating: 5,
          membershipPaymentId: 'mp_1',
          giftCardOrderId: 'order_1',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a review on a membership payment that is not yet concluded', async () => {
      const { prisma, membershipPayment } = createFakePrisma();
      membershipPayment.findUnique.mockResolvedValue({
        status: 'PAID',
        membership: { userId: 'payer_1', group: { ownerId: 'owner_1' } },
      });
      const service = new ReviewsService(prisma as never);

      await expect(
        service.create('payer_1', { rating: 5, membershipPaymentId: 'mp_1' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects a reviewer who is not part of the transaction', async () => {
      const { prisma, membershipPayment } = createFakePrisma();
      membershipPayment.findUnique.mockResolvedValue({
        status: 'ESCROW_RELEASED',
        membership: { userId: 'payer_1', group: { ownerId: 'owner_1' } },
      });
      const service = new ReviewsService(prisma as never);

      await expect(
        service.create('stranger_1', {
          rating: 5,
          membershipPaymentId: 'mp_1',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects a duplicate review for the same transaction', async () => {
      const { prisma, membershipPayment, review } = createFakePrisma();
      membershipPayment.findUnique.mockResolvedValue({
        status: 'ESCROW_RELEASED',
        membership: { userId: 'payer_1', group: { ownerId: 'owner_1' } },
      });
      review.findFirst.mockResolvedValue({ id: 'existing_review' });
      const service = new ReviewsService(prisma as never);

      await expect(
        service.create('payer_1', { rating: 5, membershipPaymentId: 'mp_1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates the review targeting the other party and bumps their trust score', async () => {
      const { prisma, membershipPayment, review, user } = createFakePrisma();
      membershipPayment.findUnique.mockResolvedValue({
        status: 'ESCROW_RELEASED',
        membership: { userId: 'payer_1', group: { ownerId: 'owner_1' } },
      });
      review.findFirst.mockResolvedValue(null);
      review.create.mockResolvedValue({ id: 'review_1' });
      const service = new ReviewsService(prisma as never);

      await service.create('payer_1', {
        rating: 5,
        membershipPaymentId: 'mp_1',
        comment: 'Au top',
      });

      expect(review.create).toHaveBeenCalledWith({
        data: {
          authorId: 'payer_1',
          targetId: 'owner_1',
          membershipPaymentId: 'mp_1',
          giftCardOrderId: undefined,
          rating: 5,
          comment: 'Au top',
        },
      });
      expect(user.update).toHaveBeenCalledWith({
        where: { id: 'owner_1' },
        data: { trustScore: { increment: 4 } },
      });
    });

    it('resolves the target from the other side of a gift card order', async () => {
      const { prisma, giftCardOrder, review } = createFakePrisma();
      giftCardOrder.findUnique.mockResolvedValue({
        status: 'ESCROW_RELEASED',
        buyerId: 'buyer_1',
        listing: { sellerId: 'seller_1' },
      });
      review.findFirst.mockResolvedValue(null);
      review.create.mockResolvedValue({ id: 'review_1' });
      const service = new ReviewsService(prisma as never);

      await service.create('seller_1', {
        rating: 2,
        giftCardOrderId: 'order_1',
      });

      expect(review.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          authorId: 'seller_1',
          targetId: 'buyer_1',
        }),
      });
    });
  });

  describe('getSummaryForUser', () => {
    it('computes the average rating and returns the reviews', async () => {
      const { prisma, review } = createFakePrisma();
      review.findMany.mockResolvedValue([{ rating: 5 }, { rating: 3 }]);
      const service = new ReviewsService(prisma as never);

      const summary = await service.getSummaryForUser('user_1');

      expect(summary).toEqual({
        reviewsCount: 2,
        averageRating: 4,
        reviews: [{ rating: 5 }, { rating: 3 }],
      });
    });

    it('returns a null average when there are no reviews yet', async () => {
      const { prisma, review } = createFakePrisma();
      review.findMany.mockResolvedValue([]);
      const service = new ReviewsService(prisma as never);

      const summary = await service.getSummaryForUser('user_1');

      expect(summary).toEqual({
        reviewsCount: 0,
        averageRating: null,
        reviews: [],
      });
    });
  });
});
