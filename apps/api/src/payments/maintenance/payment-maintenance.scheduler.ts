import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import { PAYMENT_MAINTENANCE_QUEUE } from '../payments.constants';

const POLL_PENDING_JOB_ID = 'poll-pending-repeat';
const RECONCILE_DAILY_JOB_ID = 'reconcile-daily-repeat';

/**
 * Programme les tâches récurrentes au démarrage : un filet de sécurité qui
 * interroge les paiements en attente (au cas où un webhook serait manqué),
 * et une réconciliation quotidienne qui revérifie les paiements déjà confirmés.
 */
@Injectable()
export class PaymentMaintenanceScheduler implements OnModuleInit {
  constructor(
    @InjectQueue(PAYMENT_MAINTENANCE_QUEUE) private readonly queue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.queue.add(
      'poll-pending',
      {},
      {
        repeat: { every: 30_000 },
        jobId: POLL_PENDING_JOB_ID,
        removeOnComplete: true,
        removeOnFail: true,
      },
    );
    await this.queue.add(
      'reconcile-daily',
      {},
      {
        repeat: { pattern: '0 3 * * *' },
        jobId: RECONCILE_DAILY_JOB_ID,
        removeOnComplete: true,
        removeOnFail: true,
      },
    );
  }
}
