import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { GroupMembership, SubscriptionGroup } from '@prisma/client';
import { MessagingService } from '../messaging/messaging.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';

@Injectable()
export class GroupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly messaging: MessagingService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(
    ownerId: string,
    dto: CreateGroupDto,
  ): Promise<SubscriptionGroup> {
    const service = await this.prisma.service.findUnique({
      where: { id: dto.serviceId },
    });
    if (!service || !service.allowsSharing) {
      throw new BadRequestException('Ce service ne permet pas le partage.');
    }
    if (dto.totalSlots > service.maxSlots) {
      throw new BadRequestException(
        `Ce service autorise au maximum ${service.maxSlots} places.`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const group = await tx.subscriptionGroup.create({
        data: {
          serviceId: dto.serviceId,
          ownerId,
          pricePerSlotXaf: dto.pricePerSlotXaf,
          totalSlots: dto.totalSlots,
          visibility: dto.visibility ?? 'PRIVATE',
          autoAcceptJoinRequests: dto.autoAcceptJoinRequests ?? false,
        },
      });
      await this.messaging.createConversationForGroup(tx, group.id);
      return group;
    });
  }

  listPublic(serviceId?: string) {
    return this.prisma.subscriptionGroup.findMany({
      where: { visibility: 'PUBLIC', status: 'ACTIVE', serviceId },
      include: {
        service: true,
        _count: { select: { memberships: { where: { status: 'ACTIVE' } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listMine(userId: string) {
    const [owned, joined] = await Promise.all([
      this.prisma.subscriptionGroup.findMany({
        where: { ownerId: userId },
        include: { service: true },
      }),
      this.prisma.subscriptionGroup.findMany({
        where: {
          memberships: {
            some: { userId, status: { in: ['PENDING', 'ACTIVE'] } },
          },
        },
        include: { service: true },
      }),
    ]);
    return { owned, joined };
  }

  async getById(id: string) {
    const group = await this.prisma.subscriptionGroup.findUnique({
      where: { id },
      include: { service: true, memberships: true, conversation: true },
    });
    if (!group) {
      throw new NotFoundException('Groupe introuvable.');
    }
    return group;
  }

  private async getOwnedGroup(
    ownerId: string,
    groupId: string,
  ): Promise<SubscriptionGroup> {
    const group = await this.prisma.subscriptionGroup.findUnique({
      where: { id: groupId },
    });
    if (!group) {
      throw new NotFoundException('Groupe introuvable.');
    }
    if (group.ownerId !== ownerId) {
      throw new ForbiddenException(
        'Seul le propriétaire du groupe peut effectuer cette action.',
      );
    }
    return group;
  }

  async update(
    ownerId: string,
    groupId: string,
    dto: UpdateGroupDto,
  ): Promise<SubscriptionGroup> {
    await this.getOwnedGroup(ownerId, groupId);
    return this.prisma.subscriptionGroup.update({
      where: { id: groupId },
      data: dto,
    });
  }

  async close(ownerId: string, groupId: string): Promise<SubscriptionGroup> {
    await this.getOwnedGroup(ownerId, groupId);
    return this.prisma.subscriptionGroup.update({
      where: { id: groupId },
      data: { status: 'CLOSED' },
    });
  }

  async requestJoin(userId: string, groupId: string): Promise<GroupMembership> {
    const group = await this.prisma.subscriptionGroup.findUnique({
      where: { id: groupId },
    });
    if (!group || group.status !== 'ACTIVE') {
      throw new NotFoundException('Groupe introuvable ou fermé.');
    }
    if (group.ownerId === userId) {
      throw new BadRequestException(
        'Le propriétaire ne peut pas rejoindre son propre groupe.',
      );
    }

    const existing = await this.prisma.groupMembership.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    if (
      existing &&
      (existing.status === 'ACTIVE' || existing.status === 'PENDING')
    ) {
      throw new BadRequestException(
        'Une adhésion est déjà en cours pour ce groupe.',
      );
    }

    if (group.autoAcceptJoinRequests) {
      await this.assertHasCapacity(groupId, group.totalSlots);
      const now = new Date();
      return this.prisma.groupMembership.upsert({
        where: { groupId_userId: { groupId, userId } },
        create: {
          groupId,
          userId,
          status: 'ACTIVE',
          joinedAt: now,
          nextPaymentDueAt: now,
        },
        update: {
          status: 'ACTIVE',
          joinedAt: now,
          nextPaymentDueAt: now,
          leftAt: null,
        },
      });
    }

    const membership = await this.prisma.groupMembership.upsert({
      where: { groupId_userId: { groupId, userId } },
      create: { groupId, userId, status: 'PENDING' },
      update: { status: 'PENDING', leftAt: null },
    });

    await this.notifications.notify(
      group.ownerId,
      'GROUP_JOIN_REQUEST',
      'Nouvelle demande d’adhésion',
      'Un utilisateur souhaite rejoindre votre groupe.',
    );

    return membership;
  }

  private async assertHasCapacity(
    groupId: string,
    totalSlots: number,
  ): Promise<void> {
    const activeCount = await this.prisma.groupMembership.count({
      where: { groupId, status: 'ACTIVE' },
    });
    if (activeCount >= totalSlots) {
      throw new BadRequestException('Ce groupe est complet.');
    }
  }

  private async getPendingMembershipOwnedBy(
    ownerId: string,
    membershipId: string,
  ): Promise<GroupMembership> {
    const membership = await this.prisma.groupMembership.findUnique({
      where: { id: membershipId },
      include: { group: true },
    });
    if (!membership) {
      throw new NotFoundException('Demande introuvable.');
    }
    if (membership.group.ownerId !== ownerId) {
      throw new ForbiddenException(
        'Seul le propriétaire du groupe peut traiter cette demande.',
      );
    }
    if (membership.status !== 'PENDING') {
      throw new BadRequestException('Cette demande a déjà été traitée.');
    }
    return membership;
  }

  async acceptJoinRequest(
    ownerId: string,
    membershipId: string,
  ): Promise<GroupMembership> {
    const membership = await this.getPendingMembershipOwnedBy(
      ownerId,
      membershipId,
    );
    const group = await this.prisma.subscriptionGroup.findUniqueOrThrow({
      where: { id: membership.groupId },
    });
    await this.assertHasCapacity(membership.groupId, group.totalSlots);

    const now = new Date();
    const accepted = await this.prisma.groupMembership.update({
      where: { id: membershipId },
      data: { status: 'ACTIVE', joinedAt: now, nextPaymentDueAt: now },
    });

    await this.notifications.notify(
      accepted.userId,
      'GROUP_JOIN_ACCEPTED',
      'Votre demande a été acceptée',
      'Vous faites maintenant partie du groupe.',
    );

    return accepted;
  }

  async rejectJoinRequest(
    ownerId: string,
    membershipId: string,
  ): Promise<GroupMembership> {
    const membership = await this.getPendingMembershipOwnedBy(
      ownerId,
      membershipId,
    );
    return this.prisma.groupMembership.update({
      where: { id: membership.id },
      data: { status: 'REMOVED', leftAt: new Date() },
    });
  }

  /** Sortie sans engagement : effective à la fin de la période déjà payée. */
  async leave(userId: string, membershipId: string): Promise<GroupMembership> {
    const membership = await this.prisma.groupMembership.findUnique({
      where: { id: membershipId },
    });
    if (!membership || membership.userId !== userId) {
      throw new NotFoundException('Adhésion introuvable.');
    }
    if (membership.status !== 'ACTIVE') {
      throw new BadRequestException('Cette adhésion n’est pas active.');
    }

    const now = new Date();
    if (membership.nextPaymentDueAt && membership.nextPaymentDueAt > now) {
      // Reste membre jusqu'à la fin de la période déjà payée.
      return this.prisma.groupMembership.update({
        where: { id: membershipId },
        data: { leftAt: membership.nextPaymentDueAt },
      });
    }

    return this.prisma.groupMembership.update({
      where: { id: membershipId },
      data: { status: 'LEFT', leftAt: now },
    });
  }
}
