import {
  PREMIUM_FEE_DISCOUNT_MULTIPLIER,
  SUBSCRIPTION_CO_MEMBER_FLAT_FEE_XAF,
  SUBSCRIPTION_CO_MEMBER_PERCENT_FEE,
} from "./constants";
import { addAmounts, assertValidAmount, percentageOf } from "./money";

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
