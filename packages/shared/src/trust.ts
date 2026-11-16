import { TRUST_SCORE_MAX_SENIORITY_BONUS } from "./constants";

/**
 * Impact d'un avis (note 1 à 5) sur le score de confiance de la personne notée :
 * neutre à 3 étoiles, jusqu'à ±4 points aux extrêmes.
 */
export function computeReviewTrustImpact(rating: number): number {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new RangeError(`La note doit être un entier entre 1 et 5, reçu : ${rating}`);
  }
  return (rating - 3) * 2;
}

/**
 * Score de confiance affiché : score accumulé par évènements (paiements à l'heure,
 * litiges perdus, avis) + un bonus d'ancienneté (1 point par mois, plafonné).
 */
export function computeDisplayTrustScore(accumulatedScore: number, createdAt: Date, now: Date = new Date()): number {
  const monthsSinceCreation = Math.max(
    0,
    (now.getFullYear() - createdAt.getFullYear()) * 12 + (now.getMonth() - createdAt.getMonth()),
  );
  const seniorityBonus = Math.min(monthsSinceCreation, TRUST_SCORE_MAX_SENIORITY_BONUS);
  return accumulatedScore + seniorityBonus;
}
