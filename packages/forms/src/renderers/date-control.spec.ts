import type { ControlProps } from '@jsonforms/core';
import { DateControlRenderer } from './date-control';
import { findByType } from './test-utils';

function baseProps(overrides: Partial<ControlProps> = {}): ControlProps {
  return {
    data: '',
    handleChange: () => {},
    path: 'launchDate',
    label: 'Launch date',
    required: false,
    errors: '',
    enabled: true,
    id: 'launchDate',
    ...overrides,
  } as ControlProps;
}

describe('DateControlRenderer', () => {
  it('sets aria-required on the input when the field is required', () => {
    const input = findByType(DateControlRenderer(baseProps({ required: true })), 'input');
    expect(input?.props['aria-required']).toBe(true);
  });

  it('does not set aria-required when the field is optional', () => {
    const input = findByType(DateControlRenderer(baseProps({ required: false })), 'input');
    expect(input?.props['aria-required']).toBeUndefined();
  });

  it('never sets the native required attribute, to avoid the browser intercepting submission before the app runs its own validation', () => {
    const input = findByType(DateControlRenderer(baseProps({ required: true })), 'input');
    expect(input?.props.required).toBeUndefined();
  });
});
