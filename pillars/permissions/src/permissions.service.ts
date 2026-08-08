import { Injectable } from '@nestjs/common';
import { CheckPermissionDto } from './dto/check-permission.dto';
import { CheckPermissionResponseDto } from './dto/check-permission-response.dto';

@Injectable()
export class PermissionsService {
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
      const response = await fetch(`${apiUrl}/stores/${encodeURIComponent(storeId)}/check`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
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
}
