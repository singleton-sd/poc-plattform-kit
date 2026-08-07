import type {
  JsonFormsCellRendererRegistryEntry,
  JsonFormsRendererRegistryEntry,
} from '@jsonforms/core';
import { ArrayControl, arrayControlTester } from './renderers/array-control';
import { CheckboxControl, checkboxControlTester } from './renderers/checkbox-control';
import { DateControl, dateControlTester } from './renderers/date-control';
import { GroupLayoutRendererControl, groupLayoutTester } from './renderers/group-layout';
import { SelectControl, selectControlTester } from './renderers/select-control';
import { TextControl, textControlTester } from './renderers/text-control';
import { VerticalLayoutRendererControl, verticalLayoutTester } from './renderers/vertical-layout';

/** Tailwind + Singleton SD token renderers (no Material UI). */
export const tokenRenderers: JsonFormsRendererRegistryEntry[] = [
  { tester: dateControlTester, renderer: DateControl },
  { tester: selectControlTester, renderer: SelectControl },
  { tester: checkboxControlTester, renderer: CheckboxControl },
  { tester: arrayControlTester, renderer: ArrayControl },
  { tester: textControlTester, renderer: TextControl },
  { tester: verticalLayoutTester, renderer: VerticalLayoutRendererControl },
  { tester: groupLayoutTester, renderer: GroupLayoutRendererControl },
];

/** Cells unused by the renderer set; exported for the JsonForms host API. */
export const tokenCells: JsonFormsCellRendererRegistryEntry[] = [];
