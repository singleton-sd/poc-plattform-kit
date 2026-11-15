import {
  OPENFGA_AUTH_BOTH_ERROR,
  OPENFGA_AUTH_NEITHER_ERROR,
  assertOpenFgaAuthConfig,
  openFgaApiTokenHeader,
  resolveOpenFgaAuthMode,
} from './open-fga-auth';

const secretToken = 'super-secret-openfga-api-token';

describe('open-fga-auth', () => {
  const originalEnv = process.env;
  let consoleSpies: Array<jest.SpyInstance>;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.OPENFGA_API_URL;
    delete process.env.OPENFGA_STORE_ID;
    delete process.env.OPENFGA_API_TOKEN;
    delete process.env.OPENFGA_AUDIENCE;
    consoleSpies = (['log', 'info', 'warn', 'error', 'debug', 'trace'] as const).map((method) =>
      jest.spyOn(console, method).mockImplementation(() => undefined),
    );
  });

  afterEach(() => {
    for (const spy of consoleSpies) {
      spy.mockRestore();
    }
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  function capturedConsole(): string {
    return consoleSpies
      .flatMap((spy) => spy.mock.calls)
      .flat()
      .map((value) => (typeof value === 'string' ? value : JSON.stringify(value)))
      .join('\n');
  }

  it('selects api-token when OPENFGA_API_TOKEN is set', () => {
    process.env.OPENFGA_API_TOKEN = secretToken;
    expect(resolveOpenFgaAuthMode()).toBe('api-token');
    expect(openFgaApiTokenHeader()).toEqual({ authorization: `Bearer ${secretToken}` });
    expect(capturedConsole()).not.toContain(secretToken);
  });

  it('selects azure when OPENFGA_AUDIENCE is set', () => {
    process.env.OPENFGA_AUDIENCE = 'api://ssd-pocpk-openfga';
    expect(resolveOpenFgaAuthMode()).toBe('azure');
  });

  it('treats whitespace-only token or audience as unset', () => {
    process.env.OPENFGA_API_TOKEN = '  ';
    process.env.OPENFGA_AUDIENCE = '\t';
    expect(resolveOpenFgaAuthMode()).toBe('none');
  });

  it('fails closed when both token and audience are set', () => {
    process.env.OPENFGA_API_TOKEN = secretToken;
    process.env.OPENFGA_AUDIENCE = 'api://ssd-pocpk-openfga';

    expect(() => assertOpenFgaAuthConfig()).toThrow(OPENFGA_AUTH_BOTH_ERROR);
    try {
      assertOpenFgaAuthConfig();
    } catch (error) {
      expect((error as Error).message).not.toContain(secretToken);
    }
    expect(capturedConsole()).not.toContain(secretToken);
  });

  it('fails closed when OpenFGA is configured with neither auth method', () => {
    process.env.OPENFGA_API_URL = 'https://openfga.example.test';
    process.env.OPENFGA_STORE_ID = 'store-1';

    expect(() => assertOpenFgaAuthConfig()).toThrow(OPENFGA_AUTH_NEITHER_ERROR);
  });

  it('allows neither auth method when OpenFGA is not configured', () => {
    expect(() => assertOpenFgaAuthConfig()).not.toThrow();
    expect(resolveOpenFgaAuthMode()).toBe('none');
  });

  it('accepts token-only and audience-only startup configs', () => {
    process.env.OPENFGA_API_URL = 'https://openfga.example.test';
    process.env.OPENFGA_STORE_ID = 'store-1';

    process.env.OPENFGA_API_TOKEN = secretToken;
    expect(() => assertOpenFgaAuthConfig()).not.toThrow();

    delete process.env.OPENFGA_API_TOKEN;
    process.env.OPENFGA_AUDIENCE = 'api://ssd-pocpk-openfga';
    expect(() => assertOpenFgaAuthConfig()).not.toThrow();
    expect(capturedConsole()).not.toContain(secretToken);
  });
});
