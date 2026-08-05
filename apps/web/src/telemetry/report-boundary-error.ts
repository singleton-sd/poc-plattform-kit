import { trackClientException } from './client';

export function reportBoundaryError(error: Error, digest?: string): void {
  trackClientException(error, digest ? { digest } : undefined);
}
