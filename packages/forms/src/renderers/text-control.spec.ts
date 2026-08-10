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
  it('sets required and aria-required on the input when the field is required', () => {
    const input = findByType(TextControlRenderer(baseProps({ required: true })), 'input');
    expect(input?.props.required).toBe(true);
    expect(input?.props['aria-required']).toBe(true);
  });

  it('does not set required or aria-required when the field is optional', () => {
    const input = findByType(TextControlRenderer(baseProps({ required: false })), 'input');
    expect(input?.props.required).toBe(false);
    expect(input?.props['aria-required']).toBeUndefined();
  });
});
