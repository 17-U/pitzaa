import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { resolveGiftCardMonthlyUsage } from '@pitzaa/shared';
import { LedgerService } from '../../ledger/ledger.service';
import { PrismaService } from '../../prisma/prisma.service';
import { GIFT_CARD_MAINTENANCE_QUEUE } from '../gift-cards.constants';

@Processor(GIFT_CARD_MAINTENANCE_QUEUE)
export class GiftCardMaintenanceProcessor extends WorkerHost {
  private readonly logger = new Logger(GiftCardMaintenanceProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name === 'release-gift-card-escrow') {
      return this.releaseEscrow();
    }
  }

  /** Libère le séquestre des commandes dont le code a été révélé il y a plus de 72h, sans litige. */
  private async releaseEscrow(): Promise<void> {
    const dueOrders = await this.prisma.giftCardOrder.findMany({
      where: { status: 'CODE_REVEALED', escrowReleaseAt: { lte: new Date() } },
      include: { listing: true },
      take: 200,
    });

    for (const order of dueOrders) {
      try {
        const sellerId = order.listing.sellerId;
        const netAmount = order.pricePaidXaf - order.commissionXaf;

        await this.prisma.$transaction(async (tx) => {
          // Idempotence : re-vérifie l'état à l'intérieur de la transaction pour éviter
          // un double traitement si cette tâche se déclenche deux fois en parallèle
          // (planification BullMQ + déclenchement manuel, par exemple).
          const fresh = await tx.giftCardOrder.findUniqueOrThrow({
            where: { id: order.id },
          });
          if (fresh.status !== 'CODE_REVEALED') {
            return;
          }

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
            `Séquestre libéré pour la carte cadeau vendue, commande ${order.id}`,
          );

          await tx.giftCardOrder.update({
            where: { id: order.id },
            data: { status: 'ESCROW_RELEASED' },
          });

          const seller = await tx.user.findUniqueOrThrow({
            where: { id: sellerId },
          });
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
        });
      } catch (error) {
        this.logger.error(
          `Échec de la libération du séquestre pour la commande ${order.id}`,
          error as Error,
        );
      }
    }
  }
}
