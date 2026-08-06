import { mapEntraClaims, toMeResponse } from './map-entra-claims';

describe('mapEntraClaims', () => {
  it('maps oid, email, name, and first app role', () => {
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
      role: 'support-agent',
      id: 'oid-1',
    });
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
      role: null,
      id: 'sub-1',
    });
  });

  it('uses localUserId when provided', () => {
    expect(mapEntraClaims({ oid: 'oid-1', email: 'a@b.com' }, 'cuid_local').id).toBe('cuid_local');
  });

  it('rejects tokens without oid/sub', () => {
    expect(() => mapEntraClaims({ email: 'a@b.com' })).toThrow(/oid\/sub/);
  });

  it('rejects tokens without email', () => {
    expect(() => mapEntraClaims({ oid: 'oid-1' })).toThrow(/email/);
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
        role: 'support-agent',
      }),
    ).toEqual({
      id: '1',
      email: 'a@b.com',
      name: 'A',
      role: 'support-agent',
    });
  });
});
