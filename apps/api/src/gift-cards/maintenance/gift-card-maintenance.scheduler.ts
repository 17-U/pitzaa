import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import { GIFT_CARD_MAINTENANCE_QUEUE } from '../gift-cards.constants';

/** Libère le séquestre des commandes dont le délai de 72h après révélation est écoulé. */
@Injectable()
export class GiftCardMaintenanceScheduler implements OnModuleInit {
  constructor(
    @InjectQueue(GIFT_CARD_MAINTENANCE_QUEUE) private readonly queue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.queue.add(
      'release-gift-card-escrow',
      {},
      {
        repeat: { every: 3_600_000 },
        jobId: 'release-gift-card-escrow-repeat',
        removeOnComplete: true,
        removeOnFail: true,
      },
    );
  }
}
