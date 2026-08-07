import { isStringArraySchema } from './array-control';

describe('isStringArraySchema', () => {
  it('accepts string item schemas', () => {
    expect(isStringArraySchema({ type: 'array', items: { type: 'string' } })).toBe(true);
  });

  it('rejects primitive arrays whose values need coercion', () => {
    expect(isStringArraySchema({ type: 'array', items: { type: 'number' } })).toBe(false);
    expect(isStringArraySchema({ type: 'array', items: { type: 'boolean' } })).toBe(false);
  });
});
