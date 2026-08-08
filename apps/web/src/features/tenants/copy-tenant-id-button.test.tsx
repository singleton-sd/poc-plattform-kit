import { act, fireEvent, render, screen } from '@testing-library/react';
import { CopyTenantIdButton } from './copy-tenant-id-button';

describe('CopyTenantIdButton', () => {
  const writeText = jest.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    writeText.mockClear();
    Object.assign(navigator, { clipboard: { writeText } });
  });

  it('copies the tenant id to the clipboard', async () => {
    render(<CopyTenantIdButton tenantId="t-123" />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy tenant ID' }));
    });

    expect(writeText).toHaveBeenCalledWith('t-123');
  });

  it('announces the copy and swaps the accessible name', async () => {
    render(<CopyTenantIdButton tenantId="t-123" />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy tenant ID' }));
    });

    expect(screen.getByRole('button', { name: 'Tenant ID copied' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Tenant ID copied to clipboard');
  });

  it('reverts to the copy label after the confirmation window', async () => {
    jest.useFakeTimers();
    render(<CopyTenantIdButton tenantId="t-123" />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy tenant ID' }));
    });

    act(() => {
      jest.advanceTimersByTime(2000);
    });

    expect(screen.getByRole('button', { name: 'Copy tenant ID' })).toBeInTheDocument();
    jest.useRealTimers();
  });
});
