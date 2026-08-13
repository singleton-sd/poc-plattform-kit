'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { BrandMark } from '@/components/brand-mark';
import { meKeys } from '@/features/auth/me';
import { captureReturnUrl } from '@/features/auth/auth-return-url';
import { signIn } from '@/features/auth/auth-urls';

/** Signed-out login surface (also used at `/` via HomeAuthGate / AuthenticationGuard). */
export function LoginPanel() {
  const queryClient = useQueryClient();
  const [signingIn, setSigningIn] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);

  async function onSignIn() {
    setSigningIn(true);
    setSignInError(null);
    try {
      // Capture the current return target so it can be restored after the auth callback.
      // This writes a single-use key to sessionStorage consumed after redirect.
      captureReturnUrl();
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
