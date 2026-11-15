import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { LedgerModule } from '../ledger/ledger.module';
import { PaymentMaintenanceProcessor } from './maintenance/payment-maintenance.processor';
import { PaymentMaintenanceScheduler } from './maintenance/payment-maintenance.scheduler';
import { PaymentRouterService } from './payment-router.service';
import {
  PAYMENT_CONFIRMATION_QUEUE,
  PAYMENT_MAINTENANCE_QUEUE,
} from './payments.constants';
import { PaymentsService } from './payments.service';
import { FapshiProvider } from './providers/fapshi.provider';
import { KPayProvider } from './providers/kpay.provider';
import { MockPaymentProvider } from './providers/mock-payment.provider';
import { PaymentProviderRegistry } from './providers/payment-provider.registry';
import { PaymentConfirmationProcessor } from './webhooks/payment-confirmation.processor';
import { WebhooksController } from './webhooks/webhooks.controller';

@Module({
  imports: [
    LedgerModule,
    BullModule.registerQueue(
      { name: PAYMENT_CONFIRMATION_QUEUE },
      { name: PAYMENT_MAINTENANCE_QUEUE },
    ),
  ],
  controllers: [WebhooksController],
  providers: [
    MockPaymentProvider,
    FapshiProvider,
    KPayProvider,
    PaymentProviderRegistry,
    PaymentRouterService,
    PaymentsService,
    PaymentConfirmationProcessor,
    PaymentMaintenanceScheduler,
    PaymentMaintenanceProcessor,
  ],
  exports: [PaymentsService, PaymentRouterService, PaymentProviderRegistry],
})
export class PaymentsModule {}
