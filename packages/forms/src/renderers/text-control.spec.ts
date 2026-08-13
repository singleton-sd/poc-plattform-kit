import type { ControlProps } from '@jsonforms/core';
import { TextControlRenderer } from './text-control';
import { findById, findByType } from './test-utils';

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
    schema: { type: 'string' },
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

  it('does not render a character counter when schema.maxLength is absent', () => {
    const tree = TextControlRenderer(baseProps());
    expect(findById(tree, 'name-count')).toBeUndefined();
    const input = findByType(tree, 'input');
    expect(input?.props.maxLength).toBeUndefined();
    expect(input?.props['aria-describedby']).toBeUndefined();
  });

  it('renders a live used/max counter when schema.maxLength is set', () => {
    const tree = TextControlRenderer(
      baseProps({ data: 'hello', schema: { type: 'string', maxLength: 10 } }),
    );
    const counter = findById(tree, 'name-count');
    expect(counter?.props.children).toEqual([5, '/', 10]);
    const input = findByType(tree, 'input');
    expect(input?.props.maxLength).toBe(10);
    expect(input?.props['aria-describedby']).toBe('name-count');
  });

  it('updates the character counter when data changes', () => {
    const withMax = { schema: { type: 'string', maxLength: 10 } };
    expect(
      findById(TextControlRenderer(baseProps({ data: '', ...withMax })), 'name-count')?.props
        .children,
    ).toEqual([0, '/', 10]);
    expect(
      findById(TextControlRenderer(baseProps({ data: 'abc', ...withMax })), 'name-count')?.props
        .children,
    ).toEqual([3, '/', 10]);
  });

  it('includes both error and count ids in aria-describedby when invalid and maxLength is set', () => {
    const input = findByType(
      TextControlRenderer(
        baseProps({
          errors: 'too long',
          schema: { type: 'string', maxLength: 10 },
        }),
      ),
      'input',
    );
    expect(input?.props['aria-describedby']).toBe('name-error name-count');
  });
});
