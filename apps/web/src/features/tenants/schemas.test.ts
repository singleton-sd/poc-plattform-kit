import { createTenantSchema, toCreateTenantPayload, updateTenantSchema } from './schemas';

describe('tenant schemas', () => {
  it('accepts a valid create payload', () => {
    expect(createTenantSchema.parse({ name: 'Acme', slug: 'acme' })).toEqual({
      name: 'Acme',
      slug: 'acme',
    });
  });

  it('accepts a create payload with an omitted slug', () => {
    expect(createTenantSchema.parse({ name: 'Acme' })).toEqual({ name: 'Acme' });
  });

  it('normalises mixed-case slug to lowercase', () => {
    expect(createTenantSchema.parse({ name: 'Acme', slug: 'MyCo' })).toEqual({
      name: 'Acme',
      slug: 'myco',
    });
  });

  it('rejects an invalid slug', () => {
    expect(() => createTenantSchema.parse({ name: 'Acme', slug: 'Acme!' })).toThrow();
  });

  it('rejects a missing name', () => {
    expect(() => createTenantSchema.parse({ name: '' })).toThrow();
  });

  it('rejects a whitespace-only name on create', () => {
    expect(() => createTenantSchema.parse({ name: '   ' })).toThrow();
  });

  it('trims name whitespace on create', () => {
    expect(createTenantSchema.parse({ name: '  Acme  ' })).toEqual({ name: 'Acme' });
  });

  it('accepts a valid update payload', () => {
    expect(updateTenantSchema.parse({ name: 'Acme Corp' })).toEqual({ name: 'Acme Corp' });
  });

  it('rejects a whitespace-only name on update', () => {
    expect(() => updateTenantSchema.parse({ name: '   ' })).toThrow();
  });

  it('trims name whitespace on update', () => {
    expect(updateTenantSchema.parse({ name: '  Acme Corp  ' })).toEqual({ name: 'Acme Corp' });
  });
});

describe('toCreateTenantPayload', () => {
  it('leaves a non-blank slug untouched when already lowercase', () => {
    expect(toCreateTenantPayload({ name: 'Acme', slug: 'acme' })).toEqual({
      name: 'Acme',
      slug: 'acme',
    });
  });

  it('lowercases mixed-case slug so it passes createTenantSchema', () => {
    const payload = toCreateTenantPayload({ name: 'Acme', slug: 'MyCo' });
    expect(payload).toEqual({ name: 'Acme', slug: 'myco' });
    expect(createTenantSchema.parse(payload)).toEqual({ name: 'Acme', slug: 'myco' });
  });

  it('converts a blank slug to undefined so it is treated as omitted', () => {
    expect(toCreateTenantPayload({ name: 'Acme', slug: '   ' })).toEqual({
      name: 'Acme',
      slug: undefined,
    });
  });

  it('converts a missing slug to undefined', () => {
    expect(toCreateTenantPayload({ name: 'Acme' })).toEqual({ name: 'Acme', slug: undefined });
  });
});
