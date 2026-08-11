/**
 * @jest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { formatApiError, unwrapData } from './api';
import { PermissionGate } from './permission-gate';

jest.mock('@/features/auth/me', () => ({
  useMe: () => ({
    isLoading: false,
    data: { id: 'user-1', email: 'u@example.com', name: 'U', roles: [] },
  }),
}));

const checkPermission = jest.fn();
const listMyAccessRequests = jest.fn();
const createAccessRequest = jest.fn();

jest.mock('./api', () => {
  const actual = jest.requireActual('./api') as typeof import('./api');
  return {
    ...actual,
    checkPermission: (...args: unknown[]) => checkPermission(...args),
    listMyAccessRequests: (...args: unknown[]) => listMyAccessRequests(...args),
    createAccessRequest: (...args: unknown[]) => createAccessRequest(...args),
  };
});

function wrap(ui: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe('unwrapData', () => {
  it('returns payload for 2xx envelopes', () => {
    expect(unwrapData({ data: { allowed: true }, status: 200 }, 'fail')).toEqual({
      allowed: true,
    });
  });

  it('throws on non-2xx envelopes', () => {
    expect(() =>
      unwrapData({ data: { message: 'nope' }, status: 401 }, 'Permission check failed'),
    ).toThrow(/Permission check failed/);
  });

  it('throws when envelope data is missing', () => {
    expect(() =>
      unwrapData({ data: undefined, status: 200 }, 'Could not load access requests'),
    ).toThrow(/Could not load access requests/);
  });
});

describe('formatApiError', () => {
  it('prefers Nest message from ApiFetchError.data', () => {
    const error = Object.assign(new Error('API request failed (403)'), {
      status: 403,
      data: { message: 'Forbidden for this tenant' },
    });
    expect(formatApiError(error, 'fallback')).toBe('Forbidden for this tenant');
  });
});

describe('PermissionGate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders children when allowed', async () => {
    checkPermission.mockResolvedValue({ allowed: true });
    wrap(
      <PermissionGate action="update" resource="tenant:t1">
        <button type="button">Save Changes</button>
      </PermissionGate>,
    );

    await waitFor(() => expect(screen.getByText('Save Changes')).toBeEnabled());
    expect(screen.queryByTestId('permission-gate-request-cta')).not.toBeInTheDocument();
  });

  it('shows disabled control + request CTA when denied with no request', async () => {
    checkPermission.mockResolvedValue({ allowed: false });
    listMyAccessRequests.mockResolvedValue([]);
    wrap(
      <PermissionGate action="update" resource="tenant:t1">
        <button type="button">Save Changes</button>
      </PermissionGate>,
    );

    await waitFor(() => expect(screen.getByTestId('permission-gate-denied')).toBeInTheDocument());
    expect(screen.getByTestId('permission-gate-disabled')).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByTestId('permission-gate-disabled')).not.toBeDisabled();
    expect(screen.getByTestId('permission-gate-request-cta')).toBeInTheDocument();
  });

  it('keeps the checking state until mine requests finish after a deny', async () => {
    checkPermission.mockResolvedValue({ allowed: false });
    let resolveMine: (value: unknown[]) => void = () => undefined;
    listMyAccessRequests.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveMine = resolve;
        }),
    );
    wrap(
      <PermissionGate action="update" resource="tenant:t1">
        <button type="button">Save Changes</button>
      </PermissionGate>,
    );

    await waitFor(() => expect(listMyAccessRequests).toHaveBeenCalled());
    expect(screen.getByTestId('permission-gate-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('permission-gate-request-cta')).not.toBeInTheDocument();
    await act(async () => {
      resolveMine([]);
    });
    await waitFor(() => expect(screen.getByTestId('permission-gate-denied')).toBeInTheDocument());
  });

  it('shows pending status and hides CTA when a pending request exists', async () => {
    checkPermission.mockResolvedValue({ allowed: false });
    listMyAccessRequests.mockResolvedValue([
      {
        id: 'ar1',
        status: 'pending',
        action: 'update',
        resource: 'tenant:t1',
      },
    ]);
    wrap(
      <PermissionGate action="update" resource="tenant:t1">
        <button type="button">Save Changes</button>
      </PermissionGate>,
    );

    await waitFor(() =>
      expect(screen.getByTestId('permission-gate-status')).toHaveTextContent(/pending/i),
    );
    expect(screen.queryByTestId('permission-gate-request-cta')).not.toBeInTheDocument();
  });

  it('shows an error state instead of denied UI when the check fails', async () => {
    checkPermission.mockRejectedValue(
      Object.assign(new Error('API request failed (500)'), {
        status: 500,
        data: { message: 'OpenFGA unavailable' },
      }),
    );
    wrap(
      <PermissionGate action="update" resource="tenant:t1">
        <button type="button">Save Changes</button>
      </PermissionGate>,
    );

    await waitFor(() => expect(screen.getByTestId('permission-gate-error')).toBeInTheDocument());
    expect(screen.getByRole('alert')).toHaveTextContent('OpenFGA unavailable');
    expect(screen.queryByTestId('permission-gate-denied')).not.toBeInTheDocument();
    expect(screen.getByTestId('permission-gate-retry')).toBeInTheDocument();
  });

  it('submits an access request from the dialog', async () => {
    checkPermission.mockResolvedValue({ allowed: false });
    listMyAccessRequests.mockResolvedValue([]);
    createAccessRequest.mockResolvedValue({
      id: 'ar2',
      status: 'pending',
      action: 'update',
      resource: 'tenant:t1',
    });

    wrap(
      <PermissionGate action="update" resource="tenant:t1" tenantId="t1">
        <button type="button">Save Changes</button>
      </PermissionGate>,
    );

    await waitFor(() =>
      expect(screen.getByTestId('permission-gate-request-cta')).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByTestId('permission-gate-request-cta'));
    fireEvent.click(screen.getByTestId('request-access-submit'));

    await waitFor(() =>
      expect(createAccessRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'update',
          resource: 'tenant:t1',
          tenantId: 't1',
          preferredGrantType: 'permanent',
        }),
      ),
    );
  });

  it('surfaces Nest error details when request submission fails', async () => {
    checkPermission.mockResolvedValue({ allowed: false });
    listMyAccessRequests.mockResolvedValue([]);
    createAccessRequest.mockRejectedValue(
      Object.assign(new Error('API request failed (400)'), {
        status: 400,
        data: { message: 'preferredGrantExpiresAt is required' },
      }),
    );

    wrap(
      <PermissionGate action="update" resource="tenant:t1" tenantId="t1">
        <button type="button">Save Changes</button>
      </PermissionGate>,
    );

    await waitFor(() =>
      expect(screen.getByTestId('permission-gate-request-cta')).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByTestId('permission-gate-request-cta'));
    fireEvent.click(screen.getByTestId('request-access-submit'));

    await waitFor(() =>
      expect(screen.getByTestId('request-access-error')).toHaveTextContent(
        'preferredGrantExpiresAt is required',
      ),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByTestId('permission-gate-request-cta'));
    expect(screen.queryByTestId('request-access-error')).not.toBeInTheDocument();
  });
});
