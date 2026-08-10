import { toIsoString, toIsoStringRequired } from '@poc-plattform-kit/dto-map';
import type { AccessRequestRecord } from './access-request.service';
import type { AccessRequestResponseDto } from './dto/access-request-response.dto';

/** Map a domain access-request record to the OpenAPI response DTO. */
export function toAccessRequestResponseDto(row: AccessRequestRecord): AccessRequestResponseDto {
  return {
    id: row.id,
    tenantId: row.tenantId,
    requesterId: row.requesterId,
    requesterEntraOid: row.requesterEntraOid,
    action: row.action,
    resource: row.resource,
    status: row.status,
    decidedById: row.decidedById,
    decidedAt: toIsoString(row.decidedAt),
    denyReason: row.denyReason,
    grantType: row.grantType,
    expiresAt: toIsoString(row.expiresAt),
    createdAt: toIsoStringRequired(row.createdAt),
    updatedAt: toIsoStringRequired(row.updatedAt),
  };
}
