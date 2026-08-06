import { DEFAULT_CORS_ORIGINS, parseCorsOrigins } from './cors-origins';

describe('parseCorsOrigins', () => {
  it('returns locked defaults when env is missing or blank', () => {
    expect(parseCorsOrigins(undefined)).toEqual([...DEFAULT_CORS_ORIGINS]);
    expect(parseCorsOrigins('')).toEqual([...DEFAULT_CORS_ORIGINS]);
    expect(parseCorsOrigins('   ')).toEqual([...DEFAULT_CORS_ORIGINS]);
  });

  it('splits comma-separated origins and trims', () => {
    expect(parseCorsOrigins(' https://a.example ,https://b.example ')).toEqual([
      'https://a.example',
      'https://b.example',
    ]);
  });
});
