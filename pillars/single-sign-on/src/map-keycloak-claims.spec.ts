import {
  isEmailVerifiedClaim,
  mapKeycloakClaims,
  normalizeKeycloakRoles,
  toMeResponse,
} from './map-keycloak-claims';

describe('normalizeKeycloakRoles', () => {
  it('unions realm, resource, and claim roles', () => {
    expect(
      normalizeKeycloakRoles(
        {
          roles: ['support-agent'],
          role: 'support-agent',
          realm_access: { roles: ['tenant-admin'] },
          resource_access: {
            'platform-kit-api': { roles: ['support-agent', 'viewer'] },
            'other-app': { roles: ['tenant-admin'] },
          },
        },
        ['platform-kit-api'],
      ),
    ).toEqual(['support-agent', 'tenant-admin', 'viewer']);
  });

  it('ignores resource_access roles from unrelated clients', () => {
    expect(
      normalizeKeycloakRoles(
        {
          resource_access: { 'other-app': { roles: ['tenant-admin'] } },
        },
        ['platform-kit-api'],
      ),
    ).toEqual([]);
  });

  it('returns empty when no roles are present', () => {
    expect(normalizeKeycloakRoles({})).toEqual([]);
  });
});

describe('isEmailVerifiedClaim', () => {
  it('accepts boolean and string true', () => {
    expect(isEmailVerifiedClaim(true)).toBe(true);
    expect(isEmailVerifiedClaim('true')).toBe(true);
    expect(isEmailVerifiedClaim(false)).toBe(false);
    expect(isEmailVerifiedClaim('false')).toBe(false);
    expect(isEmailVerifiedClaim(undefined)).toBe(false);
  });
});

describe('mapKeycloakClaims', () => {
  it('maps sub, email, name, and roles', () => {
    expect(
      mapKeycloakClaims({
        sub: 'kc-sub-1',
        email: 'agent@example.com',
        name: 'Agent',
        email_verified: true,
        realm_access: { roles: ['tenant-admin'] },
      }),
    ).toEqual({
      keycloakSub: 'kc-sub-1',
      entraOid: null,
      email: 'agent@example.com',
      name: 'Agent',
      roles: ['tenant-admin'],
      id: 'kc-sub-1',
      tenantId: null,
      emailVerified: true,
    });
  });

  it('maps optional platform tenant_id claim', () => {
    expect(
      mapKeycloakClaims({
        sub: 'kc-sub-1',
        email: 'a@b.com',
        email_verified: true,
        tenant_id: ' tenant-xyz ',
      }).tenantId,
    ).toBe('tenant-xyz');
  });

  it('uses given/family name and requires a real email claim', () => {
    expect(
      mapKeycloakClaims({
        sub: 'kc-sub-1',
        email: 'user@example.com',
        preferred_username: 'ada',
        given_name: 'Ada',
        family_name: 'Lovelace',
        email_verified: 'true',
      }),
    ).toMatchObject({
      email: 'user@example.com',
      name: 'Ada Lovelace',
      emailVerified: true,
    });
  });

  it('uses localUserId when provided', () => {
    expect(mapKeycloakClaims({ sub: 'kc-sub-1', email: 'a@b.com' }, 'cuid_local').id).toBe(
      'cuid_local',
    );
  });

  it('rejects tokens without sub', () => {
    expect(() => mapKeycloakClaims({ email: 'a@b.com' })).toThrow(/missing sub/);
  });

  it('rejects tokens without email claims', () => {
    expect(() => mapKeycloakClaims({ sub: 'kc-sub-1' })).toThrow(/missing email/);
    expect(() =>
      mapKeycloakClaims({ sub: 'kc-sub-1', preferred_username: 'user@example.com' }),
    ).toThrow(/missing email/);
  });
});

describe('toMeResponse', () => {
  it('projects the web Me contract', () => {
    expect(
      toMeResponse({
        id: '1',
        keycloakSub: 'kc-sub',
        entraOid: null,
        email: 'a@b.com',
        name: 'A',
        roles: ['support-agent', 'tenant-admin'],
        tenantId: 'tenant-1',
        emailVerified: true,
      }),
    ).toEqual({
      id: '1',
      email: 'a@b.com',
      name: 'A',
      roles: ['support-agent', 'tenant-admin'],
    });
  });
});
