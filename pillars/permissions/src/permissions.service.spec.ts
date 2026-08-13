import type { TokenCredential } from '@azure/identity';
import { PermissionGrantType } from './dto/grant-permission.dto';
import { oneTimeGrantObject, PermissionsService } from './permissions.service';

describe('PermissionsService', () => {
  const originalEnv = process.env;
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.OPENFGA_API_URL;
    delete process.env.OPENFGA_STORE_ID;
    delete process.env.OPENFGA_AUTHORIZATION_MODEL_ID;
    delete process.env.OPENFGA_AUDIENCE;
    global.fetch = jest.fn();
  });

  afterAll(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
  });

  function configureOpenFga(): void {
    process.env.OPENFGA_API_URL = 'https://openfga.example.test/';
    process.env.OPENFGA_STORE_ID = 'store-1';
    process.env.OPENFGA_AUTHORIZATION_MODEL_ID = 'model-1';
  }

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

  it('checks the tuple with configured OpenFGA and current_time context', async () => {
    configureOpenFga();
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
        body: expect.stringContaining('"relation":"update"'),
      }),
    );
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body as string) as {
      context: { current_time: string };
      authorization_model_id: string;
    };
    expect(body.authorization_model_id).toBe('model-1');
    expect(Date.parse(body.context.current_time)).not.toBeNaN();
  });

  it('sends a Bearer token when OPENFGA_AUDIENCE is set', async () => {
    configureOpenFga();
    process.env.OPENFGA_AUDIENCE = 'api://ssd-pocpk-openfga';
    const credential: TokenCredential = {
      getToken: jest.fn().mockResolvedValue({
        token: 'openfga-access-token',
        expiresOnTimestamp: Date.now() + 3_600_000,
      }),
    };
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ allowed: true }),
    });

    const service = new PermissionsService();
    service.setTokenCredential(credential);
    await service.check({
      subject: 'user:alice',
      action: 'read',
      resource: 'tenant:one',
    });

    expect(credential.getToken).toHaveBeenCalledWith('api://ssd-pocpk-openfga/.default');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://openfga.example.test/stores/store-1/check',
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: 'Bearer openfga-access-token',
        }),
      }),
    );
  });

  it('fails closed when OpenFGA check errors', async () => {
    configureOpenFga();
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 503 });

    await expect(
      new PermissionsService().check({
        subject: 'user:alice',
        action: 'update',
        resource: 'tenant:one',
      }),
    ).resolves.toEqual({ allowed: false });
  });

  it('writes a tenant-local group membership tuple', async () => {
    configureOpenFga();
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({}) });

    await expect(new PermissionsService().addTenantGroupMember('group-1', 'user-1')).resolves.toBe(
      true,
    );

    expect(global.fetch).toHaveBeenCalledWith(
      'https://openfga.example.test/stores/store-1/write',
      expect.objectContaining({
        body: JSON.stringify({
          writes: {
            tuple_keys: [{ user: 'user:user-1', relation: 'member', object: 'group:group-1' }],
          },
          authorization_model_id: 'model-1',
        }),
      }),
    );
  });

  it('deletes a tenant-local group membership tuple', async () => {
    configureOpenFga();
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({}) });

    await expect(
      new PermissionsService().removeTenantGroupMember('group-1', 'user-1'),
    ).resolves.toBe(true);

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body as string);
    expect(body.deletes.tuple_keys).toEqual([
      { user: 'user:user-1', relation: 'member', object: 'group:group-1' },
    ]);
  });

  it('fails closed for group membership writes when OpenFGA is unavailable', async () => {
    const service = new PermissionsService();

    await expect(service.addTenantGroupMember('group-1', 'user-1')).resolves.toBe(false);
    await expect(service.removeTenantGroupMember('group-1', 'user-1')).resolves.toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('detects whether a group principal currently holds the tenant owner role', async () => {
    configureOpenFga();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ allowed: true }),
    });

    await expect(new PermissionsService().isTenantGroupOwner('tenant-1', 'group-1')).resolves.toBe(
      true,
    );

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body as string);
    expect(body.tuple_key).toEqual({
      user: 'group:group-1#member',
      relation: 'owner',
      object: 'tenant:tenant-1',
    });
  });

  it('fails closed when group owner status cannot be checked', async () => {
    await expect(new PermissionsService().isTenantGroupOwner('tenant-1', 'group-1')).resolves.toBe(
      true,
    );
  });

  it('grants a permanent tuple via OpenFGA write', async () => {
    configureOpenFga();
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({}) });

    await expect(
      new PermissionsService().grant({
        subject: 'user:alice',
        action: 'update',
        resource: 'tenant:one',
        grantType: PermissionGrantType.Permanent,
      }),
    ).resolves.toEqual({ granted: true, grantType: PermissionGrantType.Permanent });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://openfga.example.test/stores/store-1/write',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          writes: {
            tuple_keys: [{ user: 'user:alice', relation: 'update', object: 'tenant:one' }],
          },
          authorization_model_id: 'model-1',
        }),
      }),
    );
  });

  it('grants a temporary tuple with not_yet_expired condition shape', async () => {
    configureOpenFga();
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({}) });
    const expiresAt = '2030-01-01T00:00:00.000Z';

    await expect(
      new PermissionsService().grant({
        subject: 'user:alice',
        action: 'read',
        resource: 'tenant:one',
        grantType: PermissionGrantType.Temporary,
        expiresAt,
      }),
    ).resolves.toEqual({ granted: true, grantType: PermissionGrantType.Temporary });

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body as string) as {
      writes: {
        tuple_keys: Array<{ condition?: { name: string; context: { expiry_time: string } } }>;
      };
    };
    expect(body.writes.tuple_keys[0].condition).toEqual({
      name: 'not_yet_expired',
      context: { expiry_time: expiresAt },
    });
  });

  it('rejects temporary grants without a future expiresAt', async () => {
    configureOpenFga();
    const service = new PermissionsService();

    await expect(
      service.grant({
        subject: 'user:alice',
        action: 'read',
        resource: 'tenant:one',
        grantType: PermissionGrantType.Temporary,
      }),
    ).resolves.toEqual({ granted: false, grantType: PermissionGrantType.Temporary });

    await expect(
      service.grant({
        subject: 'user:alice',
        action: 'read',
        resource: 'tenant:one',
        grantType: PermissionGrantType.Temporary,
        expiresAt: '2000-01-01T00:00:00.000Z',
      }),
    ).resolves.toEqual({ granted: false, grantType: PermissionGrantType.Temporary });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('grants a one-time tuple with a companion pending marker', async () => {
    configureOpenFga();
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({}) });

    await expect(
      new PermissionsService().grant({
        subject: 'user:alice',
        action: 'update',
        resource: 'tenant:one',
        grantType: PermissionGrantType.OneTime,
      }),
    ).resolves.toEqual({ granted: true, grantType: PermissionGrantType.OneTime });

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body as string) as {
      writes: { tuple_keys: Array<{ user: string; relation: string; object: string }> };
    };
    expect(body.writes.tuple_keys).toEqual([
      { user: 'user:alice', relation: 'update', object: 'tenant:one' },
      {
        user: 'user:alice',
        relation: 'pending',
        object: oneTimeGrantObject('tenant:one', 'update'),
      },
    ]);
  });

  it('revokes the one-time marker before allowing access (fail closed on delete)', async () => {
    configureOpenFga();
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ allowed: true }) }) // action check
      .mockResolvedValueOnce({ ok: true, json: async () => ({ allowed: true }) }) // marker check
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) }) // delete marker
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) }); // delete action

    await expect(
      new PermissionsService().check({
        subject: 'user:alice',
        action: 'update',
        resource: 'tenant:one',
      }),
    ).resolves.toEqual({ allowed: true });

    expect(global.fetch).toHaveBeenNthCalledWith(
      3,
      'https://openfga.example.test/stores/store-1/write',
      expect.objectContaining({
        body: JSON.stringify({
          deletes: {
            tuple_keys: [
              {
                user: 'user:alice',
                relation: 'pending',
                object: oneTimeGrantObject('tenant:one', 'update'),
              },
            ],
          },
          authorization_model_id: 'model-1',
        }),
      }),
    );
  });

  it('denies when one-time marker delete fails (lost race / write error)', async () => {
    configureOpenFga();
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ allowed: true }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ allowed: true }) })
      .mockResolvedValueOnce({ ok: false, status: 409 });

    await expect(
      new PermissionsService().check({
        subject: 'user:alice',
        action: 'update',
        resource: 'tenant:one',
      }),
    ).resolves.toEqual({ allowed: false });
  });

  it('revokes via OpenFGA write deletes', async () => {
    configureOpenFga();
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({}) });

    await expect(
      new PermissionsService().revoke({
        subject: 'user:alice',
        action: 'update',
        resource: 'tenant:one',
      }),
    ).resolves.toEqual({ revoked: true });
  });

  it('fails closed when OpenFGA write errors on grant', async () => {
    configureOpenFga();
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 500 });

    await expect(
      new PermissionsService().grant({
        subject: 'user:alice',
        action: 'update',
        resource: 'tenant:one',
        grantType: PermissionGrantType.Permanent,
      }),
    ).resolves.toEqual({ granted: false, grantType: PermissionGrantType.Permanent });
  });
});
