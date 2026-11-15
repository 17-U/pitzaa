/**
 * Le XAF n'a pas de décimales : tous les montants sont des entiers (pas de float).
 * Toute arithmétique monétaire du projet doit passer par ces helpers.
 */

export class InvalidAmountError extends Error {
  constructor(value: unknown) {
    super(`Montant invalide : ${String(value)} (un entier positif ou nul est attendu, en XAF)`);
    this.name = "InvalidAmountError";
  }
}

/** Valide qu'une valeur est un montant XAF correct : entier >= 0. */
export function assertValidAmount(value: number): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new InvalidAmountError(value);
  }
}

export function addAmounts(...amounts: number[]): number {
  for (const a of amounts) assertValidAmount(a);
  return amounts.reduce((sum, a) => sum + a, 0);
}

export function subtractAmounts(a: number, b: number): number {
  assertValidAmount(a);
  assertValidAmount(b);
  return a - b;
}

/** Calcule un pourcentage d'un montant XAF, arrondi à l'entier le plus proche. */
export function percentageOf(amount: number, percent: number): number {
  assertValidAmount(amount);
  return Math.round(amount * percent);
}

export function formatXaf(amount: number, locale: "fr" | "en" = "fr"): string {
  assertValidAmount(amount);
  return new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US", {
    style: "currency",
    currency: "XAF",
    maximumFractionDigits: 0,
  }).format(amount);
}
