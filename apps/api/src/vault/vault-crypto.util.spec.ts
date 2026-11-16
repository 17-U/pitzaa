import { decryptVaultPayload, encryptVaultPayload } from './vault-crypto.util';

const TEST_KEY = '0'.repeat(63) + '1'; // 64 caractères hex (32 octets)

describe('vault-crypto.util', () => {
  it('round-trips a plaintext payload', () => {
    const payload = encryptVaultPayload(
      'user@service.com / secret-password',
      TEST_KEY,
    );
    const plaintext = decryptVaultPayload(payload, TEST_KEY);
    expect(plaintext).toBe('user@service.com / secret-password');
  });

  it('produces a different ciphertext each time (random IV)', () => {
    const a = encryptVaultPayload('same secret', TEST_KEY);
    const b = encryptVaultPayload('same secret', TEST_KEY);
    expect(a.encryptedPayload.equals(b.encryptedPayload)).toBe(false);
    expect(a.iv.equals(b.iv)).toBe(false);
  });

  it('fails to decrypt with a tampered auth tag', () => {
    const payload = encryptVaultPayload('secret', TEST_KEY);
    payload.authTag[0] ^= 0xff;
    expect(() => decryptVaultPayload(payload, TEST_KEY)).toThrow();
  });

  it('rejects a key that is not 32 bytes', () => {
    expect(() => encryptVaultPayload('secret', 'deadbeef')).toThrow();
  });
});
