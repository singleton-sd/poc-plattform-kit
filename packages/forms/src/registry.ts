import type {
  JsonFormsCellRendererRegistryEntry,
  JsonFormsRendererRegistryEntry,
} from '@jsonforms/core';
import { TextControl, textControlTester } from './renderers/text-control';
import { GroupLayoutRendererControl, groupLayoutTester } from './renderers/group-layout';
import { VerticalLayoutRendererControl, verticalLayoutTester } from './renderers/vertical-layout';

/** Tailwind + Singleton SD token renderers (no Material UI). */
export const tokenRenderers: JsonFormsRendererRegistryEntry[] = [
  { tester: textControlTester, renderer: TextControl },
  { tester: verticalLayoutTester, renderer: VerticalLayoutRendererControl },
  { tester: groupLayoutTester, renderer: GroupLayoutRendererControl },
];

/** Cells unused for string controls today; exported for JsonForms API completeness. */
export const tokenCells: JsonFormsCellRendererRegistryEntry[] = [];
