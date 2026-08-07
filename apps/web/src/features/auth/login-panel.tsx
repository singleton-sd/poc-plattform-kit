'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { BrandMark } from '@/components/brand-mark';
import { meKeys, useMe } from '@/features/auth/me';
import { signIn, signOut } from '@/features/auth/auth-urls';

/** Signed-out login surface (also used at `/` via HomeAuthGate). */
export function LoginPanel() {
  const queryClient = useQueryClient();
  const [signingIn, setSigningIn] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);

  async function onSignIn() {
    setSigningIn(true);
    setSignInError(null);
    try {
      await signIn();
      // Cookie mode navigates away (form POST). Bearer MSAL redirect navigates away too.
      // invalidateQueries only runs if sign-in returns without navigation (errors / tests).
      await queryClient.invalidateQueries({ queryKey: meKeys.all });
    } catch (error) {
      const detail = error instanceof Error ? error.message : '';
      setSignInError(
        detail.includes('MSAL is not configured')
          ? 'Sign-in is not configured for this preview (missing Entra public env).'
          : 'Could not start sign-in. Try again.',
      );
    } finally {
      // Bearer path stays on this panel when /api/me is still null — re-enable CTA.
      setSigningIn(false);
    }
  }

  return (
    <main
      className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center gap-4 px-6 pb-12 pt-[clamp(3rem,12vh,6rem)] text-center text-fg"
      data-testid="login-page"
    >
      <BrandMark size="hero" />
      <h1 className="font-heading text-[clamp(1.15rem,2.5vw,1.35rem)] font-medium tracking-tight text-fg">
        Sign in to continue
      </h1>
      <p className="max-w-md text-base leading-relaxed text-fg-muted">
        Multi-tenant platform foundations for Singleton SD — use your Microsoft account.
      </p>
      <button
        type="button"
        className="mt-2 inline-block rounded bg-accent px-6 py-3 font-semibold text-accent-on transition hover:-translate-y-0.5 disabled:opacity-60"
        data-testid="login-sign-in"
        disabled={signingIn}
        onClick={() => void onSignIn()}
      >
        {signingIn ? 'Signing in…' : 'Sign in with Microsoft'}
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
        className="flex min-h-[70vh] flex-col items-center justify-center gap-4 p-6 text-fg-muted"
        data-testid="login-loading"
      >
        Loading…
      </main>
    );
  }

  if (isError) {
    return (
      <main
        className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center gap-4 px-6 text-center text-fg"
        data-testid="login-session-error"
      >
        <BrandMark size="hero" />
        <p className="text-fg-muted">Could not verify your session. Try again.</p>
        <button
          type="button"
          className="rounded bg-accent px-6 py-3 font-semibold text-accent-on"
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
      className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center gap-4 px-6 pb-12 pt-[clamp(3rem,12vh,6rem)] text-center text-fg"
      data-testid="home-shell"
    >
      <BrandMark size="hero" />
      <h1 className="font-heading text-[clamp(1.15rem,2.5vw,1.35rem)] font-medium tracking-tight">
        Admin console
      </h1>
      <p className="max-w-md text-base leading-relaxed text-fg-muted">
        Signed in as {me.email}. Manage tenants and support from here.
      </p>
      <nav aria-label="Primary" className="mt-2 flex flex-wrap justify-center gap-4">
        <Link
          className="inline-block rounded bg-accent px-6 py-3 font-semibold text-accent-on transition hover:-translate-y-0.5"
          href="/tenants"
        >
          Tenants
        </Link>
        <Link
          className="inline-block rounded border border-fg-subtle px-6 py-3 font-semibold text-fg transition hover:border-accent hover:text-accent"
          href="/support"
        >
          Support
        </Link>
      </nav>
      <button
        type="button"
        className="mt-4 text-sm text-fg-muted underline-offset-2 hover:text-accent hover:underline disabled:opacity-60"
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
