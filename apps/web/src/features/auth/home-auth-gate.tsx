'use client';

import type { TenantResponseDto } from '@poc-plattform-kit/api-client';
import { useState } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { BrandMark } from '@/components/brand-mark';
import { AuthenticationGuard } from '@/features/auth/authentication-guard';
import { meKeys, useMe, type Me } from '@/features/auth/me';
import { signOut } from '@/features/auth/auth-urls';
import { CopyTenantIdButton } from '@/features/tenants/copy-tenant-id-button';
import { OnboardingCard } from '@/features/onboarding/onboarding-card';
import { getCreatedTenant, rememberCreatedTenant } from '@/features/onboarding/onboarding-store';

/**
 * Root gate for `/`: session loading / error / signed-out login come from
 * {@link AuthenticationGuard}; signed-in users see the admin home shell.
 */
export function HomeAuthGate() {
  return (
    <AuthenticationGuard>
      <HomeAuthGateSignedIn />
    </AuthenticationGuard>
  );
}

function HomeAuthGateSignedIn() {
  const queryClient = useQueryClient();
  const { data: me } = useMe();
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

  // AuthenticationGuard only mounts children when `me` is present.
  if (!me) return null;

  return (
    <SignedInHome
      me={me}
      signingOut={signingOut}
      signOutError={signOutError}
      onSignOut={() => void onSignOut()}
    />
  );
}

type SignedInHomeProps = {
  me: Me;
  signingOut: boolean;
  signOutError: string | null;
  onSignOut: () => void;
};

/**
 * Signed-in home shell. Offers self-service tenant onboarding — see
 * `apps/web/src/features/onboarding` — ahead of the existing admin console
 * links. Created-tenant id is persisted per browser so the manage link
 * survives refresh; "Not now" is session-only until `/api/me` exposes
 * memberships (see `onboarding-store.ts`).
 */
function SignedInHome({ me, signingOut, signOutError, onSignOut }: SignedInHomeProps) {
  const [sessionDismissed, setSessionDismissed] = useState(false);
  const [createdTenant, setCreatedTenant] = useState<Pick<TenantResponseDto, 'id' | 'name'> | null>(
    () => getCreatedTenant(me.id),
  );

  function handleOnboardingCreated(tenant: TenantResponseDto) {
    rememberCreatedTenant(me.id, { id: tenant.id, name: tenant.name });
    setCreatedTenant(tenant);
  }

  function handleOnboardingDismiss() {
    setSessionDismissed(true);
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

      {createdTenant ? (
        <div
          className="flex w-full max-w-md flex-col items-center gap-2 rounded border border-fg-subtle bg-bg-muted p-4 text-sm text-fg-muted"
          data-testid="onboarding-success"
        >
          <p>
            You&apos;re the owner of <strong className="text-fg">{createdTenant.name}</strong>.
          </p>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs" data-testid="onboarding-success-tenant-id">
              {createdTenant.id}
            </span>
            <CopyTenantIdButton tenantId={createdTenant.id} />
          </div>
          <Link
            href={`/tenant?tenantId=${encodeURIComponent(createdTenant.id)}`}
            className="text-accent underline-offset-2 hover:underline"
          >
            Manage your tenant
          </Link>
        </div>
      ) : sessionDismissed ? null : (
        <OnboardingCard onCreated={handleOnboardingCreated} onDismiss={handleOnboardingDismiss} />
      )}

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
        onClick={onSignOut}
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
