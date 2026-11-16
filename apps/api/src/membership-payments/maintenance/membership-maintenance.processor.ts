import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { LedgerService } from '../../ledger/ledger.service';
import { PrismaService } from '../../prisma/prisma.service';
import { SmsService } from '../../sms/sms.service';
import { MEMBERSHIP_MAINTENANCE_QUEUE } from '../membership-payments.constants';

function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

const REMINDER_DAYS_BEFORE_DUE = 3;

@Processor(MEMBERSHIP_MAINTENANCE_QUEUE)
export class MembershipMaintenanceProcessor extends WorkerHost {
  private readonly logger = new Logger(MembershipMaintenanceProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly sms: SmsService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name === 'remind-upcoming-payments') {
      return this.remindUpcomingPayments();
    }
    if (job.name === 'release-membership-escrow') {
      return this.releaseEscrow();
    }
    if (job.name === 'finalize-left-memberships') {
      return this.finalizeLeftMemberships();
    }
  }

  /** Rappel J-3 avant l'échéance de paiement d'un abonnement partagé. */
  private async remindUpcomingPayments(): Promise<void> {
    const windowStart = startOfDay(
      addDays(new Date(), REMINDER_DAYS_BEFORE_DUE),
    );
    const windowEnd = addDays(windowStart, 1);

    const memberships = await this.prisma.groupMembership.findMany({
      where: {
        status: 'ACTIVE',
        nextPaymentDueAt: { gte: windowStart, lt: windowEnd },
        OR: [{ leftAt: null }, { leftAt: { gte: windowEnd } }],
      },
      include: { user: true, group: { include: { service: true } } },
    });

    for (const membership of memberships) {
      try {
        const message =
          membership.user.locale === 'en'
            ? `Pitzaa: your payment for ${membership.group.service.name} is due in 3 days. Open the app to pay.`
            : `Pitzaa : votre paiement pour ${membership.group.service.name} est dû dans 3 jours. Ouvrez l'application pour payer.`;
        await this.sms.send(membership.user.phone, message);
        await this.prisma.notification.create({
          data: {
            userId: membership.userId,
            type: 'PAYMENT_REMINDER',
            channel: 'SMS',
            title: 'Rappel de paiement',
            body: message,
          },
        });
      } catch (error) {
        this.logger.error(
          `Échec du rappel pour l'adhésion ${membership.id}`,
          error as Error,
        );
      }
    }
  }

  /** Libère le séquestre des paiements dont le délai de 48h est écoulé sans litige. */
  private async releaseEscrow(): Promise<void> {
    const duePayments = await this.prisma.membershipPayment.findMany({
      where: { status: 'PAID', escrowReleaseAt: { lte: new Date() } },
      include: { membership: { include: { group: true } } },
      take: 200,
    });

    for (const payment of duePayments) {
      try {
        const ownerId = payment.membership.group.ownerId;
        const netAmount = payment.amountXaf - payment.commissionXaf;

        await this.prisma.$transaction(async (tx) => {
          await this.ledger.postEntries(
            tx,
            'MEMBERSHIP_ESCROW_RELEASE',
            [
              {
                accountType: 'USER_ESCROW',
                entryType: 'ESCROW_RELEASE',
                amountXaf: -payment.amountXaf,
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
                amountXaf: payment.commissionXaf,
              },
            ],
            `Séquestre libéré pour le paiement ${payment.id}`,
          );
          await tx.membershipPayment.update({
            where: { id: payment.id },
            data: { status: 'ESCROW_RELEASED' },
          });
        });
      } catch (error) {
        this.logger.error(
          `Échec de la libération du séquestre pour ${payment.id}`,
          error as Error,
        );
      }
    }
  }

  /** Finalise les sorties de groupe dont la période déjà payée est désormais terminée. */
  private async finalizeLeftMemberships(): Promise<void> {
    await this.prisma.groupMembership.updateMany({
      where: { status: 'ACTIVE', leftAt: { lte: new Date() } },
      data: { status: 'LEFT' },
    });
  }
}
