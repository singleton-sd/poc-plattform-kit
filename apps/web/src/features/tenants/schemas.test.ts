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

  it('rejects an invalid slug', () => {
    expect(() => createTenantSchema.parse({ name: 'Acme', slug: 'Acme!' })).toThrow();
  });

  it('rejects a missing name', () => {
    expect(() => createTenantSchema.parse({ name: '' })).toThrow();
  });

  it('accepts a valid update payload', () => {
    expect(updateTenantSchema.parse({ name: 'Acme Corp' })).toEqual({ name: 'Acme Corp' });
  });
});

describe('toCreateTenantPayload', () => {
  it('leaves a non-blank slug untouched', () => {
    expect(toCreateTenantPayload({ name: 'Acme', slug: 'acme' })).toEqual({
      name: 'Acme',
      slug: 'acme',
    });
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
