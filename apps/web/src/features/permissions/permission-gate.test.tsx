/**
 * @jest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
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

jest.mock('./api', () => ({
  checkPermission: (...args: unknown[]) => checkPermission(...args),
  listMyAccessRequests: (...args: unknown[]) => listMyAccessRequests(...args),
  createAccessRequest: (...args: unknown[]) => createAccessRequest(...args),
}));

function wrap(ui: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

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
    expect(screen.getByTestId('permission-gate-disabled')).toBeDisabled();
    expect(screen.getByTestId('permission-gate-request-cta')).toBeInTheDocument();
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
});
