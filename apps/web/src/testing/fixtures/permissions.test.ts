import {
  CREATE_ACCESS_REQUEST_400_MESSAGE,
  FIXED_NOW,
  OPENFGA_UNAVAILABLE_MESSAGE,
  approvingAccessRequest,
  checkAllowedFixture,
  checkDeniedFixture,
  createAccessRequest400Body,
  createAccessRequest400ErrorBody,
  createApprovingAccessRequest,
  createCheckAllowedFixture,
  createCheckDeniedFixture,
  createCheckErrorBody,
  createDeniedAccessRequest,
  createExpiredAccessRequest,
  createMineEmptyList,
  createMineLastDeniedList,
  createMineLastExpiredList,
  createMinePendingList,
  createPendingAccessRequest,
  deniedAccessRequest,
  expiredAccessRequest,
  pendingAccessRequest,
} from './permissions';

describe('permission story fixtures', () => {
  it('uses stable synthetic identifiers and timestamps', () => {
    expect([
      pendingAccessRequest.id,
      approvingAccessRequest.id,
      deniedAccessRequest.id,
      expiredAccessRequest.id,
    ]).toEqual([
      '00000000-0000-4000-8000-000000000201',
      '00000000-0000-4000-8000-000000000202',
      '00000000-0000-4000-8000-000000000203',
      '00000000-0000-4000-8000-000000000204',
    ]);
    expect(pendingAccessRequest.updatedAt).toBe(FIXED_NOW);
    expect(deniedAccessRequest.decidedAt).toBe('2026-01-12T11:00:00.000Z');
  });

  it('covers check allowed and denied payloads', () => {
    expect(checkAllowedFixture).toEqual({ allowed: true });
    expect(checkDeniedFixture).toEqual({ allowed: false });
    expect(createCheckAllowedFixture()).toEqual(checkAllowedFixture);
    expect(createCheckDeniedFixture()).toEqual(checkDeniedFixture);
  });

  it('covers mine empty, pending, approving, and last denied or expired', () => {
    expect(createMineEmptyList()).toEqual({ items: [] });
    expect(createMinePendingList().items.map(({ status }) => status)).toEqual(['pending']);
    expect(createMineLastDeniedList().items.map(({ status }) => status)).toEqual(['denied']);
    expect(createMineLastExpiredList().items.map(({ status }) => status)).toEqual(['expired']);
    expect(createPendingAccessRequest().status).toBe('pending');
    expect(createApprovingAccessRequest().status).toBe('approving');
    expect(createDeniedAccessRequest().status).toBe('denied');
    expect(createExpiredAccessRequest().status).toBe('expired');
  });

  it('covers Nest 400 and OpenFGA error bodies', () => {
    expect(createAccessRequest400Body.message).toBe(CREATE_ACCESS_REQUEST_400_MESSAGE);
    expect(createAccessRequest400ErrorBody()).toEqual({
      message: CREATE_ACCESS_REQUEST_400_MESSAGE,
    });
    expect(createCheckErrorBody()).toEqual({ message: OPENFGA_UNAVAILABLE_MESSAGE });
  });

  it('returns isolated copies for each scenario', () => {
    const first = createPendingAccessRequest();
    const second = createPendingAccessRequest();
    first.status = 'denied';
    expect(second.status).toBe('pending');

    const firstMine = createMinePendingList();
    const secondMine = createMinePendingList();
    firstMine.items[0].status = 'approved';
    expect(secondMine.items[0].status).toBe('pending');
  });
});
