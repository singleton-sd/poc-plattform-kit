import type { UISchemaElement } from '@jsonforms/core';

export const createTenantUiSchema: UISchemaElement = {
  type: 'Group',
  label: 'Create',
  elements: [
    { type: 'Control', scope: '#/properties/name' },
    { type: 'Control', scope: '#/properties/slug' },
  ],
};

export const updateTenantUiSchema: UISchemaElement = {
  type: 'Group',
  label: 'Update',
  elements: [{ type: 'Control', scope: '#/properties/name' }],
};
