/**
 * Client-only "have I already got a tenant" signal for the self-service
 * onboarding card on the home shell.
 *
 * `GET /api/me` does not (yet) expose tenant memberships (`MeResponseDto` is
 * `{ id, email, name, roles }` only — see `apps/api/src/single-sign-on`), so
 * the web app has no server-side way to know whether the signed-in user
 * already belongs to a tenant. Until that lands, we track "this browser saw
 * this user create or dismiss onboarding" locally, keyed by user id so
 * multiple accounts signing in on one device/browser do not clash. This
 * mirrors the existing localStorage precedent in `theme-init-script.tsx`.
 */

const STORAGE_PREFIX = 'ptk:onboarding-dismissed:';

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`;
}

/** True once this user has created a tenant or dismissed the onboarding card on this browser. */
export function isOnboardingDismissed(userId: string): boolean {
  try {
    return window.localStorage.getItem(storageKey(userId)) === '1';
  } catch {
    // Storage disabled (private browsing, SSR, etc.) — default to showing onboarding.
    return false;
  }
}

/** Marks onboarding as dismissed for this user on this browser (tenant created, or explicitly skipped). */
export function dismissOnboarding(userId: string): void {
  try {
    window.localStorage.setItem(storageKey(userId), '1');
  } catch {
    // Best-effort only; ignore storage failures.
  }
}
