'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { meKeys, useMe } from '@/features/auth/me';
import { signIn, signOut } from '@/features/auth/auth-urls';

/** Signed-out login surface (also used at `/` via HomeAuthGate). */
export function LoginPanel() {
  const [signingIn, setSigningIn] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);

  async function onSignIn() {
    setSigningIn(true);
    setSignInError(null);
    try {
      await signIn();
    } catch {
      setSignInError('Could not start sign-in. Try again.');
      setSigningIn(false);
    }
  }

  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg p-6 text-fg"
      data-testid="login-page"
    >
      <h1 className="font-heading text-2xl font-semibold">Platform Kit</h1>
      <p className="max-w-md text-center text-fg-muted">
        Sign in with your Microsoft account to continue.
      </p>
      <button
        type="button"
        className="rounded bg-accent px-4 py-2 text-accent-on disabled:opacity-60"
        data-testid="login-sign-in"
        disabled={signingIn}
        onClick={() => void onSignIn()}
      >
        {signingIn ? 'Redirecting…' : 'Sign in with Microsoft'}
      </button>
      {signInError ? (
        <p className="text-sm text-fg-muted" data-testid="login-sign-in-error">
          {signInError}
        </p>
      ) : null}
    </main>
  );
}

/** Root gate: login when signed out, shell when signed in. */
export function HomeAuthGate() {
  const queryClient = useQueryClient();
  const { data: me, isLoading, isError, refetch } = useMe();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  async function onSignOut() {
    setSigningOut(true);
    setSignOutError(null);
    try {
      await signOut();
      await queryClient.invalidateQueries({ queryKey: meKeys.all });
    } catch {
      setSignOutError('Could not sign out. Try again.');
    } finally {
      setSigningOut(false);
    }
  }

  if (isLoading) {
    return (
      <main
        className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg p-6 text-fg-muted"
        data-testid="login-loading"
      >
        Loading…
      </main>
    );
  }

  if (isError) {
    return (
      <main
        className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg p-6 text-fg"
        data-testid="login-session-error"
      >
        <h1 className="font-heading text-2xl font-semibold">Platform Kit</h1>
        <p className="text-fg-muted">Could not verify your session. Try again.</p>
        <button
          type="button"
          className="rounded bg-accent px-4 py-2 text-accent-on"
          data-testid="login-session-retry"
          onClick={() => void refetch()}
        >
          Retry
        </button>
      </main>
    );
  }

  if (!me) {
    return <LoginPanel />;
  }

  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg p-6 text-fg"
      data-testid="home-shell"
    >
      <h1 className="font-heading text-2xl font-semibold">Platform Kit</h1>
      <p className="text-fg-muted">poc-plattform-kit web shell.</p>
      <p className="text-sm text-fg-muted">Signed in as {me.email}</p>
      <Link className="text-sm text-accent underline" href="/tenants">
        Tenants
      </Link>
      <button
        type="button"
        className="rounded bg-accent px-4 py-2 text-accent-on disabled:opacity-60"
        data-testid="login-sign-out"
        disabled={signingOut}
        onClick={() => void onSignOut()}
      >
        {signingOut ? 'Signing out…' : 'Sign out'}
      </button>
      {signOutError ? (
        <p className="text-sm text-fg-muted" data-testid="login-sign-out-error">
          {signOutError}
        </p>
      ) : null}
    </main>
  );
}
