/**
 * Client-only record of a tenant this browser created via self-service
 * onboarding. Used so the home-shell success / "Manage your tenant" link
 * survives refresh.
 *
 * `GET /api/me` does not (yet) expose tenant memberships (`MeResponseDto` is
 * `{ id, email, name, roles }` only — see `apps/api/src/single-sign-on`), so
 * this cannot know whether the user already belongs to a tenant created
 * elsewhere. "Not now" is therefore session-only (React state), not stored
 * here — a dismissed card must reappear until memberships land on `/api/me`.
 * This mirrors the existing localStorage precedent in `theme-init-script.tsx`.
 */

const STORAGE_PREFIX = 'ptk:onboarding-created:';

export type CreatedTenantRef = {
  id: string;
  name: string;
};

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`;
}

function readRecord(userId: string): CreatedTenantRef | null {
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === 'object' &&
      'id' in parsed &&
      typeof parsed.id === 'string' &&
      parsed.id.length > 0
    ) {
      const name =
        'name' in parsed && typeof parsed.name === 'string' && parsed.name.length > 0
          ? parsed.name
          : parsed.id;
      return { id: parsed.id, name };
    }
    return null;
  } catch {
    // Storage disabled, SSR, or a legacy non-JSON value — treat as unknown.
    return null;
  }
}

/** Tenant this browser last created for `userId`, if any. */
export function getCreatedTenant(userId: string): CreatedTenantRef | null {
  return readRecord(userId);
}

/** Persists the newly created tenant so the manage link survives refresh. */
export function rememberCreatedTenant(userId: string, tenant: CreatedTenantRef): void {
  try {
    window.localStorage.setItem(
      storageKey(userId),
      JSON.stringify({ id: tenant.id, name: tenant.name }),
    );
  } catch {
    // Best-effort only; ignore storage failures.
  }
}
