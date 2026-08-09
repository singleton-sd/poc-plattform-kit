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
};

export const Populated: Story = {
  parameters: { msw: { handlers: { tenants: tenantsPopulatedHandlers } } },
};

export const CollectionEmpty: Story = {
  parameters: { msw: { handlers: { tenants: tenantsCollectionEmptyHandlers } } },
};

export const SearchNoResults: Story = {
  parameters: { msw: { handlers: { tenants: tenantsSearchNoResultsHandlers } } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const search = canvas.getByRole('searchbox', { name: /search tenants/i });
    await userEvent.type(search, NO_RESULTS_QUERY);
    await expect(await canvas.findByTestId('tenant-search-empty-state')).toBeInTheDocument();
    await expect(search).toHaveValue(NO_RESULTS_QUERY);
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
};

export const PermissionRestricted: Story = {
  args: { canCreate: false },
  parameters: { msw: { handlers: { tenants: tenantsPermissionDeniedHandlers } } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByTestId('tenant-error-state')).toBeInTheDocument();
    await expect(canvas.queryByTestId('tenant-create-open')).not.toBeInTheDocument();
  },
};
