export const GIFT_CARD_VERIFIER = 'GIFT_CARD_VERIFIER';

export interface GiftCardVerificationParams {
  brandName: string;
  country: string;
  code: string;
  declaredBalanceXaf: number;
}

export interface GiftCardVerificationResult {
  /** true seulement si un contrôle automatisé a positivement confirmé le solde. */
  verified: boolean;
  actualBalanceXaf?: number;
  notes?: string;
}

/**
 * Vérifie le solde d'une carte cadeau auprès de la marque. Au MVP, aucune API
 * de marque n'est branchée : un admin vérifie manuellement avant publication
 * (voir GiftCardListingsService.verify/reject). Cette interface existe pour
 * qu'un futur vérificateur automatisé (par marque) puisse se brancher sans
 * changer le reste du code — voir QUESTIONS.md.
 */
export interface GiftCardVerifier {
  verify(
    params: GiftCardVerificationParams,
  ): Promise<GiftCardVerificationResult>;
}
