import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { PAYMENT_MAINTENANCE_QUEUE } from '../payments.constants';
import { PaymentsService } from '../payments.service';
import { PaymentProviderRegistry } from '../providers/payment-provider.registry';

@Processor(PAYMENT_MAINTENANCE_QUEUE)
export class PaymentMaintenanceProcessor extends WorkerHost {
  private readonly logger = new Logger(PaymentMaintenanceProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentsService: PaymentsService,
    private readonly providerRegistry: PaymentProviderRegistry,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name === 'poll-pending') {
      return this.pollPending();
    }
    if (job.name === 'reconcile-daily') {
      return this.reconcileDaily();
    }
  }

  /** Filet de sécurité : confirme les paiements en attente au cas où un webhook aurait été manqué. */
  private async pollPending(): Promise<void> {
    const pending = await this.prisma.payment.findMany({
      where: { status: 'PENDING', providerReference: { not: null } },
      take: 100,
    });

    for (const payment of pending) {
      try {
        await this.paymentsService.confirmPendingPayment(payment.id);
      } catch (error) {
        this.logger.error(
          `Échec du polling pour le paiement ${payment.id}`,
          error as Error,
        );
      }
    }
  }

  /** Revérifie chaque paiement déjà confirmé auprès du fournisseur et journalise les écarts. */
  private async reconcileDaily(): Promise<void> {
    const succeeded = await this.prisma.payment.findMany({
      where: { status: 'SUCCEEDED', providerReference: { not: null } },
      take: 500,
    });

    for (const payment of succeeded) {
      try {
        const statusResult = await this.providerRegistry
          .get(payment.provider)
          .getStatus(payment.providerReference as string);

        if (statusResult.status !== 'SUCCEEDED') {
          await this.prisma.auditLog.create({
            data: {
              action: 'RECONCILIATION_DISCREPANCY',
              entityType: 'Payment',
              entityId: payment.id,
              metadata: {
                expected: 'SUCCEEDED',
                actual: statusResult.status,
                provider: payment.provider,
              },
            },
          });
          this.logger.warn(
            `Écart de réconciliation sur le paiement ${payment.id} : ${statusResult.status}`,
          );
        }
      } catch (error) {
        this.logger.error(
          `Échec de la réconciliation pour le paiement ${payment.id}`,
          error as Error,
        );
      }
    }
  }
}
