import { Injectable } from '@nestjs/common';
import { Notification, NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SmsService } from '../sms/sms.service';

/** Types jugés assez critiques pour justifier un SMS en plus de la notification in-app. */
const SMS_WORTHY_TYPES: NotificationType[] = [
  'DISPUTE_OPENED',
  'DISPUTE_RESOLVED',
  'WITHDRAWAL_STATUS_CHANGED',
];

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sms: SmsService,
  ) {}

  /** Crée une notification in-app et, pour les types critiques, envoie aussi un SMS. */
  async notify(
    userId: string,
    type: NotificationType,
    title: string,
    body: string,
  ): Promise<Notification> {
    const notification = await this.prisma.notification.create({
      data: { userId, type, channel: 'IN_APP', title, body },
    });

    if (SMS_WORTHY_TYPES.includes(type)) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (user) {
        await this.sms.send(user.phone, `Pitzaa — ${title} : ${body}`);
      }
    }

    return notification;
  }

  listMine(userId: string, take = 50) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  async markRead(userId: string, notificationId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { id: notificationId, userId, readAt: null },
      data: { readAt: new Date() },
    });
  }
}
