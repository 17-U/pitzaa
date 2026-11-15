import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WalletService {
  constructor(private readonly prisma: PrismaService) {}

  async getBalance(userId: string) {
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) {
      throw new NotFoundException('Portefeuille introuvable.');
    }
    return wallet;
  }

  async listLedgerHistory(userId: string, take = 50) {
    return this.prisma.ledgerEntry.findMany({
      where: { userId, accountType: { in: ['USER_AVAILABLE', 'USER_ESCROW'] } },
      orderBy: { createdAt: 'desc' },
      take,
      include: { transaction: true },
    });
  }
}
