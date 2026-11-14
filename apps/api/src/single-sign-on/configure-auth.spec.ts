import type { Express } from 'express';
import { configureSingleSignOnAuth } from './configure-auth';

jest.mock('./auth.config', () => ({
  buildAuthConfig: jest.fn(() => ({})),
}));

jest.mock('@auth/express', () => ({
  ExpressAuth: jest.fn(() => jest.fn()),
  getSession: jest.fn(),
}));

describe('configureSingleSignOnAuth', () => {
  const originalEnvironment = process.env;

  beforeEach(() => {
    process.env = {
      AUTH_SECRET: 'secret',
      KEYCLOAK_CLIENT_ID: 'client',
      KEYCLOAK_CLIENT_SECRET: 'client-secret',
      KEYCLOAK_ISSUER: 'https://auth.example.test/realms/singletonsd',
    };
  });

  afterAll(() => {
    process.env = originalEnvironment;
  });

  it('does not replace the bootstrap trust proxy policy', () => {
    const expressApp = {
      set: jest.fn(),
      use: jest.fn(),
    } as unknown as Express;

    configureSingleSignOnAuth(expressApp);

    expect(expressApp.set).not.toHaveBeenCalled();
  });
});
