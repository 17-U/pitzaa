import { createHash, randomBytes, randomInt } from 'crypto';
import * as argon2 from 'argon2';

export async function hashSecret(plain: string): Promise<string> {
  return argon2.hash(plain);
}

export async function verifySecret(
  hash: string,
  plain: string,
): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}

/**
 * Hachage rapide (sha256), réservé aux jetons à haute entropie (refresh token).
 * Ne jamais l'utiliser pour un secret devinable comme un PIN ou un code OTP.
 */
export function hashToken(plain: string): string {
  return createHash('sha256').update(plain).digest('hex');
}

export function generateNumericCode(length = 6): string {
  const min = 10 ** (length - 1);
  const max = 10 ** length - 1;
  return randomInt(min, max + 1).toString();
}

export function generateSecureToken(bytes = 48): string {
  return randomBytes(bytes).toString('base64url');
}
