/** Décodage non vérifié du payload d'un JWT — uniquement pour décider s'il faut
 * rafraîchir la session côté middleware ; l'API reste la seule autorité qui vérifie
 * réellement la signature et l'expiration. Implémenté avec atob (pas Buffer) pour
 * rester compatible avec le runtime Edge du middleware Next.js. */
function base64UrlDecode(segment: string): string {
  const padded = segment.replace(/-/g, "+").replace(/_/g, "/");
  const withPadding = padded + "=".repeat((4 - (padded.length % 4)) % 4);
  return atob(withPadding);
}

export function decodeJwtExpiry(token: string): number | null {
  try {
    const [, payload] = token.split(".");
    if (!payload) return null;
    const json = JSON.parse(base64UrlDecode(payload)) as { exp?: unknown };
    return typeof json.exp === "number" ? json.exp : null;
  } catch {
    return null;
  }
}

/** Vrai si le token expire dans moins de `skewSeconds` (ou est illisible/déjà expiré). */
export function isJwtExpiringSoon(token: string, skewSeconds = 60): boolean {
  const exp = decodeJwtExpiry(token);
  if (exp === null) return true;
  return exp * 1000 - Date.now() < skewSeconds * 1000;
}
