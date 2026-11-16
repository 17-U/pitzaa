import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { LedgerModule } from '../ledger/ledger.module';
import { PaymentsModule } from '../payments/payments.module';
import { GiftCardBrandsController } from './gift-card-brands.controller';
import { GiftCardBrandsService } from './gift-card-brands.service';
import { GiftCardListingsController } from './gift-card-listings.controller';
import { GiftCardListingsService } from './gift-card-listings.service';
import { GiftCardOrdersController } from './gift-card-orders.controller';
import { GiftCardOrdersService } from './gift-card-orders.service';
import { GIFT_CARD_MAINTENANCE_QUEUE } from './gift-cards.constants';
import { GiftCardMaintenanceProcessor } from './maintenance/gift-card-maintenance.processor';
import { GiftCardMaintenanceScheduler } from './maintenance/gift-card-maintenance.scheduler';
import { GIFT_CARD_VERIFIER } from './verifiers/gift-card-verifier.interface';
import { ManualGiftCardVerifier } from './verifiers/manual-gift-card-verifier';

@Module({
  imports: [
    LedgerModule,
    PaymentsModule,
    BullModule.registerQueue({ name: GIFT_CARD_MAINTENANCE_QUEUE }),
  ],
  controllers: [
    GiftCardBrandsController,
    GiftCardListingsController,
    GiftCardOrdersController,
  ],
  providers: [
    GiftCardBrandsService,
    GiftCardListingsService,
    GiftCardOrdersService,
    ManualGiftCardVerifier,
    { provide: GIFT_CARD_VERIFIER, useExisting: ManualGiftCardVerifier },
    GiftCardMaintenanceScheduler,
    GiftCardMaintenanceProcessor,
  ],
  exports: [
    GiftCardBrandsService,
    GiftCardListingsService,
    GiftCardOrdersService,
  ],
})
export class GiftCardsModule {}
