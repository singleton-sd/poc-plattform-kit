import { createTenantFixtures, FIXED_NOW, tenantFixtures } from './tenants';

describe('tenant story fixtures', () => {
  it('uses stable synthetic identifiers and timestamps', () => {
    expect(tenantFixtures.map(({ id }) => id)).toEqual([
      '00000000-0000-4000-8000-000000000101',
      '00000000-0000-4000-8000-000000000102',
    ]);
    expect(tenantFixtures[0].updatedAt).toBe(FIXED_NOW);
  });

  it('returns isolated copies for each scenario', () => {
    const first = createTenantFixtures();
    const second = createTenantFixtures();

    first[0].name = 'Changed in one story';
    expect(second[0].name).toBe('Example North');
  });
});
