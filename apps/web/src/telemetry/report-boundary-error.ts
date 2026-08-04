/**
 * Root error reporter for future Next.js `error.tsx` / Error Boundary.
 * Call from a client component when a render error is caught.
 */
import { trackClientException } from './client';

export function reportBoundaryError(error: Error, digest?: string): void {
  trackClientException(error, digest ? { digest } : undefined);
}
