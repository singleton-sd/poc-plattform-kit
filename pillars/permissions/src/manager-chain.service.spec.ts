import { DefaultAzureCredential, type TokenCredential } from '@azure/identity';
import { Logger } from '@nestjs/common';
import { ManagerChainService, resolveManagerChainProvider } from './manager-chain.service';

jest.mock('@azure/identity', () => {
  const DefaultAzureCredential = jest.fn();
  return { DefaultAzureCredential };
});

const MockDefaultAzureCredential = DefaultAzureCredential as unknown as jest.Mock;

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
    const service = ManagerChainService.createForTesting({
      credential: credentialReturning('t'),
      fetchFn,
    });

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
    const service = ManagerChainService.createForTesting({
      credential: credentialReturning('t'),
      fetchFn,
    });

    await expect(service.getManagerChain('user-1')).resolves.toEqual(['manager-1']);
  });

  it('walks a multi-level reporting chain, direct manager first', async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { id: 'manager-1' }))
      .mockResolvedValueOnce(jsonResponse(200, { id: 'manager-2' }))
      .mockResolvedValueOnce(jsonResponse(404));
    const service = ManagerChainService.createForTesting({
      credential: credentialReturning('t'),
      fetchFn,
    });

    await expect(service.getManagerChain('user-1')).resolves.toEqual(['manager-1', 'manager-2']);
  });

  it('stops at the configured depth cap instead of following the chain forever', async () => {
    const fetchFn = jest.fn().mockImplementation((url: string) => {
      const current = url.match(/users\/([^/]+)\/manager/)?.[1];
      const next = `${current}-up`;
      return Promise.resolve(jsonResponse(200, { id: next }));
    });
    const service = ManagerChainService.createForTesting({
      credential: credentialReturning('t'),
      fetchFn,
    });

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
    const service = ManagerChainService.createForTesting({
      credential: credentialReturning('t'),
      fetchFn,
    });

    await expect(service.getManagerChain('user-1', { maxDepth: 10 })).resolves.toEqual([
      'manager-1',
    ]);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('caches a definitive lookup (found manager, and confirmed no-manager) within the TTL', async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { id: 'manager-1' }))
      .mockResolvedValueOnce(jsonResponse(404));
    let now = 0;
    const service = ManagerChainService.createForTesting({
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
    const service = ManagerChainService.createForTesting({
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

  it('treats a missing Graph token as no manager instead of throwing, and does not cache it', async () => {
    const fetchFn = jest.fn();
    const service = ManagerChainService.createForTesting({
      credential: credentialReturning(null),
      fetchFn,
    });

    await expect(service.getManagerChain('user-1')).resolves.toEqual([]);
    expect(fetchFn).not.toHaveBeenCalled();

    // A retry should acquire a token again rather than trusting a cached failure.
    await service.getManagerChain('user-1');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('treats a permission-denied response (403) as no manager, logs it, and does not cache it', async () => {
    const fetchFn = jest.fn().mockResolvedValue(jsonResponse(403));
    const service = ManagerChainService.createForTesting({
      credential: credentialReturning('t'),
      fetchFn,
    });

    await expect(service.getManagerChain('user-1')).resolves.toEqual([]);
    expect(fetchFn).toHaveBeenCalledTimes(1);

    // Not cached: a second call retries Graph instead of trusting the denial forever.
    await service.getManagerChain('user-1');
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('treats a Graph error response (5xx) as no manager instead of throwing, and does not cache it', async () => {
    const fetchFn = jest.fn().mockResolvedValue(jsonResponse(503));
    const service = ManagerChainService.createForTesting({
      credential: credentialReturning('t'),
      fetchFn,
    });

    await expect(service.getManagerChain('user-1')).resolves.toEqual([]);

    await service.getManagerChain('user-1');
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('treats a fetch rejection as no manager instead of throwing, and does not cache it', async () => {
    const fetchFn = jest.fn().mockRejectedValue(new Error('network down'));
    const service = ManagerChainService.createForTesting({
      credential: credentialReturning('t'),
      fetchFn,
    });

    await expect(service.getManagerChain('user-1')).resolves.toEqual([]);

    await service.getManagerChain('user-1');
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
});

describe('MANAGER_CHAIN_PROVIDER', () => {
  const originalProvider = process.env.MANAGER_CHAIN_PROVIDER;
  const mockGetToken = jest.fn();

  beforeEach(() => {
    delete process.env.MANAGER_CHAIN_PROVIDER;
    mockGetToken.mockReset();
    MockDefaultAzureCredential.mockReset();
    MockDefaultAzureCredential.mockImplementation(() => ({ getToken: mockGetToken }));
  });

  afterEach(() => {
    if (originalProvider === undefined) {
      delete process.env.MANAGER_CHAIN_PROVIDER;
    } else {
      process.env.MANAGER_CHAIN_PROVIDER = originalProvider;
    }
  });

  it.each([
    ['graph', 'graph'],
    ['unset', undefined],
    ['blank', '  '],
  ] as const)(
    'treats %s as graph and constructs DefaultAzureCredential lazily',
    async (_label, value) => {
      if (value === undefined) {
        delete process.env.MANAGER_CHAIN_PROVIDER;
      } else {
        process.env.MANAGER_CHAIN_PROVIDER = value;
      }
      mockGetToken.mockResolvedValue({ token: 't', expiresOnTimestamp: Date.now() });
      const fetchFn = jest.fn().mockResolvedValue(jsonResponse(404));
      const service = ManagerChainService.createForTesting({ fetchFn });

      expect(MockDefaultAzureCredential).not.toHaveBeenCalled();
      await expect(service.getManagerChain('user-1')).resolves.toEqual([]);
      expect(MockDefaultAzureCredential).toHaveBeenCalledTimes(1);
      expect(mockGetToken).toHaveBeenCalledWith('https://graph.microsoft.com/.default');
      expect(fetchFn).toHaveBeenCalledTimes(1);
    },
  );

  it('returns no manager without Azure credentials, network, or warning spam when provider is none', async () => {
    process.env.MANAGER_CHAIN_PROVIDER = 'none';
    const fetchFn = jest.fn();
    const getToken = jest.fn();
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const service = ManagerChainService.createForTesting({
      credential: { getToken } as unknown as TokenCredential,
      fetchFn,
    });

    service.onModuleInit();
    await expect(service.getManagerChain('user-1')).resolves.toEqual([]);
    await expect(service.getManagerChain('user-2')).resolves.toEqual([]);

    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('Manager chain lookups are disabled'));
    expect(MockDefaultAzureCredential).not.toHaveBeenCalled();
    expect(getToken).not.toHaveBeenCalled();
    expect(fetchFn).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    warn.mockRestore();
    error.mockRestore();
    log.mockRestore();
  });

  it('fails closed at startup for unknown provider values', () => {
    expect(() => resolveManagerChainProvider('ldap')).toThrow(
      "Invalid MANAGER_CHAIN_PROVIDER 'ldap'. Allowed values: graph, none.",
    );
    process.env.MANAGER_CHAIN_PROVIDER = 'ldap';
    expect(() => new ManagerChainService()).toThrow(
      "Invalid MANAGER_CHAIN_PROVIDER 'ldap'. Allowed values: graph, none.",
    );
    expect(MockDefaultAzureCredential).not.toHaveBeenCalled();
  });
});
