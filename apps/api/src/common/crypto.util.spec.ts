import {
  generateNumericCode,
  generateSecureToken,
  hashSecret,
  hashToken,
  verifySecret,
} from './crypto.util';

describe('crypto.util', () => {
  describe('hashSecret / verifySecret', () => {
    it('verifies a correct secret against its hash', async () => {
      const hash = await hashSecret('123456');
      await expect(verifySecret(hash, '123456')).resolves.toBe(true);
    });

    it('rejects an incorrect secret', async () => {
      const hash = await hashSecret('123456');
      await expect(verifySecret(hash, '000000')).resolves.toBe(false);
    });

    it('never produces the same hash twice for the same input (random salt)', async () => {
      const [a, b] = await Promise.all([
        hashSecret('1234'),
        hashSecret('1234'),
      ]);
      expect(a).not.toBe(b);
    });
  });

  describe('hashToken', () => {
    it('is deterministic for the same input', () => {
      expect(hashToken('abc')).toBe(hashToken('abc'));
    });

    it('differs for different inputs', () => {
      expect(hashToken('abc')).not.toBe(hashToken('abd'));
    });
  });

  describe('generateNumericCode', () => {
    it('generates a code of the requested length', () => {
      const code = generateNumericCode(6);
      expect(code).toMatch(/^\d{6}$/);
    });

    it('never generates a code with a leading zero shorter than requested', () => {
      for (let i = 0; i < 20; i++) {
        expect(generateNumericCode(6)).toHaveLength(6);
      }
    });
  });

  describe('generateSecureToken', () => {
    it('generates distinct tokens on each call', () => {
      const a = generateSecureToken();
      const b = generateSecureToken();
      expect(a).not.toBe(b);
    });
  });
});
