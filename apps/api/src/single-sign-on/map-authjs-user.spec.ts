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

  it('returns null for incomplete profiles', () => {
    expect(mapAuthJsUserToAuthenticatedUser({ id: 'only-id' })).toBeNull();
  });
});
