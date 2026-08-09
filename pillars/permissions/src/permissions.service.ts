import { DefaultAzureCredential, type TokenCredential } from '@azure/identity';
import { Injectable } from '@nestjs/common';
import { CheckPermissionDto } from './dto/check-permission.dto';
import { CheckPermissionResponseDto } from './dto/check-permission-response.dto';

const tokenSkewMs = 60_000;

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
    const apiUrl = process.env.OPENFGA_API_URL?.trim().replace(/\/$/, '');
    const storeId = process.env.OPENFGA_STORE_ID?.trim();
    if (!apiUrl || !storeId) {
      return { allowed: false };
    }

    const authorizationModelId = process.env.OPENFGA_AUTHORIZATION_MODEL_ID?.trim();
    try {
      const authHeader = await this.resolveAuthorizationHeader();
      const response = await fetch(`${apiUrl}/stores/${encodeURIComponent(storeId)}/check`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...authHeader,
        },
        body: JSON.stringify({
          tuple_key: {
            user: request.subject,
            relation: request.action,
            object: request.resource,
          },
          ...(authorizationModelId ? { authorization_model_id: authorizationModelId } : {}),
        }),
      });
      if (!response.ok) {
        return { allowed: false };
      }
      const decision = (await response.json()) as { allowed?: unknown };
      return { allowed: decision.allowed === true };
    } catch {
      return { allowed: false };
    }
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
