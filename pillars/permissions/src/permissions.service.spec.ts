import { PermissionsService } from './permissions.service';

describe('PermissionsService', () => {
  const originalEnv = process.env;
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.OPENFGA_API_URL;
    delete process.env.OPENFGA_STORE_ID;
    delete process.env.OPENFGA_AUTHORIZATION_MODEL_ID;
    global.fetch = jest.fn();
  });

  afterAll(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
  });

  it('reports that OpenFGA is not configured without URL and store', () => {
    expect(new PermissionsService().isConfigured()).toBe(false);
  });

  it('fails closed while OpenFGA is not configured', async () => {
    const service = new PermissionsService();

    await expect(
      service.check({
        subject: 'user:alice',
        action: 'viewer',
        resource: 'document:quarterly-report',
      }),
    ).resolves.toEqual({ allowed: false });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('checks the tuple with configured OpenFGA', async () => {
    process.env.OPENFGA_API_URL = 'https://openfga.example.test/';
    process.env.OPENFGA_STORE_ID = 'store-1';
    process.env.OPENFGA_AUTHORIZATION_MODEL_ID = 'model-1';
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ allowed: true }),
    });
    const service = new PermissionsService();

    await expect(
      service.check({ subject: 'user:alice', action: 'update', resource: 'tenant:one' }),
    ).resolves.toEqual({ allowed: true });
    expect(global.fetch).toHaveBeenCalledWith(
      'https://openfga.example.test/stores/store-1/check',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          tuple_key: { user: 'user:alice', relation: 'update', object: 'tenant:one' },
          authorization_model_id: 'model-1',
        }),
      }),
    );
  });

  it('fails closed when OpenFGA errors', async () => {
    process.env.OPENFGA_API_URL = 'https://openfga.example.test';
    process.env.OPENFGA_STORE_ID = 'store-1';
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 503 });

    await expect(
      new PermissionsService().check({
        subject: 'user:alice',
        action: 'update',
        resource: 'tenant:one',
      }),
    ).resolves.toEqual({ allowed: false });
  });
});
