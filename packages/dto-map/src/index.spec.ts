import { toIsoString, toIsoStringRequired } from './index';

describe('toIsoString', () => {
  it('returns null for nullish input', () => {
    expect(toIsoString(null)).toBeNull();
    expect(toIsoString(undefined)).toBeNull();
  });

  it('formats Date as ISO-8601', () => {
    expect(toIsoString(new Date('2026-08-10T12:00:00.000Z'))).toBe('2026-08-10T12:00:00.000Z');
  });
});

describe('toIsoStringRequired', () => {
  it('formats Date as ISO-8601', () => {
    expect(toIsoStringRequired(new Date('2026-08-10T12:00:00.000Z'))).toBe(
      '2026-08-10T12:00:00.000Z',
    );
  });
});
