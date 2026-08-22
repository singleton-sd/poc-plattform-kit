# Changelog

Release history for **@poc-plattform-kit/web**, generated from conventional commits by the release-it workflow.

## 0.16.0 — 2026-08-22

### New

- add BIMI brand identity to transactional email

  Host and wire a BIMI logo + selector for provider-supported transactional branding.

- add multi-PoC Forward Email sender profiles

  Support tenant and host-based contact sender overrides while keeping forwardemail.net as the delivery provider, including config mapping, validation, tests, and documentation for multi-PoC rollout.

- harden transactional email domain authentication

  Externalize sender-domain DMARC/SPF/DKIM settings and remove deployment-specific defaults from shared email runtime logic. Add sender-domain alignment validation, DMARC aggregate reporting configuration guidance, and provisioning support for enforced DMARC policy.

- add automated email domain branding validator

  Add a reusable domain-agnostic validation command that checks SPF, DKIM, DMARC, BIMI DNS, BIMI logo reachability, and BIMI SVG structure with actionable failures for deployment gates.

- 214 Add role assignment commands

- Add JSON validity feedback

  Show parse errors on the settings textarea after blur

- 197 Use MSAL Bearer on ACA web preview hosts

  ---------

- 200 Add nginx web preview image

- Show field errors after blur

  Give hosts a per-field touched signal and a form-level

- Add tenant group principals

- Add tenant access reads

- Add live character counter to TextControl

  Show used/maxLength when schema.maxLength is set and wire it into aria-describedby with the error id.

- Expose tenant memberships on me

- Migrate protected FE routes to AuthenticationGuard

  Keep page chrome mounted while session loading and signed-out

- Extract @poc-plattform-kit/email package

  Move EmailProvider + contact helpers out of the Notifications

- Add frontend permission gating

  Wire usePermission/PermissionGate with Request Access CTA on

- Access Request workflow

  Prisma AccessRequest + PermissionsAudit, approve/deny APIs that call Grant, and outbox events for Notifications.

- Add baseline Storybook UI catalogue

  Cover primitives, schema-driven forms, and tenant empty-state

- Add Playwright web journeys

- Add deterministic MSW scenarios

- Add Storybook foundation

- Add permissions grant/revoke API

  Expose permanent, temporary (not_yet_expired), and one-time grants

- Backfill changelog history

- deploy seeded SQLite databases in API PR previews

  [repo=singleton-sd/poc-plattform-kit] [clickup=86d3zgyzt]

- Add POST /tenants/self-service and fix onboarding follow-through

  only by the global session/JWT APP_GUARD (no @Roles) so any authenticated

- add deterministic composable preview seed scenarios

  [repo=singleton-sd/poc-plattform-kit] [clickup=86d3zgyzp]

- generate a SQLite Prisma client and template for API preview images

  [repo=singleton-sd/poc-plattform-kit] [clickup=86d3zgyzm]

- Add project changelogs

- tenant invitations data model + create/list/revoke API

  Adds TenantInvitation Prisma model (forward-only migration) plus

- Add self-service tenant creation onboarding

  Signed-in users with no known tenant now see a "Create your tenant"

- Add client changelogs

- Add tenant membership + auto-assign creator as owner

  Foundation ticket for the tenant-invitations epic:

### Fixed

- distinguish host DNS failures and cancel oversize reads

  Return lookupFailed from host A/AAAA resolution so resolver errors are reported separately from empty results. Cancel the response body reader when the BIMI logo exceeds the size limit.

- fail SPF validation when record ends with +all

- reject non-global BIMI logo destination addresses

  Extend destination classification to block IPv4-compatible loopback, RFC5737 documentation nets, IPv6 2001:db8::/32, and IPv4 multicast ranges.

- surface DNS resolver failures separately from missing records

- address PR #267 review on undici engine pin and fetch cleanup

  Pin email package Node to >=20.18.1 for undici 7.x, destroy pinned dispatchers in finally, reject unspecified/multicast IPv6, and assert fetch redirect/timeout safeguards in tests.

- harden BIMI logo fetch against DNS rebinding and IPv6 SSRF

- address PR #267 review feedback on domain validator

- merge main into #266 and align validator with auth profile

  Reconcile with merged #264/#265 email auth and BIMI work. Resolve .env.example conflict, restrict expected DMARC policy to quarantine|reject, and default validation env fallbacks to EMAIL_DKIM_SELECTOR/EMAIL_DMARC_POLICY.

- reject empty DMARC rua comma segments and normalize rua output

- address PR #268 review feedback and marketing-oauth CI

  Remove duplicate EMAIL_SENDING_DOMAIN and sendingDomain App Config alias, tighten DMARC policy/rua validation, align host-profile tests with sending-domain checks, and validate aggregate report URIs in the provisioning script.

- merge main into #264 and reconcile auth profile with BIMI

  Integrate merged BIMI/contact-profile work from main while preserving transactional email auth validation (DMARC, sending-domain alignment) in a dedicated transactional-email-auth-profile module.

- declare BIMI logo SVG response in OpenAPI

  Document the /bimi/logo.svg 200 response as image/svg+xml and regenerate the api-client so the BIMI logo body is typed.

- commit OpenAPI client drift for BIMI logo endpoint

  Regenerate openapi.json and api-client after adding the public /bimi/logo.svg route and Swagger tag.

- harden multi-PoC email profile validation and trust boundaries

  Require EMAIL_ALLOW_PRODUCTION_SEND for explicit forward-email selection, reject malformed profile fields, validate profile overrides, and apply host overrides only from ORIGINS-allowlisted trusted hosts.

- address CodeRabbit BIMI and MIME review feedback

  Tighten BIMI selector DNS label validation, require HTTPS evidence URLs, and fix quoted-printable encoding for astral Unicode with RFC-compliant soft line breaks.

- address BIMI review feedback on MIME and DNS helpers

  Use quoted-printable for non-ASCII raw MIME parts and centralize BIMI Route53 record construction via shared TypeScript helpers consumed by the PowerShell provisioning script.

- consolidate PoC email profile helpers and cache host map

  Share tenant settings.email parsing via @poc-plattform-kit/email and memoize CONTACT_EMAIL_PROFILES_BY_HOST JSON parsing for contact hot paths.

- 214 Harden role assignment commands

- #217 Migrate web tokens to npm

  Consume @singleton-sd/tokens instead of the CDN so the --ssd-* 1.3 contract resolves on the web app.

- Fix nullable group types

- Type PermissionGate story harness

- Avoid premature CreateProjectForm validation errors

  Hide JSON Forms errors until submit is attempted, gate the submit button on validity, and surface all Zod issues instead of only the first.

- Mark hand-built lookup inputs as required for assistive tech

- Normalise tenant slug case and trim name

  Accept mixed-case slugs by lowercasing before validation, and trim names so whitespace-only values fail min(1).

- Restrict permission mutation routes

- mark respondedAt as required-but-nullable in invitation response

  respondedAt is always present on TenantInvitationResponseDto (never

- address Copilot feedback on tenant invitations

  Set respondedAt when expiry-sweeping stale pending invites, align the

- Address onboarding review

  Stop preview workflows from migrating shared Azure SQL. Enforce the

- Keep create-form validation after submit

  Ignore JsonForms onChange echoes so submit-time errors stay

- Unblock auth tests from main

  Use jsdom origin for same-origin sanitization and stop mocking

- Address Copilot review comments

  Scope pending-create idempotency by tenant, validate mine query

- remove mutation.reset() from JsonForms onChange to fix PopulatedSubmit race condition

- remove aria-required from fieldset in ArrayControlRenderer (invalid ARIA on group role)

- Add QueryClientProvider to AuthenticationGuard test

- preserve Auth.js callback return target for both cookie and bearer flows

  Providers consumes the one-time returnTo for both MSAL and Auth.js cookie redirects to preserve user's original URL.

- Harden permission gate errors

  Reject non-2xx Orval envelopes in unwrap helpers, render check

- Relax Orval unwrap typing

  Avoid unioning Orval error response shapes into unwrap helpers so

- Replace Escape drawer play with Close click

  Chromatic interaction runs were still failing Escape keyboard

- Stabilize Storybook interaction plays

  Scope drawer escape through harness state and avoid ambiguous

- Align Playwright origin allowlist

  Allow PLAYWRIGHT_BASE_URL hosts in the network fixture, keep Jest and

- address Codex review findings on preview scenario tooling

  declaration line, so the PR template's own instructional example

- Drop native required, keep aria-required only

  Native required on text/select/date inputs makes the browser run

- Add required/aria-required to shared field renderers

  Text, select, date, and array field renderers in packages/forms only

- Enforce restricted creation

- Close invitation race conditions from Codex review

  Addresses three P2 findings on TenantInvitationService:

## 0.15.0 — 2026-08-08

### New

- Return all Entra app roles

  Preserve roles[] on AuthenticatedUser and /api/me so

## 0.14.1 — 2026-08-08

### Fixed

- Harden outbox delivery

## 0.14.0 — 2026-08-08

### New

- cursor pagination for GET /tenants + Load more in the UI

  Per follow-up request, implement real pagination instead of leaving the

- responsive tenant admin UI + optional/auto-generated slug

  Replace the developer-oriented /tenants workspace with a responsive admin

### Fixed

- SWA web previews now hit their own PR's API preview

  Root cause of the empty tenant table on this PR's preview: preview-web.yml

- address Codex review — restore Enter-to-submit and by-ID lookup

  the drawer's footer buttons via the HTML `form` attribute) instead of

## 0.13.0 — 2026-08-08

### New

- Add permissions route guard

### Fixed

- Enable configured OpenFGA checks

## 0.12.0 — 2026-08-08

### New

- Add Swagger Entra OAuth2 Authorize

  Wire authorization-code + PKCE in Swagger UI, redirect API

## 0.11.0 — 2026-08-07

### New

- Add MSAL Bearer auth for SWA previews

  SWA hosts cannot share Auth.js cookies; use MSAL popup +

### Fixed

- Fix Bearer /api/me after MSAL redirect

  Cache redirect access tokens, accept upn on Nest claim

- Use MSAL redirect to avoid Entra COOP

  Popup login fails when Entra sets Cross-Origin-Opener-Policy

- Clarify missing MSAL env on preview sign-in

  Surface a clearer error when NEXT_PUBLIC_AZURE_AD_*

- Address MSAL preview review feedback

  Default api:// scope, keep active MSAL account, and

## 0.10.0 — 2026-08-07

### New

- Service Bus topic naming + Audit/Reporting subscription stubs

  Document topic/subscription naming in packages/events with exhaustive,

### Fixed

- Give packages/events a real dist build for runtime consumers

  Codex review on PR #75: apps/api's compiled production entrypoint

- Make packages/events CommonJS to match ts-node/jest tooling

  apps/api's openapi:export script loads the Nest app graph via ts-node in

## 0.9.0 — 2026-08-07

### New

- Add tenant support search

- Add support tenant lookup

### Fixed

- Resolve support shell conflict

## 0.8.0 — 2026-08-07

### New

- Add JSON Forms demo

### Fixed

- Address form review feedback

## 0.7.0 — 2026-08-07

### New

- Align admin branding with marketing

  Share product token palette and Platform Kit wordmark

- Cross-subdomain SSO cookies (Option B)

  Keep SWA Free: share Auth.js cookies across app/api hosts and

- Harden web telemetry

- Add Auth.js Entra login page

### Fixed

- Emit flat API dist for ACA preview

  Clear build path maps and set rootDir so nest emits

- Point auth at API host; login at /

## 0.6.0 — 2026-08-06

### New

- Wire web tenants to generated api-client

  Use Orval TanStack hooks for tenant create/read/update, configure

## 0.5.0 — 2026-08-06

### New

- Add permissions stub

### Fixed

- Stabilize client output

## 0.4.0 — 2026-08-06

### New

- Enforce Nest API AuthN

  Global session/JWT APP_GUARD with public allowlist, Roles gate,

## 0.3.0 — 2026-08-06

### New

- Add App Insights telemetry and alerts

  Wire LAW + App Insights, Nest OTel/Pino, web client telemetry,

## 0.2.0 — 2026-08-06

### New

- Add hub conflict playbook

  Add resolve-merge-conflicts.ps1 and pnpm resolve:conflicts so agents

## 0.1.0 — 2026-08-06

### New

- Add path-aware release-it versioning

- OpenAPI export + packages/api-client (Orval)

  Commit Nest OpenAPI as the contract, generate a TanStack Query

- SingleSignOn Entra JWT + Auth.js cookies

  Nest hosts Auth.js at /api/auth and GET /api/me; JWT guard

- Tenant stub + tenancy context

  Tenant Nest module with ALS context from x-tenant-id,

- Add Notifications pillar (ClickUp 86d3xa2u4)

  Lock ninth pillar for outbound email/SMS/WhatsApp with

- Add Next PWA SPA shell, tokens, Support page

  Tailwind mapped to Singleton SD design token CSS variables

- Add Prisma Outbox/Audit schema per pillar

  models for all seven pillars, sqlserver provider

### Fixed

- Harden me fetch and support errors

- Address bugbot and CI for web SPA
