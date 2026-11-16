import { filterMessageContent } from './content-filter.util';

describe('filterMessageContent', () => {
  it('redacts an international phone number', () => {
    const result = filterMessageContent(
      'Appelle-moi au +237612345678 ce soir.',
    );
    expect(result.flagged).toBe(true);
    expect(result.content).not.toContain('612345678');
    expect(result.content).toContain('[masqué]');
  });

  it('redacts a local mobile money number without a plus sign', () => {
    const result = filterMessageContent(
      'Mon numéro momo est 6 97 00 11 22, envoie direct.',
    );
    expect(result.flagged).toBe(true);
    expect(result.content).not.toContain('97 00 11 22');
  });

  it('redacts a WhatsApp link', () => {
    const result = filterMessageContent(
      'On continue sur https://wa.me/237612345678 plutôt.',
    );
    expect(result.flagged).toBe(true);
    expect(result.content).not.toContain('wa.me');
  });

  it('leaves ordinary conversation untouched', () => {
    const result = filterMessageContent(
      'Merci beaucoup, le service fonctionne bien !',
    );
    expect(result.flagged).toBe(false);
    expect(result.content).toBe('Merci beaucoup, le service fonctionne bien !');
  });

  it('does not flag a short number that is not a phone number', () => {
    const result = filterMessageContent('Le prix est de 2024 XAF ce mois.');
    expect(result.flagged).toBe(false);
    expect(result.content).toContain('2024');
  });
});
