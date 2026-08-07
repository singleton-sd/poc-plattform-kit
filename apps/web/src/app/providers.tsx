'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { resolveAuthMode } from '@/features/auth/auth-mode';
import { completeBearerRedirect } from '@/features/auth/bearer-auth';
import { configureApiClient } from '@/lib/api-client';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    configureApiClient();
    let cancelled = false;

    void (async () => {
      try {
        // Finish Entra redirect before /api/me so the Bearer token is available.
        if (resolveAuthMode() === 'bearer') {
          await completeBearerRedirect();
        }
      } catch {
        // Leave signed-out; sign-in CTA remains available.
      } finally {
        if (!cancelled) {
          setAuthReady(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!authReady) {
    return (
      <main
        className="flex min-h-[70vh] flex-col items-center justify-center gap-4 p-6 text-fg-muted"
        data-testid="auth-bootstrap"
      >
        Loading…
      </main>
    );
  }

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
