import { enumValueAt } from './select-control';

describe('enumValueAt', () => {
  it('returns the original enum value without string coercion', () => {
    const options = ['one', 2, true];

    expect(enumValueAt(options, '1')).toBe(2);
    expect(enumValueAt(options, '2')).toBe(true);
  });

  it('returns undefined for the empty placeholder', () => {
    expect(enumValueAt(['one'], '')).toBeUndefined();
  });
});
