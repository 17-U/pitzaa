import { Injectable } from '@nestjs/common';
import { Locale, User } from '@prisma/client';
import { hashSecret } from '../common/crypto.util';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByPhone(phone: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { phone } });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async createWithWallet(params: {
    phone: string;
    locale: Locale;
    firstName?: string;
    lastName?: string;
  }): Promise<User> {
    return this.prisma.user.create({
      data: {
        phone: params.phone,
        locale: params.locale,
        firstName: params.firstName,
        lastName: params.lastName,
        wallet: { create: {} },
      },
    });
  }

  async updateProfile(
    userId: string,
    data: { firstName?: string; lastName?: string; locale?: Locale },
  ): Promise<User> {
    return this.prisma.user.update({ where: { id: userId }, data });
  }

  async setPin(userId: string, pin: string): Promise<void> {
    const pinHash = await hashSecret(pin);
    await this.prisma.user.update({ where: { id: userId }, data: { pinHash } });
  }

  /** Export des données personnelles de l'utilisateur (hors secrets). */
  async exportPersonalData(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { devices: true, authProviders: true, wallet: true },
    });
    const { pinHash: _pinHash, ...safeUser } = user;
    return safeUser;
  }

  /** Suppression de compte : anonymise le PII, conserve l'historique financier pour la conformité. */
  async softDelete(userId: string): Promise<void> {
    const anonymizedPhone = `deleted-${userId}`;
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          deletedAt: new Date(),
          phone: anonymizedPhone,
          email: null,
          firstName: null,
          lastName: null,
          pinHash: null,
        },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }
}
