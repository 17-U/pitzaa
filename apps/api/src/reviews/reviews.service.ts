import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Review } from '@prisma/client';
import { computeReviewTrustImpact } from '@pitzaa/shared';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';

const TERMINAL_MEMBERSHIP_STATUSES = new Set(['ESCROW_RELEASED', 'REFUNDED']);
const TERMINAL_GIFT_CARD_STATUSES = new Set(['ESCROW_RELEASED', 'REFUNDED']);

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(authorId: string, dto: CreateReviewDto): Promise<Review> {
    if (Boolean(dto.membershipPaymentId) === Boolean(dto.giftCardOrderId)) {
      throw new BadRequestException(
        'Précisez exactement un des deux : membershipPaymentId ou giftCardOrderId.',
      );
    }

    const targetId = dto.membershipPaymentId
      ? await this.resolveMembershipTarget(authorId, dto.membershipPaymentId)
      : await this.resolveGiftCardTarget(
          authorId,
          dto.giftCardOrderId as string,
        );

    const existing = await this.prisma.review.findFirst({
      where: {
        authorId,
        membershipPaymentId: dto.membershipPaymentId,
        giftCardOrderId: dto.giftCardOrderId,
      },
    });
    if (existing) {
      throw new BadRequestException(
        'Vous avez déjà laissé un avis pour cette transaction.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const review = await tx.review.create({
        data: {
          authorId,
          targetId,
          membershipPaymentId: dto.membershipPaymentId,
          giftCardOrderId: dto.giftCardOrderId,
          rating: dto.rating,
          comment: dto.comment,
        },
      });

      await tx.user.update({
        where: { id: targetId },
        data: {
          trustScore: { increment: computeReviewTrustImpact(dto.rating) },
        },
      });

      return review;
    });
  }

  private async resolveMembershipTarget(
    authorId: string,
    membershipPaymentId: string,
  ): Promise<string> {
    const payment = await this.prisma.membershipPayment.findUnique({
      where: { id: membershipPaymentId },
      include: { membership: { include: { group: true } } },
    });
    if (!payment || !TERMINAL_MEMBERSHIP_STATUSES.has(payment.status)) {
      throw new NotFoundException('Paiement introuvable ou pas encore conclu.');
    }

    const payerId = payment.membership.userId;
    const ownerId = payment.membership.group.ownerId;
    if (authorId === payerId) {
      return ownerId;
    }
    if (authorId === ownerId) {
      return payerId;
    }
    throw new ForbiddenException(
      'Vous ne faites pas partie de cette transaction.',
    );
  }

  private async resolveGiftCardTarget(
    authorId: string,
    giftCardOrderId: string,
  ): Promise<string> {
    const order = await this.prisma.giftCardOrder.findUnique({
      where: { id: giftCardOrderId },
      include: { listing: true },
    });
    if (!order || !TERMINAL_GIFT_CARD_STATUSES.has(order.status)) {
      throw new NotFoundException(
        'Commande introuvable ou pas encore conclue.',
      );
    }

    const buyerId = order.buyerId;
    const sellerId = order.listing.sellerId;
    if (authorId === buyerId) {
      return sellerId;
    }
    if (authorId === sellerId) {
      return buyerId;
    }
    throw new ForbiddenException(
      'Vous ne faites pas partie de cette transaction.',
    );
  }

  async getSummaryForUser(userId: string) {
    const reviews = await this.prisma.review.findMany({
      where: { targetId: userId },
      orderBy: { createdAt: 'desc' },
    });
    const averageRating =
      reviews.length === 0
        ? null
        : reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
    return { reviewsCount: reviews.length, averageRating, reviews };
  }
}
