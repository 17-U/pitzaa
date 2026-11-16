import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { verifySecret } from '../common/crypto.util';
import { PrismaService } from '../prisma/prisma.service';
import { decryptVaultPayload, encryptVaultPayload } from './vault-crypto.util';

@Injectable()
export class VaultService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private get encryptionKey(): string {
    return this.config.getOrThrow<string>('VAULT_ENCRYPTION_KEY');
  }

  private async assertOwner(userId: string, groupId: string) {
    const group = await this.prisma.subscriptionGroup.findUnique({
      where: { id: groupId },
    });
    if (!group) {
      throw new NotFoundException('Groupe introuvable.');
    }
    if (group.ownerId !== userId) {
      throw new ForbiddenException(
        'Seul le propriétaire du groupe peut gérer le coffre-fort.',
      );
    }
    return group;
  }

  private async assertMemberOrOwner(userId: string, groupId: string) {
    const group = await this.prisma.subscriptionGroup.findUnique({
      where: { id: groupId },
    });
    if (!group) {
      throw new NotFoundException('Groupe introuvable.');
    }
    if (group.ownerId === userId) {
      return group;
    }
    const membership = await this.prisma.groupMembership.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    if (!membership || membership.status !== 'ACTIVE') {
      throw new ForbiddenException(
        'Accès réservé aux membres actifs de ce groupe.',
      );
    }
    return group;
  }

  async setCredentials(userId: string, groupId: string, payload: string) {
    await this.assertOwner(userId, groupId);
    const { encryptedPayload, iv, authTag } = encryptVaultPayload(
      payload,
      this.encryptionKey,
    );

    await this.prisma.credentialVault.upsert({
      where: { groupId },
      create: { groupId, encryptedPayload, iv, authTag },
      update: { encryptedPayload, iv, authTag },
    });

    return { status: 'ok' };
  }

  async reveal(
    userId: string,
    groupId: string,
    pin: string,
  ): Promise<{ payload: string }> {
    await this.assertMemberOrOwner(userId, groupId);

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    if (!user.pinHash || !(await verifySecret(user.pinHash, pin))) {
      throw new BadRequestException('PIN incorrect.');
    }

    const vault = await this.prisma.credentialVault.findUnique({
      where: { groupId },
    });
    if (!vault) {
      throw new NotFoundException(
        "Aucun identifiant n'a été renseigné pour ce groupe.",
      );
    }

    const payload = decryptVaultPayload(
      {
        encryptedPayload: vault.encryptedPayload,
        iv: vault.iv,
        authTag: vault.authTag,
      },
      this.encryptionKey,
    );

    await this.prisma.vaultAccessLog.create({
      data: { vaultId: vault.id, userId },
    });

    return { payload };
  }
}
