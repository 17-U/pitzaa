import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { MessagingService } from './messaging.service';

function createFakePrisma() {
  const conversation = { findUnique: jest.fn(), create: jest.fn() };
  const groupMembership = { findUnique: jest.fn() };
  const user = { findUnique: jest.fn() };
  const message = { create: jest.fn(), findMany: jest.fn() };

  const prisma = { conversation, groupMembership, user, message };
  return { prisma, conversation, groupMembership, user, message };
}

describe('MessagingService', () => {
  describe('postMessage', () => {
    it('rejects a non-member posting into a group conversation', async () => {
      const { prisma, conversation, groupMembership } = createFakePrisma();
      conversation.findUnique.mockResolvedValue({
        id: 'conv_1',
        group: { id: 'grp_1', ownerId: 'owner_1' },
        giftCardOrder: null,
        dispute: null,
      });
      groupMembership.findUnique.mockResolvedValue(null);
      const service = new MessagingService(prisma as never);

      await expect(
        service.postMessage('stranger_1', 'conv_1', 'Bonjour'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows the group owner to post', async () => {
      const { prisma, conversation, message } = createFakePrisma();
      conversation.findUnique.mockResolvedValue({
        id: 'conv_1',
        group: { id: 'grp_1', ownerId: 'owner_1' },
        giftCardOrder: null,
        dispute: null,
      });
      message.create.mockResolvedValue({ id: 'msg_1' });
      const service = new MessagingService(prisma as never);

      await service.postMessage('owner_1', 'conv_1', 'Bonjour à tous');

      expect(message.create).toHaveBeenCalledWith({
        data: {
          conversationId: 'conv_1',
          senderId: 'owner_1',
          content: 'Bonjour à tous',
          originalContent: null,
          flagged: false,
        },
      });
    });

    it('allows an active group member to post', async () => {
      const { prisma, conversation, groupMembership, message } =
        createFakePrisma();
      conversation.findUnique.mockResolvedValue({
        id: 'conv_1',
        group: { id: 'grp_1', ownerId: 'owner_1' },
        giftCardOrder: null,
        dispute: null,
      });
      groupMembership.findUnique.mockResolvedValue({ status: 'ACTIVE' });
      message.create.mockResolvedValue({ id: 'msg_1' });
      const service = new MessagingService(prisma as never);

      await service.postMessage('member_1', 'conv_1', 'Salut');

      expect(message.create).toHaveBeenCalled();
    });

    it('redacts a phone number before storing the message', async () => {
      const { prisma, conversation, message } = createFakePrisma();
      conversation.findUnique.mockResolvedValue({
        id: 'conv_1',
        group: { id: 'grp_1', ownerId: 'owner_1' },
        giftCardOrder: null,
        dispute: null,
      });
      message.create.mockResolvedValue({ id: 'msg_1' });
      const service = new MessagingService(prisma as never);

      await service.postMessage(
        'owner_1',
        'conv_1',
        'Appelez-moi au 0612345678 svp',
      );

      expect(message.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          content: expect.stringContaining('[masqué]'),
          originalContent: 'Appelez-moi au 0612345678 svp',
          flagged: true,
        }),
      });
    });

    it('allows the buyer and seller of a gift card order to post, but no one else', async () => {
      const { prisma, conversation, message } = createFakePrisma();
      conversation.findUnique.mockResolvedValue({
        id: 'conv_2',
        group: null,
        giftCardOrder: {
          buyerId: 'buyer_1',
          listing: { sellerId: 'seller_1' },
        },
        dispute: null,
      });
      message.create.mockResolvedValue({ id: 'msg_1' });
      const service = new MessagingService(prisma as never);

      await service.postMessage('buyer_1', 'conv_2', 'Avez-vous le code ?');
      await service.postMessage('seller_1', 'conv_2', 'Oui, un instant');
      await expect(
        service.postMessage('stranger_1', 'conv_2', 'Je veux voir'),
      ).rejects.toThrow(ForbiddenException);

      expect(message.create).toHaveBeenCalledTimes(2);
    });

    it('allows the raiser, the counterparty and admins to post in a dispute conversation', async () => {
      const { prisma, conversation, user, message } = createFakePrisma();
      conversation.findUnique.mockResolvedValue({
        id: 'conv_3',
        group: null,
        giftCardOrder: null,
        dispute: { raisedById: 'payer_1', againstId: 'owner_1' },
      });
      user.findUnique.mockResolvedValue({ role: 'SUPPORT' });
      message.create.mockResolvedValue({ id: 'msg_1' });
      const service = new MessagingService(prisma as never);

      await service.postMessage(
        'admin_1',
        'conv_3',
        'Nous examinons le litige',
      );

      expect(message.create).toHaveBeenCalled();
    });

    it('rejects when the conversation does not exist', async () => {
      const { prisma, conversation } = createFakePrisma();
      conversation.findUnique.mockResolvedValue(null);
      const service = new MessagingService(prisma as never);

      await expect(
        service.postMessage('user_1', 'missing_conv', 'Bonjour'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
