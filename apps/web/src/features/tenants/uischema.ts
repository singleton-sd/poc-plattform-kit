import type { UISchemaElement } from '@jsonforms/core';

export const createTenantUiSchema: UISchemaElement = {
  type: 'VerticalLayout',
  elements: [
    { type: 'Control', scope: '#/properties/name' },
    { type: 'Control', scope: '#/properties/slug' },
  ],
};

export const updateTenantUiSchema: UISchemaElement = {
  type: 'VerticalLayout',
  elements: [{ type: 'Control', scope: '#/properties/name' }],
};
