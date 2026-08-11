'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { resolveAuthMode } from '@/features/auth/auth-mode';
import { completeBearerRedirect } from '@/features/auth/bearer-auth';
import { getAndClearReturnUrl } from '@/features/auth/auth-return-url';
import { useRouter } from 'next/navigation';
import { configureApiClient } from '@/lib/api-client';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [authReady, setAuthReady] = useState(false);
  const router = useRouter();

  useEffect(() => {
    configureApiClient();
    let cancelled = false;

    void (async () => {
      try {
        // Finish Entra redirect before /api/me so the Bearer token is available.
        if (resolveAuthMode() === 'bearer') {
          await completeBearerRedirect();
                }

                // Regardless of auth mode, if a return target was captured before redirect,
                // consume it exactly once and navigate there. This covers both MSAL
                // redirect flows and Auth.js cookie-form callbacks that return to the SPA.
                const returnTo = getAndClearReturnUrl();
                if (returnTo) {
                  // router.replace is safe here because Providers is a client component.
                  router.replace(returnTo);
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
