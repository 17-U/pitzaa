import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

export interface EncryptedPayload {
  encryptedPayload: Buffer;
  iv: Buffer;
  authTag: Buffer;
}

function resolveKey(keyHex: string): Buffer {
  const key = Buffer.from(keyHex, 'hex');
  if (key.length !== 32) {
    throw new Error(
      'VAULT_ENCRYPTION_KEY doit être une chaîne hexadécimale de 32 octets (64 caractères).',
    );
  }
  return key;
}

export function encryptVaultPayload(
  plaintext: string,
  keyHex: string,
): EncryptedPayload {
  const key = resolveKey(keyHex);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encryptedPayload = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return { encryptedPayload, iv, authTag };
}

export function decryptVaultPayload(
  payload: EncryptedPayload,
  keyHex: string,
): string {
  const key = resolveKey(keyHex);
  const decipher = createDecipheriv(ALGORITHM, key, payload.iv);
  decipher.setAuthTag(payload.authTag);
  const decrypted = Buffer.concat([
    decipher.update(payload.encryptedPayload),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}
