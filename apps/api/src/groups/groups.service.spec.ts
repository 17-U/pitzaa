import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { GroupsService } from './groups.service';

function createFakePrisma() {
  const service = { findUnique: jest.fn() };
  const subscriptionGroup = {
    create: jest.fn(),
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    update: jest.fn(),
  };
  const groupMembership = {
    findUnique: jest.fn(),
    upsert: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
  };

  const prisma = { service, subscriptionGroup, groupMembership };
  return { prisma, service, subscriptionGroup, groupMembership };
}

describe('GroupsService', () => {
  describe('create', () => {
    it('rejects a service that does not allow sharing', async () => {
      const { prisma, service } = createFakePrisma();
      service.findUnique.mockResolvedValue({
        allowsSharing: false,
        maxSlots: 4,
      });
      const groups = new GroupsService(prisma as never);

      await expect(
        groups.create('owner_1', {
          serviceId: 'svc_1',
          pricePerSlotXaf: 2000,
          totalSlots: 2,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a totalSlots above the service maximum', async () => {
      const { prisma, service } = createFakePrisma();
      service.findUnique.mockResolvedValue({
        allowsSharing: true,
        maxSlots: 4,
      });
      const groups = new GroupsService(prisma as never);

      await expect(
        groups.create('owner_1', {
          serviceId: 'svc_1',
          pricePerSlotXaf: 2000,
          totalSlots: 5,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates a private group with auto-accept disabled by default', async () => {
      const { prisma, service, subscriptionGroup } = createFakePrisma();
      service.findUnique.mockResolvedValue({
        allowsSharing: true,
        maxSlots: 4,
      });
      subscriptionGroup.create.mockResolvedValue({ id: 'grp_1' });
      const groups = new GroupsService(prisma as never);

      await groups.create('owner_1', {
        serviceId: 'svc_1',
        pricePerSlotXaf: 2000,
        totalSlots: 3,
      });

      expect(subscriptionGroup.create).toHaveBeenCalledWith({
        data: {
          serviceId: 'svc_1',
          ownerId: 'owner_1',
          pricePerSlotXaf: 2000,
          totalSlots: 3,
          visibility: 'PRIVATE',
          autoAcceptJoinRequests: false,
        },
      });
    });
  });

  describe('requestJoin', () => {
    it('rejects the owner joining their own group', async () => {
      const { prisma, subscriptionGroup } = createFakePrisma();
      subscriptionGroup.findUnique.mockResolvedValue({
        id: 'grp_1',
        status: 'ACTIVE',
        ownerId: 'owner_1',
      });
      const groups = new GroupsService(prisma as never);

      await expect(groups.requestJoin('owner_1', 'grp_1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects a duplicate pending or active request', async () => {
      const { prisma, subscriptionGroup, groupMembership } = createFakePrisma();
      subscriptionGroup.findUnique.mockResolvedValue({
        id: 'grp_1',
        status: 'ACTIVE',
        ownerId: 'owner_1',
      });
      groupMembership.findUnique.mockResolvedValue({ status: 'ACTIVE' });
      const groups = new GroupsService(prisma as never);

      await expect(groups.requestJoin('user_1', 'grp_1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('activates the membership immediately when the group auto-accepts', async () => {
      const { prisma, subscriptionGroup, groupMembership } = createFakePrisma();
      subscriptionGroup.findUnique.mockResolvedValue({
        id: 'grp_1',
        status: 'ACTIVE',
        ownerId: 'owner_1',
        autoAcceptJoinRequests: true,
        totalSlots: 3,
      });
      groupMembership.findUnique.mockResolvedValue(null);
      groupMembership.count.mockResolvedValue(1);
      groupMembership.upsert.mockResolvedValue({ status: 'ACTIVE' });
      const groups = new GroupsService(prisma as never);

      await groups.requestJoin('user_1', 'grp_1');

      const call = groupMembership.upsert.mock.calls[0][0];
      expect(call.create.status).toBe('ACTIVE');
      expect(call.create.nextPaymentDueAt).toBeInstanceOf(Date);
    });

    it('rejects an auto-accept join when the group is already full', async () => {
      const { prisma, subscriptionGroup, groupMembership } = createFakePrisma();
      subscriptionGroup.findUnique.mockResolvedValue({
        id: 'grp_1',
        status: 'ACTIVE',
        ownerId: 'owner_1',
        autoAcceptJoinRequests: true,
        totalSlots: 2,
      });
      groupMembership.findUnique.mockResolvedValue(null);
      groupMembership.count.mockResolvedValue(2);
      const groups = new GroupsService(prisma as never);

      await expect(groups.requestJoin('user_1', 'grp_1')).rejects.toThrow(
        BadRequestException,
      );
      expect(groupMembership.upsert).not.toHaveBeenCalled();
    });

    it('leaves the request PENDING when the group does not auto-accept', async () => {
      const { prisma, subscriptionGroup, groupMembership } = createFakePrisma();
      subscriptionGroup.findUnique.mockResolvedValue({
        id: 'grp_1',
        status: 'ACTIVE',
        ownerId: 'owner_1',
        autoAcceptJoinRequests: false,
        totalSlots: 2,
      });
      groupMembership.findUnique.mockResolvedValue(null);
      groupMembership.upsert.mockResolvedValue({ status: 'PENDING' });
      const groups = new GroupsService(prisma as never);

      await groups.requestJoin('user_1', 'grp_1');

      expect(groupMembership.upsert).toHaveBeenCalledWith({
        where: { groupId_userId: { groupId: 'grp_1', userId: 'user_1' } },
        create: { groupId: 'grp_1', userId: 'user_1', status: 'PENDING' },
        update: { status: 'PENDING', leftAt: null },
      });
    });
  });

  describe('acceptJoinRequest / rejectJoinRequest', () => {
    it('rejects acceptance from someone other than the group owner', async () => {
      const { prisma, groupMembership } = createFakePrisma();
      groupMembership.findUnique.mockResolvedValue({
        id: 'ms_1',
        status: 'PENDING',
        groupId: 'grp_1',
        group: { ownerId: 'owner_1' },
      });
      const groups = new GroupsService(prisma as never);

      await expect(
        groups.acceptJoinRequest('not_owner', 'ms_1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects acceptance once the group is already full', async () => {
      const { prisma, subscriptionGroup, groupMembership } = createFakePrisma();
      groupMembership.findUnique.mockResolvedValue({
        id: 'ms_1',
        status: 'PENDING',
        groupId: 'grp_1',
        group: { ownerId: 'owner_1' },
      });
      subscriptionGroup.findUniqueOrThrow.mockResolvedValue({
        id: 'grp_1',
        totalSlots: 1,
      });
      groupMembership.count.mockResolvedValue(1);
      const groups = new GroupsService(prisma as never);

      await expect(groups.acceptJoinRequest('owner_1', 'ms_1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('leave', () => {
    it('rejects leaving an adhesion that is not the caller’s own', async () => {
      const { prisma, groupMembership } = createFakePrisma();
      groupMembership.findUnique.mockResolvedValue({
        id: 'ms_1',
        userId: 'other_user',
        status: 'ACTIVE',
      });
      const groups = new GroupsService(prisma as never);

      await expect(groups.leave('user_1', 'ms_1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('stays active until the end of the already-paid period when one is in the future', async () => {
      const { prisma, groupMembership } = createFakePrisma();
      const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 10);
      groupMembership.findUnique.mockResolvedValue({
        id: 'ms_1',
        userId: 'user_1',
        status: 'ACTIVE',
        nextPaymentDueAt: future,
      });
      const groups = new GroupsService(prisma as never);

      await groups.leave('user_1', 'ms_1');

      expect(groupMembership.update).toHaveBeenCalledWith({
        where: { id: 'ms_1' },
        data: { leftAt: future },
      });
    });

    it('leaves immediately when there is no future paid period', async () => {
      const { prisma, groupMembership } = createFakePrisma();
      groupMembership.findUnique.mockResolvedValue({
        id: 'ms_1',
        userId: 'user_1',
        status: 'ACTIVE',
        nextPaymentDueAt: null,
      });
      const groups = new GroupsService(prisma as never);

      await groups.leave('user_1', 'ms_1');

      expect(groupMembership.update).toHaveBeenCalledWith({
        where: { id: 'ms_1' },
        data: { status: 'LEFT', leftAt: expect.any(Date) },
      });
    });
  });
});
