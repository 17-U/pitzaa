import {
  GIFT_CARD_MONTHLY_CAP_BEFORE_KYC_XAF,
  GIFT_CARD_SALE_PERCENT_FEE,
  PREMIUM_FEE_DISCOUNT_MULTIPLIER,
  SUBSCRIPTION_CO_MEMBER_FLAT_FEE_XAF,
  SUBSCRIPTION_CO_MEMBER_PERCENT_FEE,
} from "./constants";
import { addAmounts, assertValidAmount, percentageOf, subtractAmounts } from "./money";

export interface MembershipPaymentAmount {
  /** Part du propriétaire pour la période (prix par place × nombre de mois). */
  ownerShareXaf: number;
  /** Commission Pitzaa pour la période (gratuite pour le propriétaire). */
  commissionXaf: number;
  /** Montant total prélevé au co-abonné : ownerShareXaf + commissionXaf. */
  totalXaf: number;
}

/**
 * Calcule le montant payé par un co-abonné pour une période d'abonnement partagé.
 * Commission : 250 XAF + 5 % de sa part par mois, réduite de moitié pour les
 * utilisateurs Premium. Le propriétaire du groupe ne paie jamais cette commission.
 */
export function computeMembershipPaymentAmount(
  pricePerSlotXaf: number,
  monthsCount: number,
  payerIsPremium: boolean,
): MembershipPaymentAmount {
  assertValidAmount(pricePerSlotXaf);
  if (!Number.isInteger(monthsCount) || monthsCount < 1) {
    throw new RangeError(`monthsCount doit être un entier positif, reçu : ${monthsCount}`);
  }

  const discount = payerIsPremium ? PREMIUM_FEE_DISCOUNT_MULTIPLIER : 1;
  const flatFeePerMonth = Math.round(SUBSCRIPTION_CO_MEMBER_FLAT_FEE_XAF * discount);
  const percentFeePerMonth = percentageOf(pricePerSlotXaf, SUBSCRIPTION_CO_MEMBER_PERCENT_FEE * discount);
  const commissionPerMonth = addAmounts(flatFeePerMonth, percentFeePerMonth);

  const ownerShareXaf = pricePerSlotXaf * monthsCount;
  const commissionXaf = commissionPerMonth * monthsCount;

  return { ownerShareXaf, commissionXaf, totalXaf: addAmounts(ownerShareXaf, commissionXaf) };
}

export interface GiftCardSaleAmount {
  /** Prix demandé par le vendeur (ce que paie l'acheteur). */
  askingPriceXaf: number;
  /** Commission Pitzaa (8 %, réduite de moitié pour les vendeurs Premium), payée par le vendeur. */
  commissionXaf: number;
  /** Montant net reçu par le vendeur à la libération du séquestre : askingPriceXaf - commissionXaf. */
  netSellerAmountXaf: number;
}

/**
 * Calcule la répartition d'une vente de carte cadeau. La commission (8 % du
 * prix demandé) est à la charge du vendeur, réduite de moitié s'il est Premium.
 */
export function computeGiftCardSaleAmount(askingPriceXaf: number, sellerIsPremium: boolean): GiftCardSaleAmount {
  assertValidAmount(askingPriceXaf);

  const discount = sellerIsPremium ? PREMIUM_FEE_DISCOUNT_MULTIPLIER : 1;
  const commissionXaf = percentageOf(askingPriceXaf, GIFT_CARD_SALE_PERCENT_FEE * discount);

  return { askingPriceXaf, commissionXaf, netSellerAmountXaf: subtractAmounts(askingPriceXaf, commissionXaf) };
}

const GIFT_CARD_SALES_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export interface GiftCardMonthlyUsage {
  /** Ventes cumulées à retenir pour le plafond, après remise à zéro éventuelle. */
  currentAmountXaf: number;
  /** Début de la fenêtre glissante de 30 jours à utiliser pour la suite. */
  windowStartAt: Date;
  /** true si currentAmountXaf + un nouveau montant dépasserait le plafond. */
  wouldExceedCap: (additionalAmountXaf: number) => boolean;
}

/**
 * Fenêtre glissante de 30 jours pour le plafond de 300 000 XAF/mois de ventes de
 * cartes cadeaux avant KYC renforcé. windowStartAt est `null` pour un vendeur qui
 * n'a encore jamais vendu.
 */
export function resolveGiftCardMonthlyUsage(
  currentAmountXaf: number,
  windowStartAt: Date | null,
  now: Date = new Date(),
): GiftCardMonthlyUsage {
  const windowExpired = !windowStartAt || now.getTime() - windowStartAt.getTime() >= GIFT_CARD_SALES_WINDOW_MS;
  const resolved = windowExpired ? { currentAmountXaf: 0, windowStartAt: now } : { currentAmountXaf, windowStartAt };

  return {
    ...resolved,
    wouldExceedCap: (additionalAmountXaf: number) =>
      resolved.currentAmountXaf + additionalAmountXaf > GIFT_CARD_MONTHLY_CAP_BEFORE_KYC_XAF,
  };
}
