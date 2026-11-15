import { parseDurationMs } from './duration.util';

describe('parseDurationMs', () => {
  it('parses seconds', () => {
    expect(parseDurationMs('30s')).toBe(30_000);
  });

  it('parses minutes', () => {
    expect(parseDurationMs('15m')).toBe(15 * 60_000);
  });

  it('parses hours', () => {
    expect(parseDurationMs('2h')).toBe(2 * 60 * 60_000);
  });

  it('parses days', () => {
    expect(parseDurationMs('30d')).toBe(30 * 24 * 60 * 60_000);
  });

  it('throws on an invalid format', () => {
    expect(() => parseDurationMs('30')).toThrow();
    expect(() => parseDurationMs('abc')).toThrow();
  });
});
