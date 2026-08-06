import { createTenantSchema, updateTenantSchema } from './schemas';

describe('tenant schemas', () => {
  it('accepts a valid create payload', () => {
    expect(createTenantSchema.parse({ name: 'Acme', slug: 'acme' })).toEqual({
      name: 'Acme',
      slug: 'acme',
    });
  });

  it('rejects an invalid slug', () => {
    expect(() => createTenantSchema.parse({ name: 'Acme', slug: 'Acme!' })).toThrow();
  });

  it('accepts a valid update payload', () => {
    expect(updateTenantSchema.parse({ name: 'Acme Corp' })).toEqual({ name: 'Acme Corp' });
  });
});
