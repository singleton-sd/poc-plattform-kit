import type { TokenCredential } from '@azure/identity';
import { ManagerChainService } from './manager-chain.service';

function jsonResponse(status: number, body?: unknown) {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  } as Response;
}

function credentialReturning(token: string | null): TokenCredential {
  return {
    getToken: jest.fn().mockResolvedValue(token ? { token, expiresOnTimestamp: Date.now() } : null),
  } as unknown as TokenCredential;
}

describe('ManagerChainService', () => {
  it('returns an empty chain when the user has no manager (404)', async () => {
    const fetchFn = jest.fn().mockResolvedValue(jsonResponse(404));
    const service = new ManagerChainService({ credential: credentialReturning('t'), fetchFn });

    await expect(service.getManagerChain('user-1')).resolves.toEqual([]);
    expect(fetchFn).toHaveBeenCalledWith(
      'https://graph.microsoft.com/v1.0/users/user-1/manager?$select=id',
      { headers: { Authorization: 'Bearer t' } },
    );
  });

  it('resolves a single direct manager', async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { id: 'manager-1' }))
      .mockResolvedValueOnce(jsonResponse(404));
    const service = new ManagerChainService({ credential: credentialReturning('t'), fetchFn });

    await expect(service.getManagerChain('user-1')).resolves.toEqual(['manager-1']);
  });

  it('walks a multi-level reporting chain, direct manager first', async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { id: 'manager-1' }))
      .mockResolvedValueOnce(jsonResponse(200, { id: 'manager-2' }))
      .mockResolvedValueOnce(jsonResponse(404));
    const service = new ManagerChainService({ credential: credentialReturning('t'), fetchFn });

    await expect(service.getManagerChain('user-1')).resolves.toEqual(['manager-1', 'manager-2']);
  });

  it('stops at the configured depth cap instead of following the chain forever', async () => {
    const fetchFn = jest.fn().mockImplementation((url: string) => {
      const current = url.match(/users\/([^/]+)\/manager/)?.[1];
      const next = `${current}-up`;
      return Promise.resolve(jsonResponse(200, { id: next }));
    });
    const service = new ManagerChainService({ credential: credentialReturning('t'), fetchFn });

    await expect(service.getManagerChain('user-1', { maxDepth: 3 })).resolves.toEqual([
      'user-1-up',
      'user-1-up-up',
      'user-1-up-up-up',
    ]);
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it('stops on a cycle instead of looping forever', async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { id: 'manager-1' }))
      .mockResolvedValueOnce(jsonResponse(200, { id: 'user-1' }));
    const service = new ManagerChainService({ credential: credentialReturning('t'), fetchFn });

    await expect(service.getManagerChain('user-1', { maxDepth: 10 })).resolves.toEqual([
      'manager-1',
    ]);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('caches a direct-manager lookup within the TTL', async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { id: 'manager-1' }))
      .mockResolvedValueOnce(jsonResponse(404));
    let now = 0;
    const service = new ManagerChainService({
      credential: credentialReturning('t'),
      fetchFn,
      now: () => now,
    });

    await service.getManagerChain('user-1');
    expect(fetchFn).toHaveBeenCalledTimes(2);

    now += 1000;
    await service.getManagerChain('user-1');
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('re-fetches once the cache entry has expired', async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { id: 'manager-1' }))
      .mockResolvedValueOnce(jsonResponse(404))
      .mockResolvedValueOnce(jsonResponse(200, { id: 'manager-1' }))
      .mockResolvedValueOnce(jsonResponse(404));
    let now = 0;
    process.env.MANAGER_CHAIN_CACHE_TTL_MS = '500';
    const service = new ManagerChainService({
      credential: credentialReturning('t'),
      fetchFn,
      now: () => now,
    });

    await service.getManagerChain('user-1');
    now += 1000;
    await service.getManagerChain('user-1');

    expect(fetchFn).toHaveBeenCalledTimes(4);
    delete process.env.MANAGER_CHAIN_CACHE_TTL_MS;
  });

  it('treats a missing Graph token as no manager instead of throwing', async () => {
    const fetchFn = jest.fn();
    const service = new ManagerChainService({ credential: credentialReturning(null), fetchFn });

    await expect(service.getManagerChain('user-1')).resolves.toEqual([]);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('treats a Graph error response as no manager instead of throwing', async () => {
    const fetchFn = jest.fn().mockResolvedValue(jsonResponse(503));
    const service = new ManagerChainService({ credential: credentialReturning('t'), fetchFn });

    await expect(service.getManagerChain('user-1')).resolves.toEqual([]);
  });

  it('treats a fetch rejection as no manager instead of throwing', async () => {
    const fetchFn = jest.fn().mockRejectedValue(new Error('network down'));
    const service = new ManagerChainService({ credential: credentialReturning('t'), fetchFn });

    await expect(service.getManagerChain('user-1')).resolves.toEqual([]);
  });
});
