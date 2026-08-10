import type { ControlProps } from '@jsonforms/core';
import { enumValueAt, SelectControlRenderer } from './select-control';
import { findByType } from './test-utils';

describe('enumValueAt', () => {
  it('returns the original enum value without string coercion', () => {
    const options = ['one', 2, true];

    expect(enumValueAt(options, '1')).toBe(2);
    expect(enumValueAt(options, '2')).toBe(true);
  });

  it('returns undefined for the empty placeholder', () => {
    expect(enumValueAt(['one'], '')).toBeUndefined();
  });
});

function baseProps(overrides: Partial<ControlProps> = {}): ControlProps {
  return {
    data: undefined,
    handleChange: () => {},
    path: 'category',
    label: 'Category',
    required: false,
    errors: '',
    enabled: true,
    id: 'category',
    schema: { enum: ['Internal', 'Customer'] },
    ...overrides,
  } as ControlProps;
}

describe('SelectControlRenderer', () => {
  it('sets aria-required on the select when the field is required', () => {
    const select = findByType(SelectControlRenderer(baseProps({ required: true })), 'select');
    expect(select?.props['aria-required']).toBe(true);
  });

  it('does not set aria-required when the field is optional', () => {
    const select = findByType(SelectControlRenderer(baseProps({ required: false })), 'select');
    expect(select?.props['aria-required']).toBeUndefined();
  });

  it('never sets the native required attribute, to avoid the browser intercepting submission before the app runs its own validation', () => {
    const select = findByType(SelectControlRenderer(baseProps({ required: true })), 'select');
    expect(select?.props.required).toBeUndefined();
  });
});
