import { getCreatedTenant, rememberCreatedTenant } from './onboarding-store';

describe('onboarding-store', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('defaults to no created tenant for a user never seen before', () => {
    expect(getCreatedTenant('user-1')).toBeNull();
  });

  it('returns the tenant after rememberCreatedTenant', () => {
    rememberCreatedTenant('user-1', { id: 't1', name: 'Acme' });

    expect(getCreatedTenant('user-1')).toEqual({ id: 't1', name: 'Acme' });
  });

  it('keeps created tenants scoped per user id', () => {
    rememberCreatedTenant('user-1', { id: 't1', name: 'Acme' });

    expect(getCreatedTenant('user-1')).toEqual({ id: 't1', name: 'Acme' });
    expect(getCreatedTenant('user-2')).toBeNull();
  });

  it('ignores a legacy dismissed bit that is not a tenant record', () => {
    window.localStorage.setItem('ptk:onboarding-created:user-1', '1');

    expect(getCreatedTenant('user-1')).toBeNull();
  });

  it('defaults to no tenant when localStorage throws', () => {
    const getItem = jest.spyOn(window.localStorage.__proto__, 'getItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });

    expect(getCreatedTenant('user-1')).toBeNull();

    getItem.mockRestore();
  });

  it('silently ignores localStorage write failures', () => {
    const setItem = jest.spyOn(window.localStorage.__proto__, 'setItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });

    expect(() => rememberCreatedTenant('user-1', { id: 't1', name: 'Acme' })).not.toThrow();

    setItem.mockRestore();
  });
});
