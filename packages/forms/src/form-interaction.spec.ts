import { shouldShowFieldError } from './form-interaction';

describe('shouldShowFieldError', () => {
  it('never shows when the field is valid', () => {
    expect(shouldShowFieldError(false, null)).toBe(false);
    expect(shouldShowFieldError(false, { touched: true, submitAttempted: true })).toBe(false);
  });

  it('shows immediately when the host is not tracking interaction', () => {
    expect(shouldShowFieldError(true, null)).toBe(true);
  });

  it('hides an invalid field until blur or a submit attempt', () => {
    expect(shouldShowFieldError(true, { touched: false, submitAttempted: false })).toBe(false);
  });

  it('shows after the field is touched', () => {
    expect(shouldShowFieldError(true, { touched: true, submitAttempted: false })).toBe(true);
  });

  it('shows after a submit attempt even if the field was never blurred', () => {
    expect(shouldShowFieldError(true, { touched: false, submitAttempted: true })).toBe(true);
  });
});
