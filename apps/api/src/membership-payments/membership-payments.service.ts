import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MembershipPayment } from '@prisma/client';
import {
  DISPUTE_RESPONSE_WINDOW_HOURS,
  computeMembershipPaymentAmount,
} from '@pitzaa/shared';
import { verifySecret } from '../common/crypto.util';
import { LedgerService } from '../ledger/ledger.service';
import { PaymentsService } from '../payments/payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { PayMembershipDto } from './dto/pay-membership.dto';

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

@Injectable()
export class MembershipPaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly paymentsService: PaymentsService,
  ) {}

  async pay(
    userId: string,
    membershipId: string,
    dto: PayMembershipDto,
  ): Promise<MembershipPayment> {
    const membership = await this.prisma.groupMembership.findUnique({
      where: { id: membershipId },
      include: { group: true },
    });
    if (!membership || membership.userId !== userId) {
      throw new NotFoundException('Adhésion introuvable.');
    }
    if (membership.status !== 'ACTIVE') {
      throw new BadRequestException('Cette adhésion n’est pas active.');
    }

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    if (!user.pinHash) {
      throw new BadRequestException(
        'Définissez votre PIN Pitzaa avant de payer (POST /auth/me/pin).',
      );
    }
    if (!(await verifySecret(user.pinHash, dto.pin))) {
      throw new BadRequestException('PIN incorrect.');
    }

    const { totalXaf, commissionXaf } = computeMembershipPaymentAmount(
      membership.group.pricePerSlotXaf,
      dto.monthsCount,
      user.isPremium,
    );
    const periodStart = membership.nextPaymentDueAt ?? new Date();
    const periodEnd = addMonths(periodStart, dto.monthsCount);

    if (dto.method === 'WALLET') {
      return this.payFromWallet(
        membership.id,
        membership.group.ownerId,
        userId,
        {
          periodStart,
          periodEnd,
          totalXaf,
          commissionXaf,
        },
      );
    }

    if (!dto.operator || !dto.msisdn) {
      throw new BadRequestException(
        'operator et msisdn sont requis pour un paiement par mobile money.',
      );
    }

    const membershipPayment = await this.prisma.membershipPayment.create({
      data: {
        membershipId: membership.id,
        periodStart,
        periodEnd,
        amountXaf: totalXaf,
        commissionXaf,
      },
    });

    await this.paymentsService.initiateCollection({
      userId,
      amountXaf: totalXaf,
      msisdn: dto.msisdn,
      operator: dto.operator,
      purpose: 'MEMBERSHIP_PAYMENT',
      membershipPaymentId: membershipPayment.id,
      description: `Paiement d'abonnement partagé (${dto.monthsCount} mois)`,
    });

    return this.prisma.membershipPayment.findUniqueOrThrow({
      where: { id: membershipPayment.id },
    });
  }

  private async payFromWallet(
    membershipId: string,
    ownerId: string,
    payerId: string,
    period: {
      periodStart: Date;
      periodEnd: Date;
      totalXaf: number;
      commissionXaf: number;
    },
  ): Promise<MembershipPayment> {
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId: payerId },
    });
    if (!wallet || wallet.availableBalanceXaf < period.totalXaf) {
      throw new BadRequestException(
        'Solde Pitzaa insuffisant pour ce paiement.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const membershipPayment = await tx.membershipPayment.create({
        data: {
          membershipId,
          periodStart: period.periodStart,
          periodEnd: period.periodEnd,
          amountXaf: period.totalXaf,
          commissionXaf: period.commissionXaf,
        },
      });

      await this.ledger.postEntries(
        tx,
        'MEMBERSHIP_PAYMENT_COLLECTION',
        [
          {
            accountType: 'USER_AVAILABLE',
            entryType: 'PAYMENT_COLLECTED',
            amountXaf: -period.totalXaf,
            userId: payerId,
          },
          {
            accountType: 'USER_ESCROW',
            entryType: 'ESCROW_HOLD',
            amountXaf: period.totalXaf,
            userId: ownerId,
          },
        ],
        `Paiement d'abonnement ${membershipPayment.id} depuis le portefeuille`,
      );

      const paid = await tx.membershipPayment.update({
        where: { id: membershipPayment.id },
        data: {
          status: 'PAID',
          paidAt: new Date(),
          escrowReleaseAt: addHours(new Date(), 48),
        },
      });

      await tx.groupMembership.update({
        where: { id: membershipId },
        data: { nextPaymentDueAt: period.periodEnd },
      });

      return paid;
    });
  }

  /** Bouton « Je n'ai pas accès » : gèle le paiement et ouvre un litige. */
  async reportNoAccess(
    userId: string,
    membershipPaymentId: string,
    reason: string,
  ) {
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

    return this.prisma.$transaction(async (tx) => {
      await tx.membershipPayment.update({
        where: { id: membershipPaymentId },
        data: { status: 'DISPUTED' },
      });

      return tx.dispute.create({
        data: {
          raisedById: userId,
          againstId: membershipPayment.membership.group.ownerId,
          relatedEntityType: 'MEMBERSHIP_PAYMENT',
          membershipPaymentId,
          reason,
          responseDeadlineAt: addHours(
            new Date(),
            DISPUTE_RESPONSE_WINDOW_HOURS,
          ),
        },
      });
    });
  }
}
