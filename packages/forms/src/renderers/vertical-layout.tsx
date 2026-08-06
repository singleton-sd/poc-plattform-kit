import {
  rankWith,
  uiTypeIs,
  type LayoutProps,
  type RankedTester,
  type VerticalLayout,
} from '@jsonforms/core';
import { JsonFormsDispatch, withJsonFormsLayoutProps } from '@jsonforms/react';

function VerticalLayoutRenderer(props: LayoutProps) {
  const { uischema, schema, path, enabled, renderers, cells, visible } = props;
  if (!visible) return null;

  const layout = uischema as VerticalLayout;

  return (
    <div className="flex flex-col gap-3">
      {(layout.elements ?? []).map((child, index) => (
        <JsonFormsDispatch
          key={`${path}-${index}`}
          uischema={child}
          schema={schema}
          path={path}
          enabled={enabled}
          renderers={renderers}
          cells={cells}
        />
      ))}
    </div>
  );
}

export const verticalLayoutTester: RankedTester = rankWith(2, uiTypeIs('VerticalLayout'));
export const VerticalLayoutRendererControl = withJsonFormsLayoutProps(VerticalLayoutRenderer);
