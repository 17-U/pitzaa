import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import { DISPUTES_MAINTENANCE_QUEUE } from '../disputes.constants';

/** Escalade automatiquement un litige vers l'arbitrage si la partie mise en cause n'a pas répondu à temps. */
@Injectable()
export class DisputesMaintenanceScheduler implements OnModuleInit {
  constructor(
    @InjectQueue(DISPUTES_MAINTENANCE_QUEUE) private readonly queue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.queue.add(
      'escalate-overdue-disputes',
      {},
      {
        repeat: { every: 3_600_000 },
        jobId: 'escalate-overdue-disputes-repeat',
        removeOnComplete: true,
        removeOnFail: true,
      },
    );
  }
}
