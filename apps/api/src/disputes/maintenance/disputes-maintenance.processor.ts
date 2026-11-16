import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { DISPUTE_ARBITRATION_WINDOW_HOURS } from '@pitzaa/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { DISPUTES_MAINTENANCE_QUEUE } from '../disputes.constants';

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

@Processor(DISPUTES_MAINTENANCE_QUEUE)
export class DisputesMaintenanceProcessor extends WorkerHost {
  private readonly logger = new Logger(DisputesMaintenanceProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name === 'escalate-overdue-disputes') {
      return this.escalateOverdueDisputes();
    }
  }

  private async escalateOverdueDisputes(): Promise<void> {
    const overdue = await this.prisma.dispute.findMany({
      where: { status: 'OPEN', responseDeadlineAt: { lte: new Date() } },
      take: 200,
    });

    for (const dispute of overdue) {
      try {
        await this.prisma.dispute.updateMany({
          where: { id: dispute.id, status: 'OPEN' },
          data: {
            status: 'UNDER_ARBITRATION',
            arbitrationDeadlineAt: addHours(
              new Date(),
              DISPUTE_ARBITRATION_WINDOW_HOURS,
            ),
          },
        });
      } catch (error) {
        this.logger.error(
          `Échec de l'escalade du litige ${dispute.id}`,
          error as Error,
        );
      }
    }
  }
}
