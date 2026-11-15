import en from '@/i18n/locales/en.json';
import fr from '@/i18n/locales/fr.json';

describe('i18n resources', () => {
  it('exposes the same keys for fr and en', () => {
    expect(Object.keys(fr.common).sort()).toEqual(Object.keys(en.common).sort());
  });

  it('has a non-empty welcome message in both locales', () => {
    expect(fr.common.welcome.length).toBeGreaterThan(0);
    expect(en.common.welcome.length).toBeGreaterThan(0);
  });
});
