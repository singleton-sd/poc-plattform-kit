import { mapAuthJsUserToAuthenticatedUser } from './map-authjs-user';

describe('mapAuthJsUserToAuthenticatedUser', () => {
  it('maps Auth.js user profile to AuthenticatedUser', () => {
    expect(
      mapAuthJsUserToAuthenticatedUser({
        id: 'kc-sub-1',
        email: 'agent@example.com',
        name: 'Agent',
        email_verified: true,
        roles: ['support-agent'],
        tenant_id: 'tenant-1',
      }),
    ).toEqual({
      keycloakSub: 'kc-sub-1',
      entraOid: null,
      email: 'agent@example.com',
      name: 'Agent',
      roles: ['support-agent'],
      id: 'kc-sub-1',
      tenantId: 'tenant-1',
      emailVerified: true,
    });
  });

  it('does not treat preferred_username as an email', () => {
    expect(
      mapAuthJsUserToAuthenticatedUser({
        sub: 'kc-sub-1',
        preferred_username: 'agent@example.com',
        realm_access: { roles: ['tenant-admin'] },
      }),
    ).toBeNull();
  });

  it('returns null for incomplete profiles', () => {
    expect(mapAuthJsUserToAuthenticatedUser({ id: 'only-id' })).toBeNull();
  });
});
