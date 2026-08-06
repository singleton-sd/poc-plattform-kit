'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { meKeys, useMe } from '@/features/auth/me';
import { signInUrl, signOut } from '@/features/auth/auth-urls';

export default function LoginPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: me, isLoading } = useMe();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  useEffect(() => {
    if (me) {
      router.replace('/');
    }
  }, [me, router]);

  async function onSignOut() {
    setSigningOut(true);
    setSignOutError(null);
    try {
      await signOut('/');
      await queryClient.invalidateQueries({ queryKey: meKeys.all });
      router.replace('/login');
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

  if (me) {
    return (
      <main
        className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg p-6 text-fg"
        data-testid="login-signed-in"
      >
        <h1 className="font-heading text-2xl font-semibold">Platform Kit</h1>
        <p className="text-fg-muted">Signed in as {me.email}. Redirecting…</p>
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

  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg p-6 text-fg"
      data-testid="login-page"
    >
      <h1 className="font-heading text-2xl font-semibold">Platform Kit</h1>
      <p className="max-w-md text-center text-fg-muted">
        Sign in with your Microsoft account to continue.
      </p>
      <a
        href={signInUrl('/')}
        className="rounded bg-accent px-4 py-2 text-accent-on"
        data-testid="login-sign-in"
      >
        Sign in with Microsoft
      </a>
    </main>
  );
}
