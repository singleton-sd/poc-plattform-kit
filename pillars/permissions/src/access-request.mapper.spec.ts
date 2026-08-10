import { toAccessRequestResponseDto } from './access-request.mapper';
import type { AccessRequestRecord } from './access-request.service';

describe('toAccessRequestResponseDto', () => {
  const row: AccessRequestRecord = {
    id: 'ar1',
    tenantId: 't1',
    requesterId: 'user-1',
    requesterEntraOid: 'oid-1',
    action: 'update',
    resource: 'tenant:t1',
    status: 'pending',
    decidedById: null,
    decidedAt: null,
    denyReason: null,
    grantType: null,
    expiresAt: null,
    createdAt: new Date('2026-08-10T12:00:00.000Z'),
    updatedAt: new Date('2026-08-10T12:30:00.000Z'),
  };

  it('maps Dates to ISO strings and keeps nullables null', () => {
    expect(toAccessRequestResponseDto(row)).toEqual({
      id: 'ar1',
      tenantId: 't1',
      requesterId: 'user-1',
      requesterEntraOid: 'oid-1',
      action: 'update',
      resource: 'tenant:t1',
      status: 'pending',
      decidedById: null,
      decidedAt: null,
      denyReason: null,
      grantType: null,
      expiresAt: null,
      createdAt: '2026-08-10T12:00:00.000Z',
      updatedAt: '2026-08-10T12:30:00.000Z',
    });
  });
});
