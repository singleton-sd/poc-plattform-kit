'use client';

import React from 'react';
import { useMe } from './me';
import { LoginPanel } from './login-panel';

export type AuthenticationGuardProps = {
  children: React.ReactNode;
};

/** Wrap protected content and ensure the user is authenticated.
 * Shows loading and error states while session is being verified.
 * If unauthenticated, shows the LoginPanel (auth only; not for role checks).
 */
export function AuthenticationGuard({ children }: AuthenticationGuardProps) {
  const { data: me, isLoading, isError, refetch } = useMe();

  if (isLoading) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center p-6 text-fg-muted" data-testid="auth-guard-loading">
        Loading…
      </main>
    );
  }

  if (isError) {
    return (
      <main className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-fg" data-testid="auth-guard-error">
        <p className="text-fg-muted">Could not verify your session. Try again.</p>
        <button type="button" className="rounded bg-accent px-6 py-3 font-semibold text-accent-on" data-testid="auth-guard-retry" onClick={() => void refetch()}>
          Retry
        </button>
      </main>
    );
  }

  if (!me) {
    return <LoginPanel />;
  }

  return <>{children}</>;
}
