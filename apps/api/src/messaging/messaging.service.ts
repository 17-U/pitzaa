import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Conversation, Message, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaTransaction } from '../prisma/prisma.types';
import { filterMessageContent } from './content-filter.util';

const ADMIN_ROLES: UserRole[] = ['SUPER_ADMIN', 'MODERATOR', 'SUPPORT'];

@Injectable()
export class MessagingService {
  constructor(private readonly prisma: PrismaService) {}

  createConversationForGroup(
    tx: PrismaTransaction,
    groupId: string,
  ): Promise<Conversation> {
    return tx.conversation.create({ data: { type: 'GROUP', groupId } });
  }

  createConversationForGiftCardOrder(
    tx: PrismaTransaction,
    giftCardOrderId: string,
  ): Promise<Conversation> {
    return tx.conversation.create({
      data: { type: 'TRANSACTION', giftCardOrderId },
    });
  }

  createConversationForDispute(
    tx: PrismaTransaction,
    disputeId: string,
  ): Promise<Conversation> {
    return tx.conversation.create({ data: { type: 'DISPUTE', disputeId } });
  }

  private async assertParticipant(
    userId: string,
    conversationId: string,
  ): Promise<Conversation> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        group: true,
        giftCardOrder: { include: { listing: true } },
        dispute: true,
      },
    });
    if (!conversation) {
      throw new NotFoundException('Conversation introuvable.');
    }

    if (conversation.group) {
      if (conversation.group.ownerId === userId) {
        return conversation;
      }
      const membership = await this.prisma.groupMembership.findUnique({
        where: { groupId_userId: { groupId: conversation.group.id, userId } },
      });
      if (membership && membership.status !== 'REMOVED') {
        return conversation;
      }
    } else if (conversation.giftCardOrder) {
      if (
        conversation.giftCardOrder.buyerId === userId ||
        conversation.giftCardOrder.listing.sellerId === userId
      ) {
        return conversation;
      }
    } else if (conversation.dispute) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (
        conversation.dispute.raisedById === userId ||
        conversation.dispute.againstId === userId ||
        (user && ADMIN_ROLES.includes(user.role))
      ) {
        return conversation;
      }
    }

    throw new ForbiddenException('Vous n’avez pas accès à cette conversation.');
  }

  async postMessage(
    userId: string,
    conversationId: string,
    rawContent: string,
  ): Promise<Message> {
    await this.assertParticipant(userId, conversationId);

    const { content, flagged } = filterMessageContent(rawContent);

    return this.prisma.message.create({
      data: {
        conversationId,
        senderId: userId,
        content,
        originalContent: flagged ? rawContent : null,
        flagged,
      },
    });
  }

  async listMessages(userId: string, conversationId: string) {
    await this.assertParticipant(userId, conversationId);
    return this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });
  }
}
