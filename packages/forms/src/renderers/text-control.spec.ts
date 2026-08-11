import type { ControlProps } from '@jsonforms/core';
import { TextControlRenderer } from './text-control';
import { findByType } from './test-utils';

function baseProps(overrides: Partial<ControlProps> = {}): ControlProps {
  return {
    data: '',
    handleChange: () => {},
    path: 'name',
    label: 'Name',
    required: false,
    errors: '',
    enabled: true,
    id: 'name',
    description: undefined,
    ...overrides,
  } as ControlProps;
}

describe('TextControlRenderer', () => {
  it('sets aria-required on the input when the field is required', () => {
    const input = findByType(TextControlRenderer(baseProps({ required: true })), 'input');
    expect(input?.props['aria-required']).toBe(true);
  });

  it('does not set aria-required when the field is optional', () => {
    const input = findByType(TextControlRenderer(baseProps({ required: false })), 'input');
    expect(input?.props['aria-required']).toBeUndefined();
  });

  it('never sets the native required attribute, to avoid the browser intercepting submission before the app runs its own validation', () => {
    const input = findByType(TextControlRenderer(baseProps({ required: true })), 'input');
    expect(input?.props.required).toBeUndefined();
  });
});
