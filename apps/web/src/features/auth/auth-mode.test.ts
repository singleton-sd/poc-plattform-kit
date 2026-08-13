import { isAzureContainerAppsHost, isAzureStaticAppsHost, resolveAuthMode } from './auth-mode';

describe('auth-mode', () => {
  it('detects Azure Static Web Apps hosts', () => {
    expect(isAzureStaticAppsHost('kind-rock-0f409fe00-76.eastasia.7.azurestaticapps.net')).toBe(
      true,
    );
    expect(isAzureStaticAppsHost('kind-rock-0f409fe00.azurestaticapps.net')).toBe(true);
    expect(isAzureStaticAppsHost('app.plattform-kit.poc.singletonsd.com')).toBe(false);
    expect(isAzureStaticAppsHost('localhost')).toBe(false);
  });

  it('detects Azure Container Apps hosts', () => {
    expect(
      isAzureContainerAppsHost(
        'ssd-pocpk-aca-web-pr-190-ae.example.australiaeast.azurecontainerapps.io',
      ),
    ).toBe(true);
    expect(isAzureContainerAppsHost('azurecontainerapps.io')).toBe(true);
    expect(isAzureContainerAppsHost('app.plattform-kit.poc.singletonsd.com')).toBe(false);
  });

  it('uses bearer mode on SWA and ACA hosts and cookies elsewhere', () => {
    expect(resolveAuthMode('kind-rock-0f409fe00-76.eastasia.7.azurestaticapps.net')).toBe('bearer');
    expect(
      resolveAuthMode('ssd-pocpk-aca-web-pr-190-ae.example.australiaeast.azurecontainerapps.io'),
    ).toBe('bearer');
    expect(resolveAuthMode('app.plattform-kit.poc.singletonsd.com')).toBe('cookie');
    expect(resolveAuthMode('localhost')).toBe('cookie');
    expect(resolveAuthMode(undefined)).toBe('cookie');
  });
});
