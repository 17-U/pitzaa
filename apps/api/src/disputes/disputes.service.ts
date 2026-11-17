import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Dispute } from '@prisma/client';
import {
  DISPUTE_ARBITRATION_WINDOW_HOURS,
  DISPUTE_RESPONSE_WINDOW_HOURS,
  TRUST_SCORE_DISPUTE_LOST_PENALTY,
  resolveGiftCardMonthlyUsage,
} from '@pitzaa/shared';
import { LedgerService } from '../ledger/ledger.service';
import { filterMessageContent } from '../messaging/content-filter.util';
import { MessagingService } from '../messaging/messaging.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaTransaction } from '../prisma/prisma.types';
import { DisputeOutcome } from './dto/resolve-dispute.dto';

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

@Injectable()
export class DisputesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly messaging: MessagingService,
    private readonly notifications: NotificationsService,
  ) {}

  async createForMembershipPayment(
    userId: string,
    membershipPaymentId: string,
    reason: string,
    evidenceUrls: string[] = [],
  ): Promise<Dispute> {
    const membershipPayment = await this.prisma.membershipPayment.findUnique({
      where: { id: membershipPaymentId },
      include: { membership: { include: { group: true } } },
    });
    if (!membershipPayment || membershipPayment.membership.userId !== userId) {
      throw new NotFoundException('Paiement introuvable.');
    }
    if (membershipPayment.status !== 'PAID') {
      throw new ForbiddenException('Ce paiement ne peut plus être contesté.');
    }

    const ownerId = membershipPayment.membership.group.ownerId;

    const dispute = await this.prisma.$transaction(async (tx) => {
      await tx.membershipPayment.update({
        where: { id: membershipPaymentId },
        data: { status: 'DISPUTED' },
      });

      const created = await tx.dispute.create({
        data: {
          raisedById: userId,
          againstId: ownerId,
          relatedEntityType: 'MEMBERSHIP_PAYMENT',
          membershipPaymentId,
          reason,
          evidenceUrls,
          responseDeadlineAt: addHours(
            new Date(),
            DISPUTE_RESPONSE_WINDOW_HOURS,
          ),
        },
      });
      await this.messaging.createConversationForDispute(tx, created.id);
      return created;
    });

    await this.notifications.notify(
      ownerId,
      'DISPUTE_OPENED',
      'Un litige a été ouvert',
      'Un co-abonné signale ne pas avoir accès au service. Vous avez 48h pour répondre.',
    );

    return dispute;
  }

  async createForGiftCardOrder(
    userId: string,
    orderId: string,
    reason: string,
    evidenceUrls: string[] = [],
  ): Promise<Dispute> {
    const order = await this.prisma.giftCardOrder.findUnique({
      where: { id: orderId },
      include: { listing: true },
    });
    if (!order || order.buyerId !== userId) {
      throw new NotFoundException('Commande introuvable.');
    }
    if (order.status !== 'CODE_REVEALED') {
      throw new ForbiddenException(
        'Cette commande ne peut plus être contestée.',
      );
    }

    const sellerId = order.listing.sellerId;

    const dispute = await this.prisma.$transaction(async (tx) => {
      await tx.giftCardOrder.update({
        where: { id: orderId },
        data: { status: 'DISPUTED' },
      });

      const created = await tx.dispute.create({
        data: {
          raisedById: userId,
          againstId: sellerId,
          relatedEntityType: 'GIFT_CARD_ORDER',
          giftCardOrderId: orderId,
          reason,
          evidenceUrls,
          responseDeadlineAt: addHours(
            new Date(),
            DISPUTE_RESPONSE_WINDOW_HOURS,
          ),
        },
      });
      await this.messaging.createConversationForDispute(tx, created.id);
      return created;
    });

    await this.notifications.notify(
      sellerId,
      'DISPUTE_OPENED',
      'Un litige a été ouvert',
      'Un acheteur signale un problème avec le code de la carte cadeau vendue. Vous avez 48h pour répondre.',
    );

    return dispute;
  }

  async respond(
    userId: string,
    disputeId: string,
    message: string,
  ): Promise<Dispute> {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
      include: { conversation: true },
    });
    if (!dispute) {
      throw new NotFoundException('Litige introuvable.');
    }
    if (dispute.againstId !== userId) {
      throw new ForbiddenException(
        'Seule la partie mise en cause peut répondre à ce litige.',
      );
    }
    if (dispute.status !== 'OPEN') {
      throw new BadRequestException('Ce litige n’attend plus de réponse.');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dispute.conversation) {
        const { content, flagged } = filterMessageContent(message);
        await tx.message.create({
          data: {
            conversationId: dispute.conversation.id,
            senderId: userId,
            content,
            originalContent: flagged ? message : null,
            flagged,
          },
        });
      }
      return tx.dispute.update({
        where: { id: disputeId },
        data: {
          status: 'UNDER_ARBITRATION',
          arbitrationDeadlineAt: addHours(
            new Date(),
            DISPUTE_ARBITRATION_WINDOW_HOURS,
          ),
        },
      });
    });

    await this.notifications.notify(
      dispute.raisedById,
      'DISPUTE_OPENED',
      'Réponse reçue',
      'L’autre partie a répondu à votre litige. Il est maintenant soumis à arbitrage.',
    );

    return updated;
  }

  async cancel(userId: string, disputeId: string): Promise<Dispute> {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
    });
    if (!dispute || dispute.raisedById !== userId) {
      throw new NotFoundException('Litige introuvable.');
    }
    if (dispute.status !== 'OPEN') {
      throw new BadRequestException('Ce litige ne peut plus être annulé.');
    }

    return this.prisma.$transaction(async (tx) => {
      if (dispute.membershipPaymentId) {
        await tx.membershipPayment.update({
          where: { id: dispute.membershipPaymentId },
          data: { status: 'PAID' },
        });
      } else if (dispute.giftCardOrderId) {
        await tx.giftCardOrder.update({
          where: { id: dispute.giftCardOrderId },
          data: { status: 'CODE_REVEALED' },
        });
      }
      return tx.dispute.update({
        where: { id: disputeId },
        data: { status: 'CANCELLED' },
      });
    });
  }

  async resolve(
    adminId: string,
    disputeId: string,
    outcome: DisputeOutcome,
    notes: string,
  ): Promise<Dispute> {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
    });
    if (!dispute) {
      throw new NotFoundException('Litige introuvable.');
    }
    if (dispute.status !== 'OPEN' && dispute.status !== 'UNDER_ARBITRATION') {
      throw new BadRequestException('Ce litige est déjà tranché.');
    }

    const loserId = await this.prisma.$transaction(async (tx) => {
      if (dispute.relatedEntityType === 'MEMBERSHIP_PAYMENT') {
        return this.resolveMembershipDispute(tx, dispute, outcome);
      }
      return this.resolveGiftCardDispute(tx, dispute, outcome);
    });

    const resolved = await this.prisma.dispute.update({
      where: { id: disputeId },
      data: {
        status:
          outcome === 'INITIATOR'
            ? 'RESOLVED_FOR_INITIATOR'
            : 'RESOLVED_FOR_COUNTERPARTY',
        resolvedByAdminId: adminId,
        resolvedAt: new Date(),
        resolutionNotes: notes,
      },
    });

    await this.prisma.user.update({
      where: { id: loserId },
      data: { trustScore: { decrement: TRUST_SCORE_DISPUTE_LOST_PENALTY } },
    });

    await Promise.all(
      [dispute.raisedById, dispute.againstId]
        .filter((id): id is string => Boolean(id))
        .map((id) =>
          this.notifications.notify(
            id,
            'DISPUTE_RESOLVED',
            'Litige tranché',
            notes,
          ),
        ),
    );

    return resolved;
  }

  /** Retourne l'id du perdant, après avoir appliqué remboursement ou libération normale. */
  private async resolveMembershipDispute(
    tx: PrismaTransaction,
    dispute: Dispute,
    outcome: DisputeOutcome,
  ): Promise<string> {
    const membershipPayment = await tx.membershipPayment.findUniqueOrThrow({
      where: { id: dispute.membershipPaymentId as string },
      include: { membership: { include: { group: true } } },
    });
    const payerId = membershipPayment.membership.userId;
    const ownerId = membershipPayment.membership.group.ownerId;

    if (outcome === 'INITIATOR') {
      // Le co-abonné avait raison : remboursement intégral, le propriétaire n'a rien gagné.
      await this.ledger.postEntries(
        tx,
        'REFUND',
        [
          {
            accountType: 'USER_ESCROW',
            entryType: 'REFUND',
            amountXaf: -membershipPayment.amountXaf,
            userId: ownerId,
          },
          {
            accountType: 'USER_AVAILABLE',
            entryType: 'REFUND',
            amountXaf: membershipPayment.amountXaf,
            userId: payerId,
          },
        ],
        `Litige résolu en faveur du co-abonné pour le paiement ${membershipPayment.id}`,
      );
      await tx.membershipPayment.update({
        where: { id: membershipPayment.id },
        data: { status: 'REFUNDED' },
      });
      return ownerId;
    }

    // Le propriétaire avait raison : libération normale, comme si aucun litige n'avait eu lieu.
    const netAmount =
      membershipPayment.amountXaf - membershipPayment.commissionXaf;
    await this.ledger.postEntries(
      tx,
      'MEMBERSHIP_ESCROW_RELEASE',
      [
        {
          accountType: 'USER_ESCROW',
          entryType: 'ESCROW_RELEASE',
          amountXaf: -membershipPayment.amountXaf,
          userId: ownerId,
        },
        {
          accountType: 'USER_AVAILABLE',
          entryType: 'ESCROW_RELEASE',
          amountXaf: netAmount,
          userId: ownerId,
        },
        {
          accountType: 'PLATFORM_COMMISSION',
          entryType: 'COMMISSION',
          amountXaf: membershipPayment.commissionXaf,
        },
      ],
      `Litige résolu en faveur du propriétaire pour le paiement ${membershipPayment.id}`,
    );
    await tx.membershipPayment.update({
      where: { id: membershipPayment.id },
      data: { status: 'ESCROW_RELEASED' },
    });
    await tx.user.update({
      where: { id: ownerId },
      data: { lifetimeSalesXaf: { increment: membershipPayment.amountXaf } },
    });
    return payerId;
  }

  private async resolveGiftCardDispute(
    tx: PrismaTransaction,
    dispute: Dispute,
    outcome: DisputeOutcome,
  ): Promise<string> {
    const order = await tx.giftCardOrder.findUniqueOrThrow({
      where: { id: dispute.giftCardOrderId as string },
      include: { listing: true },
    });
    const buyerId = order.buyerId;
    const sellerId = order.listing.sellerId;

    if (outcome === 'INITIATOR') {
      // L'acheteur avait raison (code invalide/inutilisable) : remboursement intégral.
      await this.ledger.postEntries(
        tx,
        'REFUND',
        [
          {
            accountType: 'USER_ESCROW',
            entryType: 'REFUND',
            amountXaf: -order.pricePaidXaf,
            userId: sellerId,
          },
          {
            accountType: 'USER_AVAILABLE',
            entryType: 'REFUND',
            amountXaf: order.pricePaidXaf,
            userId: buyerId,
          },
        ],
        `Litige résolu en faveur de l'acheteur pour la commande ${order.id}`,
      );
      await tx.giftCardOrder.update({
        where: { id: order.id },
        data: { status: 'REFUNDED' },
      });
      return sellerId;
    }

    // Le vendeur avait raison : libération normale.
    const netAmount = order.pricePaidXaf - order.commissionXaf;
    await this.ledger.postEntries(
      tx,
      'GIFT_CARD_ESCROW_RELEASE',
      [
        {
          accountType: 'USER_ESCROW',
          entryType: 'ESCROW_RELEASE',
          amountXaf: -order.pricePaidXaf,
          userId: sellerId,
        },
        {
          accountType: 'USER_AVAILABLE',
          entryType: 'ESCROW_RELEASE',
          amountXaf: netAmount,
          userId: sellerId,
        },
        {
          accountType: 'PLATFORM_COMMISSION',
          entryType: 'COMMISSION',
          amountXaf: order.commissionXaf,
        },
      ],
      `Litige résolu en faveur du vendeur pour la commande ${order.id}`,
    );
    await tx.giftCardOrder.update({
      where: { id: order.id },
      data: { status: 'ESCROW_RELEASED' },
    });

    const seller = await tx.user.findUniqueOrThrow({ where: { id: sellerId } });
    const usage = resolveGiftCardMonthlyUsage(
      seller.giftCardSalesCurrentMonthXaf,
      seller.giftCardSalesMonthStartAt,
    );
    await tx.user.update({
      where: { id: sellerId },
      data: {
        lifetimeSalesXaf: { increment: order.pricePaidXaf },
        giftCardSalesCurrentMonthXaf:
          usage.currentAmountXaf + order.pricePaidXaf,
        giftCardSalesMonthStartAt: usage.windowStartAt,
      },
    });
    return buyerId;
  }

  listMine(userId: string) {
    return this.prisma.dispute.findMany({
      where: { OR: [{ raisedById: userId }, { againstId: userId }] },
      include: { conversation: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  listPendingForAdmin() {
    return this.prisma.dispute.findMany({
      where: { status: { in: ['OPEN', 'UNDER_ARBITRATION'] } },
      include: { conversation: true },
      orderBy: { createdAt: 'asc' },
    });
  }
}
