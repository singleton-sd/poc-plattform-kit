import { DefaultAzureCredential, type TokenCredential } from '@azure/identity';
import { Injectable } from '@nestjs/common';
import { CheckPermissionDto } from './dto/check-permission.dto';
import { CheckPermissionResponseDto } from './dto/check-permission-response.dto';
import { GrantPermissionDto, PermissionGrantType } from './dto/grant-permission.dto';
import { GrantPermissionResponseDto } from './dto/grant-permission-response.dto';
import { RevokePermissionDto } from './dto/revoke-permission.dto';
import { RevokePermissionResponseDto } from './dto/revoke-permission-response.dto';

const tokenSkewMs = 60_000;
const notYetExpiredCondition = 'not_yet_expired';
const oneTimePendingRelation = 'pending';

type OpenFgaTupleKey = {
  user: string;
  relation: string;
  object: string;
  condition?: {
    name: string;
    context: Record<string, string>;
  };
};

export type PermissionTupleRecord = {
  subject: string;
  relation: string;
  resource: string;
  condition: { name: string; context: Record<string, string> } | null;
  createdAt: string | null;
};

export type PermissionTuplePage = {
  consistencyVersion: string;
  tuples: PermissionTupleRecord[];
};

/** Companion OpenFGA object for one-time grant markers. */
export function oneTimeGrantObject(resource: string, action: string): string {
  return `one_time_grant:${resource}|${action}`;
}

@Injectable()
export class PermissionsService {
  private tokenCredential: TokenCredential = new DefaultAzureCredential();
  private cachedAccessToken?: { token: string; expiresOnTimestamp: number };

  /** Test-only seam for Entra token acquisition (Nest must keep a zero-arg ctor). */
  setTokenCredential(credential: TokenCredential): void {
    this.tokenCredential = credential;
  }

  isConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
    return Boolean(env.OPENFGA_API_URL?.trim() && env.OPENFGA_STORE_ID?.trim());
  }

  async check(request: CheckPermissionDto): Promise<CheckPermissionResponseDto> {
    if (!this.isConfigured()) {
      return { allowed: false };
    }

    try {
      const decision = await this.openFgaCheck(request.subject, request.action, request.resource);
      if (!decision) {
        return { allowed: false };
      }

      const consumed = await this.consumeOneTimeGrantIfPresent(
        request.subject,
        request.action,
        request.resource,
      );
      // Permanent/temporary (no marker) → allow. One-time only allows when consume succeeds.
      return { allowed: consumed !== false };
    } catch {
      return { allowed: false };
    }
  }

  /** Synchronize the local Tenant group's user membership into OpenFGA. */
  async addTenantGroupMember(groupId: string, userId: string): Promise<boolean> {
    if (!this.isConfigured()) {
      return false;
    }
    try {
      return await this.openFgaWrite({
        writes: [
          {
            user: `user:${userId}`,
            relation: 'member',
            object: `group:${groupId}`,
          },
        ],
      });
    } catch {
      return false;
    }
  }

  /** Remove the OpenFGA tuple before local membership is deleted (fail closed). */
  async removeTenantGroupMember(groupId: string, userId: string): Promise<boolean> {
    if (!this.isConfigured()) {
      return false;
    }
    try {
      return await this.openFgaWrite({
        deletes: [
          {
            user: `user:${userId}`,
            relation: 'member',
            object: `group:${groupId}`,
          },
        ],
      });
    } catch {
      return false;
    }
  }

  /**
   * Conservative last-owner safeguard for group lifecycle changes. A group
   * holding owner must have that role revoked through the role command first.
   */
  async isTenantGroupOwner(tenantId: string, groupId: string): Promise<boolean> {
    if (!this.isConfigured()) return true;
    try {
      return await this.openFgaCheck(`group:${groupId}#member`, 'owner', `tenant:${tenantId}`);
    } catch {
      return true;
    }
  }

  async checkTenantRole(subject: string, roleId: string, tenantId: string): Promise<boolean> {
    if (!this.isConfigured()) return false;
    try {
      return await this.openFgaCheck(subject, roleId, `tenant:${tenantId}`);
    } catch {
      return false;
    }
  }

  async setTenantRole(
    subject: string,
    roleId: string,
    tenantId: string,
    assigned: boolean,
  ): Promise<boolean> {
    if (!this.isConfigured()) return false;
    const tuple = { user: subject, relation: roleId, object: `tenant:${tenantId}` };
    try {
      const written = await this.openFgaWrite(
        assigned ? { writes: [tuple] } : { deletes: [tuple] },
      );
      if (written) return true;
      return (await this.openFgaCheck(subject, roleId, `tenant:${tenantId}`)) === assigned;
    } catch {
      return false;
    }
  }

  async grant(request: GrantPermissionDto): Promise<GrantPermissionResponseDto> {
    if (!this.isConfigured()) {
      return { granted: false, grantType: request.grantType };
    }

    try {
      switch (request.grantType) {
        case PermissionGrantType.Permanent: {
          const ok = await this.openFgaWrite({
            writes: [
              {
                user: request.subject,
                relation: request.action,
                object: request.resource,
              },
            ],
          });
          return { granted: ok, grantType: request.grantType };
        }
        case PermissionGrantType.Temporary: {
          if (!request.expiresAt) {
            return { granted: false, grantType: request.grantType };
          }
          const expiry = new Date(request.expiresAt);
          if (Number.isNaN(expiry.getTime()) || expiry.getTime() <= Date.now()) {
            return { granted: false, grantType: request.grantType };
          }
          const ok = await this.openFgaWrite({
            writes: [
              {
                user: request.subject,
                relation: request.action,
                object: request.resource,
                condition: {
                  name: notYetExpiredCondition,
                  context: { expiry_time: expiry.toISOString() },
                },
              },
            ],
          });
          return { granted: ok, grantType: request.grantType };
        }
        case PermissionGrantType.OneTime: {
          const ok = await this.openFgaWrite({
            writes: [
              {
                user: request.subject,
                relation: request.action,
                object: request.resource,
              },
              {
                user: request.subject,
                relation: oneTimePendingRelation,
                object: oneTimeGrantObject(request.resource, request.action),
              },
            ],
          });
          return { granted: ok, grantType: request.grantType };
        }
        default: {
          const _exhaustive: never = request.grantType;
          void _exhaustive;
          return { granted: false, grantType: request.grantType };
        }
      }
    } catch {
      return { granted: false, grantType: request.grantType };
    }
  }

  async revoke(request: RevokePermissionDto): Promise<RevokePermissionResponseDto> {
    if (!this.isConfigured()) {
      return { revoked: false };
    }

    try {
      const ok = await this.openFgaWrite({
        deletes: [
          {
            user: request.subject,
            relation: request.action,
            object: request.resource,
          },
          {
            user: request.subject,
            relation: oneTimePendingRelation,
            object: oneTimeGrantObject(request.resource, request.action),
          },
        ],
      });
      return { revoked: ok };
    } catch {
      return { revoked: false };
    }
  }

  /** Read-only OpenFGA projection seam for tenant access administration. */
  async listResourceTuples(resource: string): Promise<PermissionTuplePage> {
    const consistencyVersion = process.env.OPENFGA_AUTHORIZATION_MODEL_ID?.trim() || 'unversioned';
    if (!this.isConfigured()) {
      return { consistencyVersion, tuples: [] };
    }

    try {
      const tuples: PermissionTupleRecord[] = [];
      let continuationToken: string | undefined;

      do {
        const page = await this.openFgaRead(resource, continuationToken);
        if (!page) {
          return { consistencyVersion, tuples: [] };
        }
        tuples.push(
          ...page.tuples.map((tuple) => ({
            subject: tuple.key.user,
            relation: tuple.key.relation,
            resource: tuple.key.object,
            condition: tuple.key.condition ?? null,
            createdAt: tuple.timestamp ?? null,
          })),
        );
        continuationToken = page.continuationToken;
      } while (continuationToken);

      tuples.sort(
        (left, right) =>
          left.subject.localeCompare(right.subject) ||
          left.relation.localeCompare(right.relation) ||
          (left.createdAt ?? '').localeCompare(right.createdAt ?? ''),
      );
      return { consistencyVersion, tuples };
    } catch {
      return { consistencyVersion, tuples: [] };
    }
  }

  /**
   * @returns `undefined` when not a one-time grant; `true` when consumed;
   * `false` when a concurrent consumer already claimed it or delete failed.
   */
  private async consumeOneTimeGrantIfPresent(
    subject: string,
    action: string,
    resource: string,
  ): Promise<boolean | undefined> {
    const markerObject = oneTimeGrantObject(resource, action);
    const isOneTime = await this.openFgaCheck(subject, oneTimePendingRelation, markerObject);
    if (!isOneTime) {
      return undefined;
    }

    // Delete marker first so a concurrent Check loses the race (marker already gone).
    const markerDeleted = await this.openFgaWrite({
      deletes: [{ user: subject, relation: oneTimePendingRelation, object: markerObject }],
    });
    if (!markerDeleted) {
      return false;
    }

    // Best-effort cleanup of the action tuple after the marker is claimed.
    await this.openFgaWrite({
      deletes: [{ user: subject, relation: action, object: resource }],
    });
    return true;
  }

  private async openFgaCheck(user: string, relation: string, object: string): Promise<boolean> {
    const apiUrl = process.env.OPENFGA_API_URL!.trim().replace(/\/$/, '');
    const storeId = process.env.OPENFGA_STORE_ID!.trim();
    const authorizationModelId = process.env.OPENFGA_AUTHORIZATION_MODEL_ID?.trim();
    const authHeader = await this.resolveAuthorizationHeader();
    const response = await fetch(`${apiUrl}/stores/${encodeURIComponent(storeId)}/check`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...authHeader,
      },
      body: JSON.stringify({
        tuple_key: { user, relation, object },
        context: { current_time: new Date().toISOString() },
        ...(authorizationModelId ? { authorization_model_id: authorizationModelId } : {}),
      }),
    });
    if (!response.ok) {
      throw new Error(`OpenFGA check failed with status ${response.status}`);
    }
    const decision = (await response.json()) as { allowed?: unknown };
    return decision.allowed === true;
  }

  private async openFgaWrite(input: {
    writes?: OpenFgaTupleKey[];
    deletes?: OpenFgaTupleKey[];
  }): Promise<boolean> {
    const apiUrl = process.env.OPENFGA_API_URL!.trim().replace(/\/$/, '');
    const storeId = process.env.OPENFGA_STORE_ID!.trim();
    const authorizationModelId = process.env.OPENFGA_AUTHORIZATION_MODEL_ID?.trim();
    const authHeader = await this.resolveAuthorizationHeader();
    const body: Record<string, unknown> = {};
    if (input.writes?.length) {
      body.writes = { tuple_keys: input.writes };
    }
    if (input.deletes?.length) {
      body.deletes = { tuple_keys: input.deletes };
    }
    if (authorizationModelId) {
      body.authorization_model_id = authorizationModelId;
    }

    const response = await fetch(`${apiUrl}/stores/${encodeURIComponent(storeId)}/write`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...authHeader,
      },
      body: JSON.stringify(body),
    });
    return response.ok;
  }

  private async openFgaRead(
    resource: string,
    continuationToken?: string,
  ): Promise<
    | {
        tuples: Array<{
          key: OpenFgaTupleKey;
          timestamp?: string;
        }>;
        continuationToken?: string;
      }
    | undefined
  > {
    const apiUrl = process.env.OPENFGA_API_URL!.trim().replace(/\/$/, '');
    const storeId = process.env.OPENFGA_STORE_ID!.trim();
    const authorizationModelId = process.env.OPENFGA_AUTHORIZATION_MODEL_ID?.trim();
    const authHeader = await this.resolveAuthorizationHeader();
    const response = await fetch(`${apiUrl}/stores/${encodeURIComponent(storeId)}/read`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...authHeader,
      },
      body: JSON.stringify({
        tuple_key: { object: resource },
        page_size: 100,
        ...(continuationToken ? { continuation_token: continuationToken } : {}),
        ...(authorizationModelId ? { authorization_model_id: authorizationModelId } : {}),
      }),
    });
    if (!response.ok) {
      return undefined;
    }
    const page = (await response.json()) as {
      tuples?: Array<{ key?: OpenFgaTupleKey; timestamp?: string }>;
      continuation_token?: unknown;
    };
    const validTuples = (page.tuples ?? []).filter(
      (tuple): tuple is { key: OpenFgaTupleKey; timestamp?: string } =>
        Boolean(tuple.key?.user && tuple.key.relation && tuple.key.object),
    );
    return {
      tuples: validTuples,
      continuationToken:
        typeof page.continuation_token === 'string' && page.continuation_token
          ? page.continuation_token
          : undefined,
    };
  }

  private async resolveAuthorizationHeader(): Promise<Record<string, string>> {
    const audience = process.env.OPENFGA_AUDIENCE?.trim();
    if (!audience) {
      return {};
    }

    const scope = audience.endsWith('/.default') ? audience : `${audience}/.default`;
    const now = Date.now();
    if (this.cachedAccessToken && this.cachedAccessToken.expiresOnTimestamp - tokenSkewMs > now) {
      return { authorization: `Bearer ${this.cachedAccessToken.token}` };
    }

    const accessToken = await this.tokenCredential.getToken(scope);
    if (!accessToken?.token) {
      return {};
    }

    this.cachedAccessToken = {
      token: accessToken.token,
      expiresOnTimestamp: accessToken.expiresOnTimestamp,
    };
    return { authorization: `Bearer ${accessToken.token}` };
  }
}
