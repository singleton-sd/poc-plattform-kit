/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { CreateTenantForm } from './create-tenant-form';

function fieldScopedAlert(input: HTMLElement): HTMLElement | null {
  const describedBy = input.getAttribute('aria-describedby');
  if (!describedBy) return null;
  for (const id of describedBy.split(/\s+/)) {
    const element = document.getElementById(id);
    if (element?.getAttribute('role') === 'alert') return element;
  }
  return null;
}

describe('CreateTenantForm', () => {
  it('does not show a field-scoped error before interaction', () => {
    render(<CreateTenantForm onSubmit={jest.fn()} />);

    const name = screen.getByLabelText(/name/i);
    expect(name).toHaveAttribute('aria-invalid', 'false');
    expect(fieldScopedAlert(name)).toBeNull();
    expect(screen.queryByTestId('tenant-create-client-error')).not.toBeInTheDocument();
  });

  it('shows a field-scoped accessible error after blurring an invalid field', () => {
    render(<CreateTenantForm onSubmit={jest.fn()} />);

    const name = screen.getByLabelText(/name/i);
    fireEvent.blur(name);

    expect(name).toHaveAttribute('aria-invalid', 'true');
    const alert = fieldScopedAlert(name);
    expect(alert).not.toBeNull();
    expect(alert).toHaveTextContent(/./);
  });

  it('shows a field-scoped accessible error after submitting an untouched invalid form', () => {
    const onSubmit = jest.fn();
    render(<CreateTenantForm onSubmit={onSubmit} />);

    fireEvent.submit(screen.getByTestId('tenant-create-form'));

    const name = screen.getByLabelText(/name/i);
    expect(name).toHaveAttribute('aria-invalid', 'true');
    expect(fieldScopedAlert(name)).not.toBeNull();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('communicates more than the first invalid field after submit', () => {
    const onSubmit = jest.fn();
    render(<CreateTenantForm initialData={{ name: '', slug: 'Acme!' }} onSubmit={onSubmit} />);

    fireEvent.submit(screen.getByTestId('tenant-create-form'));

    expect(fieldScopedAlert(screen.getByLabelText(/name/i))).not.toBeNull();
    expect(fieldScopedAlert(screen.getByLabelText(/slug/i))).not.toBeNull();

    const summary = screen.getByTestId('tenant-create-client-error');
    expect(summary.textContent).toContain('Name is required');
    expect(summary.querySelectorAll('li').length).toBeGreaterThan(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
