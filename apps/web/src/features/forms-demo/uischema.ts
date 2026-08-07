import type { UISchemaElement } from '@jsonforms/core';

export const createProjectUiSchema: UISchemaElement = {
  type: 'VerticalLayout',
  elements: [
    {
      type: 'Group',
      label: 'Project details',
      elements: [
        { type: 'Control', scope: '#/properties/name' },
        { type: 'Control', scope: '#/properties/category' },
        { type: 'Control', scope: '#/properties/launchDate' },
        { type: 'Control', scope: '#/properties/active' },
        { type: 'Control', scope: '#/properties/tags' },
      ],
    },
  ],
};
