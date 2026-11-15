const UNIT_MS: Record<string, number> = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

/** Convertit une durée au format "30d", "15m", "1h"... en millisecondes. */
export function parseDurationMs(value: string): number {
  const match = /^(\d+)(s|m|h|d)$/.exec(value.trim());
  if (!match) {
    throw new Error(`Durée invalide : ${value}`);
  }
  const amount = match[1];
  const unit = match[2];
  return Number(amount) * UNIT_MS[unit];
}
