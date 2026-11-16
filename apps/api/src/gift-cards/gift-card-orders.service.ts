import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GiftCardOrder } from '@prisma/client';
import {
  GIFT_CARD_ESCROW_RELEASE_HOURS,
  computeGiftCardSaleAmount,
} from '@pitzaa/shared';
import { verifySecret } from '../common/crypto.util';
import { LedgerService } from '../ledger/ledger.service';
import { MessagingService } from '../messaging/messaging.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PaymentsService } from '../payments/payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { decryptVaultPayload } from '../vault/vault-crypto.util';
import { BuyListingDto } from './dto/buy-listing.dto';

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

@Injectable()
export class GiftCardOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly paymentsService: PaymentsService,
    private readonly config: ConfigService,
    private readonly messaging: MessagingService,
    private readonly notifications: NotificationsService,
  ) {}

  private get encryptionKey(): string {
    return this.config.getOrThrow<string>('VAULT_ENCRYPTION_KEY');
  }

  async buy(
    buyerId: string,
    listingId: string,
    dto: BuyListingDto,
  ): Promise<GiftCardOrder> {
    const listing = await this.prisma.giftCardListing.findUnique({
      where: { id: listingId },
    });
    if (!listing || listing.status !== 'LISTED') {
      throw new NotFoundException('Annonce introuvable ou déjà vendue.');
    }
    if (listing.expiresAt && listing.expiresAt <= new Date()) {
      throw new BadRequestException('Cette carte cadeau a expiré.');
    }
    if (listing.sellerId === buyerId) {
      throw new BadRequestException(
        'Vous ne pouvez pas acheter votre propre annonce.',
      );
    }

    const buyer = await this.prisma.user.findUniqueOrThrow({
      where: { id: buyerId },
    });
    if (!buyer.pinHash || !(await verifySecret(buyer.pinHash, dto.pin))) {
      throw new BadRequestException('PIN incorrect.');
    }

    const seller = await this.prisma.user.findUniqueOrThrow({
      where: { id: listing.sellerId },
    });
    const { askingPriceXaf, commissionXaf } = computeGiftCardSaleAmount(
      listing.askingPriceXaf,
      seller.isPremium,
    );

    if (dto.method === 'WALLET') {
      return this.buyFromWallet(
        listing.id,
        listing.sellerId,
        buyerId,
        askingPriceXaf,
        commissionXaf,
      );
    }

    if (!dto.operator || !dto.msisdn) {
      throw new BadRequestException(
        'operator et msisdn sont requis pour un paiement par mobile money.',
      );
    }

    const order = await this.prisma.$transaction(async (tx) => {
      await tx.giftCardListing.update({
        where: { id: listing.id },
        data: { status: 'SOLD' },
      });
      const created = await tx.giftCardOrder.create({
        data: {
          listingId: listing.id,
          buyerId,
          pricePaidXaf: askingPriceXaf,
          commissionXaf,
        },
      });
      await this.messaging.createConversationForGiftCardOrder(tx, created.id);
      return created;
    });

    await this.notifications.notify(
      listing.sellerId,
      'GIFT_CARD_SOLD',
      'Votre carte cadeau a été vendue',
      'Un acheteur a commandé votre carte cadeau. Le paiement est en cours de confirmation.',
    );

    await this.paymentsService.initiateCollection({
      userId: buyerId,
      amountXaf: askingPriceXaf,
      msisdn: dto.msisdn,
      operator: dto.operator,
      purpose: 'GIFT_CARD_PURCHASE',
      giftCardOrderId: order.id,
      description: `Achat carte cadeau (annonce ${listing.id})`,
    });

    return this.prisma.giftCardOrder.findUniqueOrThrow({
      where: { id: order.id },
    });
  }

  private async buyFromWallet(
    listingId: string,
    sellerId: string,
    buyerId: string,
    askingPriceXaf: number,
    commissionXaf: number,
  ): Promise<GiftCardOrder> {
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId: buyerId },
    });
    if (!wallet || wallet.availableBalanceXaf < askingPriceXaf) {
      throw new BadRequestException('Solde Pitzaa insuffisant pour cet achat.');
    }

    const paid = await this.prisma.$transaction(async (tx) => {
      await tx.giftCardListing.update({
        where: { id: listingId },
        data: { status: 'SOLD' },
      });

      const order = await tx.giftCardOrder.create({
        data: {
          listingId,
          buyerId,
          pricePaidXaf: askingPriceXaf,
          commissionXaf,
        },
      });
      await this.messaging.createConversationForGiftCardOrder(tx, order.id);

      await this.ledger.postEntries(
        tx,
        'GIFT_CARD_PURCHASE_COLLECTION',
        [
          {
            accountType: 'USER_AVAILABLE',
            entryType: 'PAYMENT_COLLECTED',
            amountXaf: -askingPriceXaf,
            userId: buyerId,
          },
          {
            accountType: 'USER_ESCROW',
            entryType: 'ESCROW_HOLD',
            amountXaf: askingPriceXaf,
            userId: sellerId,
          },
        ],
        `Achat carte cadeau ${order.id} depuis le portefeuille`,
      );

      return tx.giftCardOrder.update({
        where: { id: order.id },
        data: { status: 'PAID' },
      });
    });

    await this.notifications.notify(
      sellerId,
      'GIFT_CARD_SOLD',
      'Votre carte cadeau a été vendue',
      'Un acheteur a payé votre carte cadeau depuis son portefeuille Pitzaa. Les fonds sont en séquestre.',
    );

    return paid;
  }

  /** Le code n'est révélé qu'une seule fois ; chaque consultation est journalisée. */
  async revealCode(
    buyerId: string,
    orderId: string,
  ): Promise<{ code: string }> {
    const order = await this.prisma.giftCardOrder.findUnique({
      where: { id: orderId },
      include: { listing: true },
    });
    if (!order || order.buyerId !== buyerId) {
      throw new NotFoundException('Commande introuvable.');
    }
    if (order.status !== 'PAID') {
      throw new ForbiddenException(
        order.status === 'CODE_REVEALED'
          ? 'Le code a déjà été révélé.'
          : 'Le paiement doit être confirmé avant de révéler le code.',
      );
    }

    const code = decryptVaultPayload(
      {
        encryptedPayload: order.listing.codeEncrypted,
        iv: order.listing.codeIv,
        authTag: order.listing.codeAuthTag,
      },
      this.encryptionKey,
    );

    await this.prisma.$transaction([
      this.prisma.giftCardOrder.update({
        where: { id: orderId },
        data: {
          status: 'CODE_REVEALED',
          codeRevealedAt: new Date(),
          escrowReleaseAt: addHours(new Date(), GIFT_CARD_ESCROW_RELEASE_HOURS),
        },
      }),
      this.prisma.giftCardCodeAccessLog.create({
        data: { orderId, userId: buyerId },
      }),
    ]);

    await this.notifications.notify(
      order.listing.sellerId,
      'GIFT_CARD_CODE_REVEALED',
      'Le code de votre carte cadeau a été révélé',
      'L’acheteur a révélé le code. Le délai de séquestre de 72h a commencé.',
    );

    return { code };
  }

  listMine(buyerId: string) {
    return this.prisma.giftCardOrder.findMany({
      where: { buyerId },
      include: { listing: { include: { brand: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
