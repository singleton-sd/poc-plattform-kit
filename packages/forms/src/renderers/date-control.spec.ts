import { DateControlRenderer, type DateControlRendererProps } from './date-control';
import { findByType } from './test-utils';

function baseProps(overrides: Partial<DateControlRendererProps> = {}): DateControlRendererProps {
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
  } as DateControlRendererProps;
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

  it('hides the accessible error until the host marks the field as showing', () => {
    const input = findByType(
      DateControlRenderer(baseProps({ errors: 'Required', showError: false })),
      'input',
    );
    expect(input?.props['aria-invalid']).toBe(false);
    expect(input?.props['aria-describedby']).toBeUndefined();
  });
});
