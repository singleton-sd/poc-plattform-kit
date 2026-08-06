import {
  rankWith,
  uiTypeIs,
  type LayoutProps,
  type RankedTester,
  type GroupLayout,
} from '@jsonforms/core';
import { JsonFormsDispatch, withJsonFormsLayoutProps } from '@jsonforms/react';

function GroupLayoutRenderer(props: LayoutProps) {
  const { uischema, schema, path, enabled, renderers, cells, visible } = props;
  if (!visible) return null;

  const group = uischema as GroupLayout;

  return (
    <section className="flex flex-col gap-3">
      {group.label ? (
        <h2 className="font-heading text-lg font-medium text-fg">{group.label}</h2>
      ) : null}
      {(group.elements ?? []).map((child, index) => (
        <JsonFormsDispatch
          key={`${path}-group-${index}`}
          uischema={child}
          schema={schema}
          path={path}
          enabled={enabled}
          renderers={renderers}
          cells={cells}
        />
      ))}
    </section>
  );
}

export const groupLayoutTester: RankedTester = rankWith(2, uiTypeIs('Group'));
export const GroupLayoutRendererControl = withJsonFormsLayoutProps(GroupLayoutRenderer);
