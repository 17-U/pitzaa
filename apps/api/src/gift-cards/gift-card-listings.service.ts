import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GiftCardListing } from '@prisma/client';
import { resolveGiftCardMonthlyUsage } from '@pitzaa/shared';
import { PrismaService } from '../prisma/prisma.service';
import {
  decryptVaultPayload,
  encryptVaultPayload,
} from '../vault/vault-crypto.util';
import { CreateListingDto } from './dto/create-listing.dto';
import {
  PUBLIC_LISTING_SELECT,
  PUBLIC_SELLER_SELECT,
} from './gift-card-listing-select.util';
import {
  GIFT_CARD_VERIFIER,
  GiftCardVerifier,
} from './verifiers/gift-card-verifier.interface';

/** Vue publique d'une annonce : jamais codeEncrypted/codeIv/codeAuthTag (octets chiffrés inutiles côté client). */
export type PublicGiftCardListing = Omit<
  GiftCardListing,
  'codeEncrypted' | 'codeIv' | 'codeAuthTag'
>;

@Injectable()
export class GiftCardListingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(GIFT_CARD_VERIFIER) private readonly verifier: GiftCardVerifier,
  ) {}

  private get encryptionKey(): string {
    return this.config.getOrThrow<string>('VAULT_ENCRYPTION_KEY');
  }

  async create(
    sellerId: string,
    dto: CreateListingDto,
  ): Promise<PublicGiftCardListing> {
    const brand = await this.prisma.giftCardBrand.findUnique({
      where: { id: dto.brandId },
    });
    if (!brand || !brand.resaleAllowed) {
      throw new BadRequestException(
        'La revente de cette marque de carte cadeau n’est pas autorisée.',
      );
    }

    const seller = await this.prisma.user.findUniqueOrThrow({
      where: { id: sellerId },
    });
    const usage = resolveGiftCardMonthlyUsage(
      seller.giftCardSalesCurrentMonthXaf,
      seller.giftCardSalesMonthStartAt,
    );
    if (
      seller.kycStatus !== 'APPROVED' &&
      usage.wouldExceedCap(dto.askingPriceXaf)
    ) {
      throw new BadRequestException(
        'Plafond de 300 000 XAF/mois de ventes de cartes cadeaux atteint. Une vérification KYC renforcée est requise pour continuer.',
      );
    }

    // Vérification automatisée tentée pour information uniquement : au MVP elle
    // ne confirme jamais rien (voir ManualGiftCardVerifier), un admin valide manuellement.
    await this.verifier.verify({
      brandName: brand.name,
      country: brand.country,
      code: dto.code,
      declaredBalanceXaf: dto.balanceXaf,
    });

    const { encryptedPayload, iv, authTag } = encryptVaultPayload(
      dto.code,
      this.encryptionKey,
    );

    return this.prisma.giftCardListing.create({
      data: {
        sellerId,
        brandId: dto.brandId,
        balanceXaf: dto.balanceXaf,
        askingPriceXaf: dto.askingPriceXaf,
        expiresAt: dto.expiresAt,
        codeEncrypted: encryptedPayload,
        codeIv: iv,
        codeAuthTag: authTag,
      },
      select: PUBLIC_LISTING_SELECT,
    });
  }

  listPublic(brandId?: string) {
    return this.prisma.giftCardListing.findMany({
      where: {
        status: 'LISTED',
        brandId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: { ...PUBLIC_LISTING_SELECT, brand: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  listMine(sellerId: string) {
    return this.prisma.giftCardListing.findMany({
      where: { sellerId },
      select: { ...PUBLIC_LISTING_SELECT, brand: true, order: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  listPendingForAdmin() {
    return this.prisma.giftCardListing.findMany({
      where: { status: 'PENDING_VERIFICATION' },
      select: {
        ...PUBLIC_LISTING_SELECT,
        brand: true,
        seller: { select: PUBLIC_SELLER_SELECT },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  private async getPendingListing(id: string): Promise<GiftCardListing> {
    const listing = await this.prisma.giftCardListing.findUnique({
      where: { id },
    });
    if (!listing) {
      throw new NotFoundException('Annonce introuvable.');
    }
    if (listing.status !== 'PENDING_VERIFICATION') {
      throw new BadRequestException('Cette annonce a déjà été traitée.');
    }
    return listing;
  }

  /** Permet à un admin de consulter le code en attente de vérification manuelle. */
  async adminRevealPendingCode(
    adminId: string,
    listingId: string,
  ): Promise<{ code: string }> {
    const listing = await this.getPendingListing(listingId);

    const code = decryptVaultPayload(
      {
        encryptedPayload: listing.codeEncrypted,
        iv: listing.codeIv,
        authTag: listing.codeAuthTag,
      },
      this.encryptionKey,
    );

    await this.prisma.auditLog.create({
      data: {
        actorId: adminId,
        action: 'GIFT_CARD_CODE_VIEWED_FOR_VERIFICATION',
        entityType: 'GiftCardListing',
        entityId: listingId,
      },
    });

    return { code };
  }

  async verify(
    adminId: string,
    listingId: string,
  ): Promise<PublicGiftCardListing> {
    await this.getPendingListing(listingId);
    return this.prisma.giftCardListing.update({
      where: { id: listingId },
      data: {
        status: 'LISTED',
        verifiedByAdminId: adminId,
        verifiedAt: new Date(),
      },
      select: PUBLIC_LISTING_SELECT,
    });
  }

  async reject(
    adminId: string,
    listingId: string,
    reason: string,
  ): Promise<PublicGiftCardListing> {
    await this.getPendingListing(listingId);
    return this.prisma.giftCardListing.update({
      where: { id: listingId },
      data: {
        status: 'REJECTED',
        rejectionReason: reason,
        verifiedByAdminId: adminId,
        verifiedAt: new Date(),
      },
      select: PUBLIC_LISTING_SELECT,
    });
  }

  async cancel(
    sellerId: string,
    listingId: string,
  ): Promise<PublicGiftCardListing> {
    const listing = await this.prisma.giftCardListing.findUnique({
      where: { id: listingId },
    });
    if (!listing || listing.sellerId !== sellerId) {
      throw new NotFoundException('Annonce introuvable.');
    }
    if (
      listing.status !== 'PENDING_VERIFICATION' &&
      listing.status !== 'LISTED'
    ) {
      throw new ForbiddenException('Cette annonce ne peut plus être annulée.');
    }
    return this.prisma.giftCardListing.update({
      where: { id: listingId },
      data: { status: 'CANCELLED' },
      select: PUBLIC_LISTING_SELECT,
    });
  }
}
