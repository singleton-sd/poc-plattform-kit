import { Injectable, Logger } from '@nestjs/common';
import { DefaultAzureCredential, type TokenCredential } from '@azure/identity';

const GRAPH_SCOPE = 'https://graph.microsoft.com/.default';
const GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0';
const DEFAULT_MAX_DEPTH = 5;
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  managerId: string | null;
  expiresAt: number;
}

export interface ManagerChainDependencies {
  credential?: TokenCredential;
  fetchFn?: typeof fetch;
  now?: () => number;
}

/**
 * Resolves a user's Entra reporting-line chain (direct manager, their
 * manager, and so on) via Microsoft Graph `/users/{id}/manager`. Read-only —
 * never writes to Entra. Feeds Access Request approver computation alongside
 * tenant admins (see Architecture Doc "Permissions & Access Requests").
 */
@Injectable()
export class ManagerChainService {
  private readonly logger = new Logger(ManagerChainService.name);
  private readonly credential: TokenCredential;
  private readonly fetchFn: typeof fetch;
  private readonly now: () => number;
  private readonly cache = new Map<string, CacheEntry>();

  constructor(dependencies: ManagerChainDependencies = {}) {
    this.credential = dependencies.credential ?? new DefaultAzureCredential();
    this.fetchFn = dependencies.fetchFn ?? fetch;
    this.now = dependencies.now ?? (() => Date.now());
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

  /**
   * Ordered chain of manager Entra object ids for `userId`, direct manager
   * first. Stops at the first missing link, a cycle, or the depth cap —
   * never throws for "no manager" or "chain ended"; Graph/token failures
   * are logged and treated as "no manager" so callers can fail closed on
   * their own terms (e.g. fall back to tenant-admin-only approval).
   */
  async getManagerChain(userId: string, options: { maxDepth?: number } = {}): Promise<string[]> {
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

    const managerId = await this.fetchDirectManager(userId);
    this.cache.set(userId, { managerId, expiresAt: this.now() + this.cacheTtlMs });
    return managerId;
  }

  private async fetchDirectManager(userId: string): Promise<string | null> {
    try {
      const token = await this.credential.getToken(GRAPH_SCOPE);
      if (!token) {
        this.logger.warn('Unable to acquire a Graph token; treating manager as unresolved');
        return null;
      }

      const response = await this.fetchFn(
        `${GRAPH_BASE_URL}/users/${encodeURIComponent(userId)}/manager?$select=id`,
        { headers: { Authorization: `Bearer ${token.token}` } },
      );

      if (response.status === 404) {
        return null;
      }
      if (!response.ok) {
        this.logger.warn(`Graph manager lookup failed for ${userId}: HTTP ${response.status}`);
        return null;
      }

      const body = (await response.json()) as { id?: unknown };
      return typeof body.id === 'string' && body.id ? body.id : null;
    } catch (error) {
      this.logger.warn(`Graph manager lookup errored for ${userId}: ${(error as Error).message}`);
      return null;
    }
  }
}
