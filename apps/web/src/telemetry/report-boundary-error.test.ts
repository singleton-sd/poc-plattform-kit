import { trackClientException } from './client';
import { reportBoundaryError } from './report-boundary-error';

jest.mock('./client', () => ({
  trackClientException: jest.fn(),
}));

const trackClientExceptionMock = trackClientException as jest.MockedFunction<
  typeof trackClientException
>;

describe('reportBoundaryError', () => {
  afterEach(() => trackClientExceptionMock.mockReset());

  it('reports the error boundary digest', () => {
    const error = new Error('page failed');

    reportBoundaryError(error, 'digest-1');

    expect(trackClientExceptionMock).toHaveBeenCalledWith(error, { digest: 'digest-1' });
  });

  it('omits digest properties when no digest is available', () => {
    const error = new Error('page failed');

    reportBoundaryError(error);

    expect(trackClientExceptionMock).toHaveBeenCalledWith(error, undefined);
  });
});
