import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { LedgerModule } from '../ledger/ledger.module';
import { MessagingModule } from '../messaging/messaging.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { DisputesController } from './disputes.controller';
import { DISPUTES_MAINTENANCE_QUEUE } from './disputes.constants';
import { DisputesService } from './disputes.service';
import { DisputesMaintenanceProcessor } from './maintenance/disputes-maintenance.processor';
import { DisputesMaintenanceScheduler } from './maintenance/disputes-maintenance.scheduler';

@Module({
  imports: [
    LedgerModule,
    MessagingModule,
    NotificationsModule,
    BullModule.registerQueue({ name: DISPUTES_MAINTENANCE_QUEUE }),
  ],
  controllers: [DisputesController],
  providers: [
    DisputesService,
    DisputesMaintenanceScheduler,
    DisputesMaintenanceProcessor,
  ],
  exports: [DisputesService],
})
export class DisputesModule {}
