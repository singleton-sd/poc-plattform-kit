# 0006: Platform Kit as the multi-tenant base (Keycloak identity)

## Status

Accepted 2026-11-14 (Pato: A Keycloak, B Coolify for new apps, C kit DB
source of truth).

This is the repo landing of org-level ADR-002. It **supersedes** Entra
gates [SSD-212](https://app.clickup.com/t/86d3zahee) (formerly POC-52)
and GitHub [#287](https://github.com/singleton-sd/poc-plattform-kit/issues/287)
(Entra External ID / social-login Path B). Do not close those until the
Keycloak login cutover (step 1) has merged.

## Context

Pato wants one reusable base for multi-tenant apps (an org per customer)
so new product ideas start from it. No single open-source product covers
tenant identity, membership, authorization and data isolation end to end;
teams compose them.

This repository already has a Postgres/Prisma tenant model (`Tenant`,
`TenantMembership`, `TenantGroup`(+Membership) synced to OpenFGA,
`TenantInvitation` with create/list/revoke, per-tenant role revisions,
outbox and audit tables). Its gap was identity: `User` was keyed on
`entraOid` and login was Entra + Auth.js, while the org now runs Keycloak
(`https://auth.singletonsd.com/realms/singletonsd`) and OpenFGA.

## Decision

Platform Kit is the multi-tenant base. A new app gets tenancy by importing
the kit:

1. **Authentication (A):** Keycloak (realm `singletonsd`, one OIDC client
   per app, owned by Singleton Auth). `User` is keyed by Keycloak `sub`;
   email is unique. Google and Microsoft sign-in via Keycloak IdPs; Apple
   sign-in is added as a Keycloak IdP when Singleton Auth rolls it out and
   is not an MVP blocker. Existing users: add `keycloakSub`, backfill it
   on first Keycloak login by **verified** email match, then drop
   `entraOid` once backfilled; dev/PoC data may be re-seeded instead.
2. **Distribution:** the kit ships as versioned packages
   (`@singleton-sd/kit-*` on GitHub Packages: db, auth, tenant,
   permissions, ui-shells) plus a thin app template that depends on them.
   Apps upgrade by version bump, not by merging a fork. Reversal: if
   package overhead slows the first two consumers more than drift would,
   fall back to a template.
3. **Source of truth for orgs, memberships, roles and invites (C):** the
   kit database. Keycloak authenticates only. Keycloak Organizations are
   deferred; adopt later only for per-tenant enterprise IdPs by mapping
   the Keycloak org id onto `Tenant`.
4. **Authorization:** OpenFGA. Base org roles
   owner/admin/member/viewer. `TenantMembership.role` is the single source
   of truth; OpenFGA tuples are derived from it through the outbox with
   the same `syncStatus` gate as `TenantGroupMembership`, so pending or
   failed syncs deny access. One OpenFGA store per app per environment,
   with `tenant` as an object type (never a store per tenant); the base
   authorization model is versioned in the kit and extended per app with
   relations and resource types, not columns. External participants (e.g.
   a LeaseMate renter) are OpenFGA grants on specific resources, not
   memberships.
5. **Active tenant:** chosen in the session or `X-Tenant-Id`, checked
   against membership on every API request. No per-org tokens, so
   switching needs no re-login.
6. **Data isolation:** app-level tenant scoping plus Postgres RLS on
   `tenant_id` as defence in depth. The app connects as a non-owner role
   (e.g. `app_rw`); migrations run as the table owner; tenant tables also
   get FORCE ROW LEVEL SECURITY. Policies use
   `current_setting('app.tenant_id', true)`. A `packages/db` helper calls
   `set_config('app.tenant_id', $1, true)` (transaction-local) inside an
   interactive transaction so pooled connections never leak a tenant. The
   cross-tenant test runs as `app_rw` and proves reads and writes across
   tenants fail.
7. **Invites:** the existing model, finished (accept/decline/resend/expire),
   emails via kit Notifications, tokens stored hashed.
8. **Audit** events for every membership, role and invite change. Never
   zero owners.
9. **Shared UI shells:** org switcher, members/invites admin, accept-invite
   page, no-org onboarding, PermissionGate.
10. **Hosting for new kit apps (B):** Coolify (next to Keycloak, OpenFGA,
    Postgres). Keep the Azure deploy paths working until a consumer
    actually moves. The kit outbox currently publishes to Azure Service
    Bus and Notifications email is Azure-side, so Coolify needs a broker
    (recommended: the existing Redis/BullMQ JobKit stack Singleton Deploy
    runs, or a Postgres-backed queue) and an email sender (recommended:
    the same SMTP provider Keycloak uses) before invite emails ship.

Cookie vs Bearer transport from
[ADR 0004](./0004-cross-subdomain-cookie-auth-swa-free.md) stays: Auth.js
httpOnly cookies on custom domains; a public OIDC (not MSAL) Bearer path
on SWA/ACA preview hosts that cannot share `AUTH_COOKIE_DOMAIN`.

### MVP in scope

Soft delete only for tenants (add `Tenant.deletedAt`). All of the above,
the web and API migration to Keycloak, a seed/dev tenant, and a "build an
app on the kit" guide.

### Out of scope (later)

Billing, per-tenant SSO/IdP, custom domains and white-label theming,
schema-per-tenant, Support and Contact pillars, cross-tenant super-admin
beyond a read-only list, SCIM, data export and tenant hard deletion, and
Entra social login Path B (#287).

### First consumers

LeaseMate (design driver: agencies/landlords as orgs, staff as members,
renters as external participants); the kit demo app (reference consumer
for CI and smoke tests); InkAds advertiser accounts later (candidate
only).

## Alternatives considered

- **Keycloak Organizations as the membership source.** Built-in invites
  and per-org IdPs, but a second source of truth needing two-way sync
  with existing OpenFGA/outbox/audit code, and invite emails and UX
  outside our Notifications.
- **Zitadel or Logto** (multi-tenant-native IdPs). Strong, but would
  replace Keycloak, which is already deployed and owned by Singleton Auth.
- **Adopting BoxyHQ SaaS Starter Kit.** Its own auth overlaps Keycloak.
  Borrow UX and the webhook/audit shape only.
- **Schema- or database-per-tenant.** Stronger isolation but heavier
  operations and migrations. RLS is enough for the MVP.
- **Stay on Entra / Entra External ID Path B (#287).** Rejected: the org
  already runs Keycloak; one IdP for all apps.

## Consequences

- Keycloak handles login only, so tenant admin UX is ours to build and
  maintain (shells are reusable).
- RLS adds per-transaction setup and needs care with pooled connections
  and migrations.
- Moving off Entra removes Azure-native identity for the kit. Microsoft
  Graph manager-chain resolution remains Entra-only and fail-soft for
  Keycloak-only users until a later replacement.
- Identity config is env-only (`KEYCLOAK_ISSUER`, `KEYCLOAK_CLIENT_ID`,
  `KEYCLOAK_CLIENT_SECRET`, `KEYCLOAK_API_AUDIENCE`). Singleton Auth
  creates the real clients; this repo does not hardcode client ids.
- `User.entraOid` stays nullable until a later expand/contract migration
  drops it.

### Reversal criteria

- Revisit C if a customer requires their own IdP, or if
  invite/membership code becomes a maintenance burden that Keycloak
  Organizations would remove.
- Revisit RLS/shared-schema if a customer contractually needs physical
  isolation, or if noisy-neighbour load appears.
- Revisit B if Coolify capacity or reliability cannot meet a consumer's
  SLA.

## References

- Org-level ADR-002 (accepted 2026-11-14); ClickUp parent
  [SSD-701](https://app.clickup.com/t/14ymjnwa4h0)
- [`docs/sso.md`](../sso.md) — Keycloak Auth.js + JWT runtime contract
- [`docs/architecture/overview.md`](../architecture/overview.md)
- [ADR 0002](./0002-openfga-fine-grained-authorization.md) (OpenFGA)
- [ADR 0004](./0004-cross-subdomain-cookie-auth-swa-free.md) (cookie Domain)
- Implementation order: (0) this ADR; (1) Keycloak login + `keycloakSub`;
  (1b) Coolify outbox/email if B; (2) invite accept/decline + hashed
  tokens; (3) active-tenant middleware; (4) RLS helper and cross-tenant
  test; (5) members/invites admin + PermissionGate; (6) external
  participant + LeaseMate spike
