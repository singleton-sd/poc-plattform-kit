import { resolveTenantEmailSettings } from './tenant-email-settings';

describe('resolveTenantEmailSettings', () => {
  it('returns null when email settings are missing', () => {
    expect(resolveTenantEmailSettings({})).toBeNull();
  });

  it('returns profile values when provided', () => {
    expect(
      resolveTenantEmailSettings({
        email: {
          fromAddress: 'noreply@mail.inkads.poc.singletonsd.com',
          fromName: 'InkAds',
          contactInboxAddress: 'inkads-support@singletonsd.com',
        },
      }),
    ).toEqual({
      fromAddress: 'noreply@mail.inkads.poc.singletonsd.com',
      fromName: 'InkAds',
      contactInboxAddress: 'inkads-support@singletonsd.com',
    });
  });
});
