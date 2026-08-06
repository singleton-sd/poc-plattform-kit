import { mapAuthJsUserToAuthenticatedUser } from './map-authjs-user';

describe('mapAuthJsUserToAuthenticatedUser', () => {
  it('maps Auth.js user profile to AuthenticatedUser', () => {
    expect(
      mapAuthJsUserToAuthenticatedUser({
        id: 'sub-1',
        email: 'agent@example.com',
        name: 'Agent',
        roles: ['support-agent'],
      }),
    ).toEqual({
      entraOid: 'sub-1',
      email: 'agent@example.com',
      name: 'Agent',
      role: 'support-agent',
      id: 'sub-1',
    });
  });

  it('returns null for incomplete profiles', () => {
    expect(mapAuthJsUserToAuthenticatedUser({ id: 'only-id' })).toBeNull();
  });
});
