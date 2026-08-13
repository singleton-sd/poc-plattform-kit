/**
 * @jest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import {
  CreateProjectForm,
  emptyCreateProjectData,
  populatedCreateProjectData,
} from './create-project-form';

function wrap(ui: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe('CreateProjectForm', () => {
  it('shows no validation errors on initial mount', () => {
    wrap(<CreateProjectForm initialData={emptyCreateProjectData} />);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByTestId('create-project-validation-error')).not.toBeInTheDocument();
  });

  it('disables submit while the form is invalid', () => {
    wrap(<CreateProjectForm initialData={emptyCreateProjectData} />);

    expect(screen.getByTestId('create-project-submit')).toBeDisabled();
  });

  it('enables submit when the form is valid', () => {
    wrap(<CreateProjectForm initialData={populatedCreateProjectData} />);

    expect(screen.getByTestId('create-project-submit')).toBeEnabled();
  });

  it('surfaces multiple Zod issues after a submit attempt on an invalid form', async () => {
    wrap(<CreateProjectForm initialData={emptyCreateProjectData} />);

    // Disabled submit button blocks click; form-level submit still exercises the handler gate.
    fireEvent.submit(screen.getByTestId('create-project-form'));

    const alert = await screen.findByTestId('create-project-validation-error');
    expect(alert).toHaveAttribute('role', 'alert');
    const items = alert.querySelectorAll('li');
    expect(items.length).toBeGreaterThan(1);
  });

  it('shows field-level errors after a submit attempt', async () => {
    wrap(<CreateProjectForm initialData={emptyCreateProjectData} />);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    fireEvent.submit(screen.getByTestId('create-project-form'));

    await waitFor(() => {
      expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
    });
  });

  it('submits successfully when data is valid', async () => {
    wrap(<CreateProjectForm initialData={populatedCreateProjectData} />);

    fireEvent.click(screen.getByTestId('create-project-submit'));

    expect(await screen.findByTestId('create-project-success')).toHaveTextContent(
      'Demo project created. No data was sent to the API.',
    );
  });

  it('keeps submit disabled in read-only mode', () => {
    wrap(<CreateProjectForm initialData={populatedCreateProjectData} readOnly />);

    expect(screen.getByTestId('create-project-submit')).toBeDisabled();
  });
});
