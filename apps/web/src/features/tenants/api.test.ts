import { errorMessage, errorStatus, tenantListPayload, tenantPayload } from './api';

const tenant = {
  id: 't-1',
  name: 'Acme',
  slug: 'acme',
  settings: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('tenantPayload', () => {
  it('extracts a valid tenant from a response envelope', () => {
    expect(tenantPayload({ data: tenant, status: 200 })).toEqual(tenant);
  });

  it('returns null for a malformed envelope', () => {
    expect(tenantPayload(null)).toBeNull();
    expect(tenantPayload({ data: { id: 't-1' } })).toBeNull();
  });
});

describe('tenantListPayload', () => {
  it('extracts items and nextCursor from a paginated envelope', () => {
    expect(
      tenantListPayload({ data: { items: [tenant], nextCursor: 't-2' }, status: 200 }),
    ).toEqual({ items: [tenant], nextCursor: 't-2' });
  });

  it('normalizes a missing/non-string nextCursor to null', () => {
    expect(tenantListPayload({ data: { items: [], nextCursor: null } })).toEqual({
      items: [],
      nextCursor: null,
    });
    expect(tenantListPayload({ data: { items: [] } })).toEqual({ items: [], nextCursor: null });
  });

  it('returns null when items is missing or not an array', () => {
    expect(tenantListPayload({ data: { nextCursor: null } })).toBeNull();
    expect(tenantListPayload({ data: { items: 'nope' } })).toBeNull();
  });

  it('treats a bare array (pre-pagination API shape) as a single unpaginated page', () => {
    expect(tenantListPayload({ data: [tenant], status: 200 })).toEqual({
      items: [tenant],
      nextCursor: null,
    });
    expect(tenantListPayload({ data: [] })).toEqual({ items: [], nextCursor: null });
  });

  it('returns null for a malformed envelope', () => {
    expect(tenantListPayload(undefined)).toBeNull();
    expect(tenantListPayload({})).toBeNull();
  });
});

describe('errorStatus', () => {
  it('reads a numeric status off the error', () => {
    expect(errorStatus({ status: 409 })).toBe(409);
  });

  it('returns null when there is no numeric status', () => {
    expect(errorStatus(null)).toBeNull();
    expect(errorStatus({ status: 'nope' })).toBeNull();
  });
});

describe('errorMessage', () => {
  it('prefers the backend message', () => {
    expect(errorMessage({ data: { message: 'Tenant slug already exists' } }, 'fallback')).toBe(
      'Tenant slug already exists',
    );
  });

  it('joins an array of validation messages', () => {
    expect(errorMessage({ data: { message: ['a', 'b'] } }, 'fallback')).toBe('a, b');
  });

  it('falls back when there is no usable message', () => {
    expect(errorMessage(null, 'fallback')).toBe('fallback');
    expect(errorMessage({ data: {} }, 'fallback')).toBe('fallback');
  });
});
