import { Prisma } from '@prisma/client';

/**
 * Exclut codeEncrypted/codeIv/codeAuthTag : ce sont des octets chiffrés sans valeur
 * pour le client, et ils n'ont aucune raison de transiter sur le réseau. La seule
 * façon légitime d'obtenir le code en clair reste adminRevealPendingCode()
 * (vérification) ou GiftCardOrdersService.revealCode() (après achat).
 */
export const PUBLIC_LISTING_SELECT = {
  id: true,
  sellerId: true,
  brandId: true,
  balanceXaf: true,
  askingPriceXaf: true,
  expiresAt: true,
  status: true,
  rejectionReason: true,
  verifiedByAdminId: true,
  verifiedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.GiftCardListingSelect;

/** Exclut pinHash (même principe que toPublicUser() dans auth.controller.ts). */
export const PUBLIC_SELLER_SELECT = {
  id: true,
  phone: true,
  email: true,
  firstName: true,
  lastName: true,
  locale: true,
  role: true,
  kycStatus: true,
  isPremium: true,
  trustScore: true,
  lifetimeSalesXaf: true,
  giftCardSalesCurrentMonthXaf: true,
  giftCardSalesMonthStartAt: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;
