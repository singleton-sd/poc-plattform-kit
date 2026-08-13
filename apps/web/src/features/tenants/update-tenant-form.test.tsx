/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { UpdateTenantForm } from './update-tenant-form';

function fieldScopedAlert(input: HTMLElement): HTMLElement | null {
  const describedBy = input.getAttribute('aria-describedby');
  if (!describedBy) return null;
  for (const id of describedBy.split(/\s+/)) {
    const element = document.getElementById(id);
    if (element?.getAttribute('role') === 'alert') return element;
  }
  return null;
}

describe('UpdateTenantForm', () => {
  it('does not show a field-scoped error before interaction', () => {
    render(<UpdateTenantForm initialName="Acme" onSubmit={jest.fn()} />);

    const name = screen.getByLabelText(/name/i);
    expect(name).toHaveAttribute('aria-invalid', 'false');
    expect(fieldScopedAlert(name)).toBeNull();
    expect(screen.queryByTestId('tenant-update-client-error')).not.toBeInTheDocument();
  });

  it('shows a field-scoped accessible error after blurring an invalid field', () => {
    render(<UpdateTenantForm initialName="Acme" onSubmit={jest.fn()} />);

    const name = screen.getByLabelText(/name/i);
    fireEvent.change(name, { target: { value: '' } });
    fireEvent.blur(name);

    expect(name).toHaveAttribute('aria-invalid', 'true');
    const alert = fieldScopedAlert(name);
    expect(alert).not.toBeNull();
    expect(alert).toHaveTextContent(/./);
  });

  it('shows a field-scoped accessible error after submitting an untouched invalid form', () => {
    const onSubmit = jest.fn();
    render(<UpdateTenantForm initialName="" onSubmit={onSubmit} />);

    fireEvent.submit(screen.getByTestId('tenant-update-form'));

    const name = screen.getByLabelText(/name/i);
    expect(name).toHaveAttribute('aria-invalid', 'true');
    expect(fieldScopedAlert(name)).not.toBeNull();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('surfaces the field error together with the form-level summary after submit', () => {
    const onSubmit = jest.fn();
    render(<UpdateTenantForm initialName="" onSubmit={onSubmit} />);

    fireEvent.submit(screen.getByTestId('tenant-update-form'));

    expect(fieldScopedAlert(screen.getByLabelText(/name/i))).not.toBeNull();
    expect(screen.getByTestId('tenant-update-client-error')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
