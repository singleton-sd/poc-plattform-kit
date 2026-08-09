import { dismissOnboarding, isOnboardingDismissed } from './onboarding-store';

describe('onboarding-store', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('defaults to not dismissed for a user never seen before', () => {
    expect(isOnboardingDismissed('user-1')).toBe(false);
  });

  it('marks a user as dismissed after dismissOnboarding', () => {
    dismissOnboarding('user-1');

    expect(isOnboardingDismissed('user-1')).toBe(true);
  });

  it('keeps state scoped per user id', () => {
    dismissOnboarding('user-1');

    expect(isOnboardingDismissed('user-1')).toBe(true);
    expect(isOnboardingDismissed('user-2')).toBe(false);
  });

  it('defaults to not dismissed when localStorage throws', () => {
    const getItem = jest.spyOn(window.localStorage.__proto__, 'getItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });

    expect(isOnboardingDismissed('user-1')).toBe(false);

    getItem.mockRestore();
  });

  it('silently ignores localStorage write failures', () => {
    const setItem = jest.spyOn(window.localStorage.__proto__, 'setItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });

    expect(() => dismissOnboarding('user-1')).not.toThrow();

    setItem.mockRestore();
  });
});
