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
  it('sets aria-required on the fieldset when the field is required', () => {
    const fieldset = findByType(ArrayControlRenderer(baseProps({ required: true })), 'fieldset');
    expect(fieldset?.props['aria-required']).toBe(true);
  });

  it('does not set aria-required when the field is optional', () => {
    const fieldset = findByType(ArrayControlRenderer(baseProps({ required: false })), 'fieldset');
    expect(fieldset?.props['aria-required']).toBeUndefined();
  });
});
