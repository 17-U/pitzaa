import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { DisputesModule } from '../disputes/disputes.module';
import { LedgerModule } from '../ledger/ledger.module';
import { PaymentsModule } from '../payments/payments.module';
import { SmsModule } from '../sms/sms.module';
import { MembershipMaintenanceProcessor } from './maintenance/membership-maintenance.processor';
import { MembershipMaintenanceScheduler } from './maintenance/membership-maintenance.scheduler';
import { MembershipPaymentsController } from './membership-payments.controller';
import { MEMBERSHIP_MAINTENANCE_QUEUE } from './membership-payments.constants';
import { MembershipPaymentsService } from './membership-payments.service';

@Module({
  imports: [
    LedgerModule,
    PaymentsModule,
    SmsModule,
    DisputesModule,
    BullModule.registerQueue({ name: MEMBERSHIP_MAINTENANCE_QUEUE }),
  ],
  controllers: [MembershipPaymentsController],
  providers: [
    MembershipPaymentsService,
    MembershipMaintenanceScheduler,
    MembershipMaintenanceProcessor,
  ],
  exports: [MembershipPaymentsService],
})
export class MembershipPaymentsModule {}
