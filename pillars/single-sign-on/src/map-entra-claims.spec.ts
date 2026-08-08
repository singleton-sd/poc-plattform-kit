import { mapEntraClaims, normalizeEntraRoles, toMeResponse } from './map-entra-claims';

describe('normalizeEntraRoles', () => {
  it('keeps all app roles and dedupes singular role', () => {
    expect(
      normalizeEntraRoles({
        roles: ['support-agent', 'tenant-admin'],
        role: 'support-agent',
      }),
    ).toEqual(['support-agent', 'tenant-admin']);
  });

  it('includes singular role when roles array is absent', () => {
    expect(normalizeEntraRoles({ role: 'tenant-admin' })).toEqual(['tenant-admin']);
  });

  it('returns empty when no roles are present', () => {
    expect(normalizeEntraRoles({})).toEqual([]);
  });
});

describe('mapEntraClaims', () => {
  it('maps oid, email, name, and all app roles', () => {
    expect(
      mapEntraClaims({
        oid: 'oid-1',
        sub: 'sub-ignored',
        email: 'agent@example.com',
        name: 'Agent',
        roles: ['support-agent', 'tenant-admin'],
      }),
    ).toEqual({
      entraOid: 'oid-1',
      email: 'agent@example.com',
      name: 'Agent',
      roles: ['support-agent', 'tenant-admin'],
      id: 'oid-1',
      tenantId: null,
    });
  });

  it('maps optional platform tenant_id claim', () => {
    expect(
      mapEntraClaims({
        oid: 'oid-1',
        email: 'a@b.com',
        tenant_id: ' tenant-xyz ',
      }).tenantId,
    ).toBe('tenant-xyz');
  });

  it('falls back to sub and preferred_username', () => {
    expect(
      mapEntraClaims({
        sub: 'sub-1',
        preferred_username: 'user@contoso.com',
      }),
    ).toEqual({
      entraOid: 'sub-1',
      email: 'user@contoso.com',
      name: null,
      roles: [],
      id: 'sub-1',
      tenantId: null,
    });
  });

  it('falls back to upn on access tokens without email', () => {
    expect(
      mapEntraClaims({
        oid: 'oid-1',
        upn: 'user@contoso.com',
      }).email,
    ).toBe('user@contoso.com');
  });

  it('uses localUserId when provided', () => {
    expect(mapEntraClaims({ oid: 'oid-1', email: 'a@b.com' }, 'cuid_local').id).toBe('cuid_local');
  });

  it('rejects tokens without oid/sub', () => {
    expect(() => mapEntraClaims({ email: 'a@b.com' })).toThrow(/oid\/sub/);
  });

  it('rejects tokens without email claims', () => {
    expect(() => mapEntraClaims({ oid: 'oid-1' })).toThrow(/email\/preferred_username\/upn/);
  });
});

describe('toMeResponse', () => {
  it('projects the web Me contract', () => {
    expect(
      toMeResponse({
        id: '1',
        entraOid: 'oid',
        email: 'a@b.com',
        name: 'A',
        roles: ['support-agent', 'tenant-admin'],
        tenantId: 'tenant-1',
      }),
    ).toEqual({
      id: '1',
      email: 'a@b.com',
      name: 'A',
      roles: ['support-agent', 'tenant-admin'],
    });
  });
});
