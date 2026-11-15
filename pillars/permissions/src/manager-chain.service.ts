import { DefaultAzureCredential, type TokenCredential } from '@azure/identity';
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';

const GRAPH_SCOPE = 'https://graph.microsoft.com/.default';
const GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0';
const DEFAULT_MAX_DEPTH = 5;
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;
const MANAGER_CHAIN_PROVIDERS = ['graph', 'none'] as const;

export type ManagerChainProvider = (typeof MANAGER_CHAIN_PROVIDERS)[number];

interface CacheEntry {
  managerId: string | null;
  expiresAt: number;
}

interface DirectManagerResult {
  managerId: string | null;
  /** Only definitive outcomes (a resolved manager, or a confirmed 404) are cacheable. */
  cacheable: boolean;
}

export interface ManagerChainDependencies {
  credential?: TokenCredential;
  fetchFn?: typeof fetch;
  now?: () => number;
}

function isManagerChainProvider(value: string): value is ManagerChainProvider {
  return (MANAGER_CHAIN_PROVIDERS as readonly string[]).includes(value);
}

export function resolveManagerChainProvider(
  raw: string | undefined = process.env.MANAGER_CHAIN_PROVIDER,
): ManagerChainProvider {
  const value = raw?.trim();
  if (!value) {
    return 'graph';
  }
  if (isManagerChainProvider(value)) {
    return value;
  }
  throw new Error(`Invalid MANAGER_CHAIN_PROVIDER '${value}'. Allowed values: graph, none.`);
}

/**
 * Resolves a user's Entra reporting-line chain (direct manager, their
 * manager, and so on) via Microsoft Graph `/users/{id}/manager`. Read-only —
 * never writes to Entra. Feeds Access Request approver computation alongside
 * tenant admins (see Architecture Doc "Permissions & Access Requests").
 *
 * Constructor takes no arguments so Nest's DI container can instantiate this
 * class directly (an interface-typed constructor parameter compiles to an
 * unregistered `Object` provider and breaks app boot). Use
 * `ManagerChainService.createForTesting(...)` to override the Graph
 * credential/fetch/clock in tests.
 *
 * `MANAGER_CHAIN_PROVIDER=graph` (default when unset) uses Microsoft Graph
 * via `DefaultAzureCredential`, constructed lazily on the first lookup.
 * `none` always returns no manager (Coolify / no managed identity). Unknown
 * values fail closed at construction so Nest startup cannot silently skip
 * manager resolution.
 */
@Injectable()
export class ManagerChainService implements OnModuleInit {
  private readonly logger = new Logger(ManagerChainService.name);
  private readonly provider: ManagerChainProvider;
  private credential: TokenCredential | undefined;
  private fetchFn: typeof fetch = fetch;
  private now: () => number = () => Date.now();
  private readonly cache = new Map<string, CacheEntry>();

  constructor() {
    this.provider = resolveManagerChainProvider();
  }

  onModuleInit(): void {
    if (this.provider === 'none') {
      this.logger.log(
        'Manager chain lookups are disabled (MANAGER_CHAIN_PROVIDER=none); ' +
          'access-request approval falls back to tenant-admin only',
      );
    }
  }

  static createForTesting(dependencies: ManagerChainDependencies): ManagerChainService {
    const service = new ManagerChainService();
    if (dependencies.credential) service.credential = dependencies.credential;
    if (dependencies.fetchFn) service.fetchFn = dependencies.fetchFn;
    if (dependencies.now) service.now = dependencies.now;
    return service;
  }

  private get maxDepth(): number {
    const raw = process.env.MANAGER_CHAIN_MAX_DEPTH?.trim();
    const parsed = raw ? Number.parseInt(raw, 10) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_DEPTH;
  }

  private get cacheTtlMs(): number {
    const raw = process.env.MANAGER_CHAIN_CACHE_TTL_MS?.trim();
    const parsed = raw ? Number.parseInt(raw, 10) : NaN;
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_CACHE_TTL_MS;
  }

  private getCredential(): TokenCredential {
    if (!this.credential) {
      this.credential = new DefaultAzureCredential();
    }
    return this.credential;
  }

  /**
   * Ordered chain of manager Entra object ids for `userId`, direct manager
   * first. Stops at the first missing link, a cycle, or the depth cap —
   * never throws for "no manager" or "chain ended"; Graph/token failures
   * are logged and treated as "no manager" so callers can fail closed on
   * their own terms (e.g. fall back to tenant-admin-only approval).
   */
  async getManagerChain(userId: string, options: { maxDepth?: number } = {}): Promise<string[]> {
    switch (this.provider) {
      case 'none':
        return [];
      case 'graph':
        break;
      default: {
        const exhaustive: never = this.provider;
        throw new Error(`Unhandled manager chain provider: ${String(exhaustive)}`);
      }
    }

    const limit = options.maxDepth ?? this.maxDepth;
    const chain: string[] = [];
    const seen = new Set<string>([userId]);
    let currentId = userId;

    for (let depth = 0; depth < limit; depth += 1) {
      const managerId = await this.resolveDirectManager(currentId);
      if (!managerId || seen.has(managerId)) {
        break;
      }
      chain.push(managerId);
      seen.add(managerId);
      currentId = managerId;
    }

    return chain;
  }

  private async resolveDirectManager(userId: string): Promise<string | null> {
    const cached = this.cache.get(userId);
    if (cached && cached.expiresAt > this.now()) {
      return cached.managerId;
    }

    const result = await this.fetchDirectManager(userId);
    if (result.cacheable) {
      this.cache.set(userId, {
        managerId: result.managerId,
        expiresAt: this.now() + this.cacheTtlMs,
      });
    }
    return result.managerId;
  }

  /**
   * Only a resolved manager or a confirmed 404 ("definitely no manager") are
   * cacheable. Token failures, 401/403, throttling, 5xx, and network errors
   * are transient/operational — caching those would suppress correct
   * resolution for a full TTL window after Graph recovers.
   */
  private async fetchDirectManager(userId: string): Promise<DirectManagerResult> {
    if (this.provider === 'none') {
      return { managerId: null, cacheable: true };
    }

    let token;
    try {
      token = await this.getCredential().getToken(GRAPH_SCOPE);
    } catch (error) {
      this.logger.warn(`Graph token acquisition failed for ${userId}: ${(error as Error).message}`);
      return { managerId: null, cacheable: false };
    }
    if (!token) {
      this.logger.warn('Unable to acquire a Graph token; treating manager as unresolved');
      return { managerId: null, cacheable: false };
    }

    let response: Response;
    try {
      response = await this.fetchFn(
        `${GRAPH_BASE_URL}/users/${encodeURIComponent(userId)}/manager?$select=id`,
        { headers: { Authorization: `Bearer ${token.token}` } },
      );
    } catch (error) {
      this.logger.warn(`Graph manager lookup errored for ${userId}: ${(error as Error).message}`);
      return { managerId: null, cacheable: false };
    }

    if (response.status === 404) {
      return { managerId: null, cacheable: true };
    }
    if (response.status === 401 || response.status === 403) {
      this.logger.error(
        `Graph manager lookup for ${userId} was denied (HTTP ${response.status}). The API's ` +
          'identity likely lacks the Microsoft Graph application permission "User.Read.All" ' +
          '(admin consent required) — see Architecture Doc "Permissions & Access Requests".',
      );
      return { managerId: null, cacheable: false };
    }
    if (!response.ok) {
      this.logger.warn(`Graph manager lookup failed for ${userId}: HTTP ${response.status}`);
      return { managerId: null, cacheable: false };
    }

    const body = (await response.json()) as { id?: unknown };
    const managerId = typeof body.id === 'string' && body.id ? body.id : null;
    return { managerId, cacheable: true };
  }
}
