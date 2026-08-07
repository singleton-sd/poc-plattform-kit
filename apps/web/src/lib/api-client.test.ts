import { createApiClient, setApiClientTenantId } from '@poc-plattform-kit/api-client';
import { configureApiClient } from './api-client';

jest.mock('@poc-plattform-kit/api-client', () => ({
  createApiClient: jest.fn(),
  setApiClientTenantId: jest.fn(),
}));

const createApiClientMock = createApiClient as jest.MockedFunction<typeof createApiClient>;
const setApiClientTenantIdMock = setApiClientTenantId as jest.MockedFunction<
  typeof setApiClientTenantId
>;

describe('configureApiClient', () => {
  const previousBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

  afterEach(() => {
    createApiClientMock.mockReset();
    setApiClientTenantIdMock.mockReset();
    if (previousBaseUrl === undefined) {
      delete process.env.NEXT_PUBLIC_API_BASE_URL;
    } else {
      process.env.NEXT_PUBLIC_API_BASE_URL = previousBaseUrl;
    }
  });

  it('passes NEXT_PUBLIC_API_BASE_URL as baseUrl', () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = 'https://api.example.test';
    configureApiClient();
    expect(createApiClientMock).toHaveBeenCalledWith({
      baseUrl: 'https://api.example.test',
      getAccessToken: expect.any(Function),
    });
    expect(setApiClientTenantIdMock).toHaveBeenCalledWith(null);
  });

  it('sets x-tenant-id when tenantId is provided', () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = 'https://api.example.test';
    configureApiClient({ tenantId: ' ten-1 ' });
    expect(createApiClientMock).toHaveBeenCalledWith({
      baseUrl: 'https://api.example.test',
      getAccessToken: expect.any(Function),
    });
    expect(setApiClientTenantIdMock).toHaveBeenCalledWith('ten-1');
  });

  it('clears tenant header when tenantId is blank', () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = 'https://api.example.test';
    configureApiClient({ tenantId: '   ' });
    expect(setApiClientTenantIdMock).toHaveBeenCalledWith(null);
  });
});
