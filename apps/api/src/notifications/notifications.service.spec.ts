import { NotificationsService } from './notifications.service';

function createFakePrisma() {
  const notification = {
    create: jest.fn(),
    findMany: jest.fn(),
    updateMany: jest.fn(),
  };
  const user = { findUnique: jest.fn() };
  const prisma = { notification, user };
  return { prisma, notification, user };
}

function createFakeSms() {
  return { send: jest.fn().mockResolvedValue(undefined) };
}

describe('NotificationsService', () => {
  describe('notify', () => {
    it('creates an in-app notification without sending an SMS for a non-critical type', async () => {
      const { prisma, notification, user } = createFakePrisma();
      notification.create.mockResolvedValue({ id: 'notif_1' });
      const sms = createFakeSms();
      const service = new NotificationsService(prisma as never, sms as never);

      await service.notify('user_1', 'GROUP_JOIN_REQUEST', 'Titre', 'Corps');

      expect(notification.create).toHaveBeenCalledWith({
        data: {
          userId: 'user_1',
          type: 'GROUP_JOIN_REQUEST',
          channel: 'IN_APP',
          title: 'Titre',
          body: 'Corps',
        },
      });
      expect(user.findUnique).not.toHaveBeenCalled();
      expect(sms.send).not.toHaveBeenCalled();
    });

    it('also sends an SMS for a critical type such as DISPUTE_OPENED', async () => {
      const { prisma, notification, user } = createFakePrisma();
      notification.create.mockResolvedValue({ id: 'notif_1' });
      user.findUnique.mockResolvedValue({
        id: 'user_1',
        phone: '+237612345678',
      });
      const sms = createFakeSms();
      const service = new NotificationsService(prisma as never, sms as never);

      await service.notify(
        'user_1',
        'DISPUTE_OPENED',
        'Un litige a été ouvert',
        'Détails',
      );

      expect(sms.send).toHaveBeenCalledWith(
        '+237612345678',
        expect.stringContaining('Un litige a été ouvert'),
      );
    });

    it('skips the SMS when the user cannot be found', async () => {
      const { prisma, notification, user } = createFakePrisma();
      notification.create.mockResolvedValue({ id: 'notif_1' });
      user.findUnique.mockResolvedValue(null);
      const sms = createFakeSms();
      const service = new NotificationsService(prisma as never, sms as never);

      await service.notify(
        'user_1',
        'DISPUTE_RESOLVED',
        'Litige tranché',
        'Détails',
      );

      expect(sms.send).not.toHaveBeenCalled();
    });
  });

  describe('markRead', () => {
    it('only marks a notification read for its own owner', async () => {
      const { prisma, notification } = createFakePrisma();
      const service = new NotificationsService(
        prisma as never,
        createFakeSms() as never,
      );

      await service.markRead('user_1', 'notif_1');

      expect(notification.updateMany).toHaveBeenCalledWith({
        where: { id: 'notif_1', userId: 'user_1', readAt: null },
        data: { readAt: expect.any(Date) },
      });
    });
  });
});
