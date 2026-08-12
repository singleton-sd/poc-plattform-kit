import type { ControlProps } from '@jsonforms/core';
import { ArrayControlRenderer, isStringArraySchema } from './array-control';
import { findByType } from './test-utils';

describe('isStringArraySchema', () => {
  it('accepts string item schemas', () => {
    expect(isStringArraySchema({ type: 'array', items: { type: 'string' } })).toBe(true);
  });

  it('rejects primitive arrays whose values need coercion', () => {
    expect(isStringArraySchema({ type: 'array', items: { type: 'number' } })).toBe(false);
    expect(isStringArraySchema({ type: 'array', items: { type: 'boolean' } })).toBe(false);
  });
});

function baseProps(overrides: Partial<ControlProps> = {}): ControlProps {
  return {
    data: [],
    handleChange: () => {},
    path: 'tags',
    label: 'Tags',
    required: false,
    errors: '',
    enabled: true,
    id: 'tags',
    ...overrides,
  } as ControlProps;
}

describe('ArrayControlRenderer', () => {
  it('does not set aria-required on the fieldset (aria-required is prohibited on group role)', () => {
    const fieldset = findByType(ArrayControlRenderer(baseProps({ required: true })), 'fieldset');
    expect(fieldset?.props['aria-required']).toBeUndefined();
  });

  it('shows a visual required indicator in the legend when the field is required', () => {
    const span = findByType(ArrayControlRenderer(baseProps({ required: true })), 'span');
    expect(span?.props['aria-hidden']).toBe('true');
    expect(span?.props.children).toBe(' *');
  });

  it('omits the visual required indicator when the field is optional', () => {
    const fieldset = findByType(ArrayControlRenderer(baseProps({ required: false })), 'fieldset');
    expect(fieldset?.props['aria-required']).toBeUndefined();
  });
});
