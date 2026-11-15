import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PaymentsService } from '../payments.service';
import { PAYMENT_CONFIRMATION_QUEUE } from '../payments.constants';

interface ConfirmJobData {
  paymentId: string;
}

@Processor(PAYMENT_CONFIRMATION_QUEUE)
export class PaymentConfirmationProcessor extends WorkerHost {
  private readonly logger = new Logger(PaymentConfirmationProcessor.name);

  constructor(private readonly paymentsService: PaymentsService) {
    super();
  }

  async process(job: Job<ConfirmJobData>): Promise<void> {
    try {
      await this.paymentsService.confirmPendingPayment(job.data.paymentId);
    } catch (error) {
      this.logger.error(
        `Échec de la confirmation du paiement ${job.data.paymentId}`,
        error as Error,
      );
      throw error;
    }
  }
}
