import type { Meta, StoryObj } from '@storybook/nextjs';
import { expect, userEvent, within } from 'storybook/test';
import {
  tenantsCollectionEmptyHandlers,
  tenantsLoadingHandlers,
  tenantsPermissionDeniedHandlers,
  tenantsPopulatedHandlers,
  tenantsSearchNoResultsHandlers,
  tenantsServerErrorHandlers,
} from '@/testing/handlers/tenants';
import { NO_RESULTS_QUERY } from '@/testing/fixtures/tenants';
import { TenantWorkspace } from './tenant-workspace';

const meta = {
  title: 'Features/Tenants/Workspace scenarios',
  component: TenantWorkspace,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof TenantWorkspace>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  parameters: { msw: { handlers: { tenants: tenantsLoadingHandlers } } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('tenant-workspace')).toBeInTheDocument();
    await expect(canvas.queryByTestId('tenant-empty-state')).not.toBeInTheDocument();
    await expect(canvas.queryByTestId('tenant-error-state')).not.toBeInTheDocument();
  },
};

export const Populated: Story = {
  parameters: { msw: { handlers: { tenants: tenantsPopulatedHandlers } } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('Example North')).toBeInTheDocument();
    await expect(canvas.getByTestId('tenant-create-open')).toBeInTheDocument();
  },
};

/** First-use / onboarding empty: purpose copy + permitted primary create action. */
export const CollectionEmpty: Story = {
  parameters: { msw: { handlers: { tenants: tenantsCollectionEmptyHandlers } } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const empty = await canvas.findByTestId('tenant-empty-state');
    await expect(empty).toHaveTextContent('Create your first tenant');
    await expect(empty).toHaveTextContent('Tenants represent organisations using your platform.');
    await expect(canvas.getByRole('button', { name: /create tenant/i })).toBeEnabled();
  },
};

/**
 * Permission-aware empty: collection is empty and create is unavailable.
 * Distinct from permission-denied (403) load failures.
 */
export const PermissionAwareEmpty: Story = {
  args: { canCreate: false },
  parameters: { msw: { handlers: { tenants: tenantsCollectionEmptyHandlers } } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const empty = await canvas.findByTestId('tenant-empty-state');
    await expect(empty).toHaveTextContent('No tenants available');
    await expect(canvas.queryByTestId('tenant-create-open')).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: /create tenant/i })).not.toBeInTheDocument();
  },
};

/** Filtered / search no-results with clear/reset recovery. */
export const SearchNoResults: Story = {
  parameters: { msw: { handlers: { tenants: tenantsSearchNoResultsHandlers } } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const search = canvas.getByRole('searchbox', { name: /search tenants/i });
    await userEvent.type(search, NO_RESULTS_QUERY);
    const empty = await canvas.findByTestId('tenant-search-empty-state');
    await expect(empty).toHaveTextContent('No tenants match your search.');
    await expect(search).toHaveValue(NO_RESULTS_QUERY);
    await userEvent.click(canvas.getByTestId('tenant-search-empty-clear'));
    await expect(search).toHaveValue('');
  },
};

export const ClientValidationError: Story = {
  parameters: { msw: { handlers: { tenants: tenantsPopulatedHandlers } } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByTestId('tenant-create-open'));
    await userEvent.click(await canvas.findByTestId('tenant-create-submit'));
    await expect(await canvas.findByTestId('tenant-create-client-error')).toHaveTextContent(
      'Name is required',
    );
  },
};

export const ServerError: Story = {
  parameters: { msw: { handlers: { tenants: tenantsServerErrorHandlers } } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const error = await canvas.findByTestId('tenant-error-state');
    await expect(error).toHaveTextContent('Unable to load tenants');
    await expect(canvas.getByRole('button', { name: /try again/i })).toBeEnabled();
  },
};

export const PermissionDenied: Story = {
  args: { canCreate: false },
  parameters: { msw: { handlers: { tenants: tenantsPermissionDeniedHandlers } } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByTestId('tenant-error-state')).toBeInTheDocument();
    await expect(canvas.queryByTestId('tenant-create-open')).not.toBeInTheDocument();
    await expect(canvas.queryByTestId('tenant-empty-state')).not.toBeInTheDocument();
  },
};
