import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import { MEMBERSHIP_MAINTENANCE_QUEUE } from '../membership-payments.constants';

/** Programme les tâches récurrentes : rappel J-3, libération d'séquestre, sorties de groupe. */
@Injectable()
export class MembershipMaintenanceScheduler implements OnModuleInit {
  constructor(
    @InjectQueue(MEMBERSHIP_MAINTENANCE_QUEUE) private readonly queue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.queue.add(
      'remind-upcoming-payments',
      {},
      {
        repeat: { pattern: '0 8 * * *' },
        jobId: 'remind-upcoming-payments-repeat',
        removeOnComplete: true,
        removeOnFail: true,
      },
    );
    await this.queue.add(
      'release-membership-escrow',
      {},
      {
        repeat: { every: 3_600_000 },
        jobId: 'release-membership-escrow-repeat',
        removeOnComplete: true,
        removeOnFail: true,
      },
    );
    await this.queue.add(
      'finalize-left-memberships',
      {},
      {
        repeat: { pattern: '0 2 * * *' },
        jobId: 'finalize-left-memberships-repeat',
        removeOnComplete: true,
        removeOnFail: true,
      },
    );
  }
}
