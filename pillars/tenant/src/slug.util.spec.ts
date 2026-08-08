import { SLUG_PATTERN, slugify } from './slug.util';

describe('slugify', () => {
  it('lowercases and hyphenates a simple name', () => {
    expect(slugify('Acme Pty Ltd')).toBe('acme-pty-ltd');
  });

  it('trims leading and trailing whitespace', () => {
    expect(slugify('  Acme  ')).toBe('acme');
  });

  it('collapses punctuation and duplicate separators into single hyphens', () => {
    expect(slugify('Acme & Co.,  Ltd!!')).toBe('acme-co-ltd');
  });

  it('trims leading and trailing hyphens produced by punctuation at the edges', () => {
    expect(slugify('--Acme--')).toBe('acme');
  });

  it('strips diacritics', () => {
    expect(slugify('Café Münchën')).toBe('cafe-munchen');
  });

  it('falls back to a fixed base when nothing alphanumeric survives normalization', () => {
    expect(slugify('日本語')).toBe('tenant');
  });

  it('always produces a value matching SLUG_PATTERN', () => {
    for (const name of ['Acme', '  ', '!!!', 'Ünïcödé Örg', 'a-b-c', '日本語']) {
      expect(slugify(name)).toMatch(SLUG_PATTERN);
    }
  });
});
