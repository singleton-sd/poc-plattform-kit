# Changelog

Release history for **@poc-plattform-kit/api**, generated from conventional commits by the release-it workflow.

## 0.23.1 — 2026-08-22

### Fixed

- avoid Array.at in changelog spec for ES2021 target

- stop hardcoding changelog release count in API test

  Assert the newest release matches apps/api package.json version instead

## 0.23.0 — 2026-08-22

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

- 198 Allow CORS from ACA web previews

- Show field errors after blur

  Give hosts a per-field touched signal and a form-level

- Add tenant group principals

- Add tenant access reads

- Add live character counter to TextControl

  Show used/maxLength when schema.maxLength is set and wire it into aria-describedby with the error id.

- Expose tenant memberships on me

- Persist SSO user on sign-in

- Extract @poc-plattform-kit/email package

  Move EmailProvider + contact helpers out of the Notifications

- Add frontend permission gating

  Wire usePermission/PermissionGate with Request Access CTA on

- Contact on marketing-edge Function

  Brochure Contact posts to Function App /contact via Forward

- Access Request workflow

  Prisma AccessRequest + PermissionsAudit, approve/deny APIs that call Grant, and outbox events for Notifications.

- Add Forward Email foundation

  Provider-independent EmailProvider with Forward Email HTTP and

- Permission catalog automation + drift check

  Manifest-driven route mappings for PermissionsGuard, register script for

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

- Add client changelogs

- Provision OpenFGA server

  Add ACA + Azure Files SQLite (beta), Entra OIDC bootstrap, tenant

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

- build email package before openapi export

  Ensure CI can resolve @poc-plattform-kit/email dist artifacts during API OpenAPI export.

- 214 Harden role assignment commands

- Fix nullable group types

- Restrict permission mutation routes

- mark respondedAt as required-but-nullable in invitation response

  respondedAt is always present on TenantInvitationResponseDto (never

- address Copilot feedback on tenant invitations

  Set respondedAt when expiry-sweeping stale pending invites, align the

- Address onboarding review

  Stop preview workflows from migrating shared Azure SQL. Enforce the

- Address Copilot review comments

  Scope pending-create idempotency by tenant, validate mine query

- remove aria-required from fieldset in ArrayControlRenderer (invalid ARIA on group role)

- address remaining human review feedback on preview scenario tooling

  Merged in patoperpetua-review-pr-117 (workflow paths filter, docs example,

- address Codex review findings on preview scenario tooling

  declaration line, so the PR template's own instructional example

- Drop native required, keep aria-required only

  Native required on text/select/date inputs makes the browser run

- Add required/aria-required to shared field renderers

  Text, select, date, and array field renderers in packages/forms only

- Close invitation race conditions from Codex review

  Addresses three P2 findings on TenantInvitationService:

- Update test fixture for AuthenticatedUser.roles rename

  main renamed AuthenticatedUser.role (singular) to roles: string[]

## 0.22.0 — 2026-08-08

### New

- Return all Entra app roles

  Preserve roles[] on AuthenticatedUser and /api/me so

## 0.21.0 — 2026-08-08

### New

- Add manager/reporting-line resolution from Entra

  Adds ManagerChainService to the Permissions pillar: resolves a user's

### Fixed

- Fix Nest DI boot crash and transient-failure caching

  interface-typed constructor params to an unregistered Object

## 0.20.0 — 2026-08-08

### New

- Add outbox drainer

### Fixed

- Harden outbox delivery

- Inject Service Bus client token

## 0.19.0 — 2026-08-08

### New

- cursor pagination for GET /tenants + Load more in the UI

  Per follow-up request, implement real pagination instead of leaving the

- responsive tenant admin UI + optional/auto-generated slug

  Replace the developer-oriented /tenants workspace with a responsive admin

## 0.18.0 — 2026-08-08

### New

- Add permissions route guard

### Fixed

- Enable configured OpenFGA checks

## 0.17.0 — 2026-08-08

### New

- Harden API HTTP defaults

### Fixed

- Address throttle feedback

## 0.16.0 — 2026-08-08

### New

- Add Swagger Entra OAuth2 Authorize

  Wire authorization-code + PKCE in Swagger UI, redirect API

## 0.15.0 — 2026-08-07

### New

- Add MSAL Bearer auth for SWA previews

  SWA hosts cannot share Auth.js cookies; use MSAL popup +

### Fixed

- Accept Entra v2 client-id audience on Bearer JWTs

  requestedAccessTokenVersion 2 mints access tokens with aud=client id, so Nest must not require only the App ID URI.

- Fix Bearer /api/me after MSAL redirect

  Cache redirect access tokens, accept upn on Nest claim

## 0.14.0 — 2026-08-07

### New

- Add contact name change flow

### Fixed

- Await persistence operations

## 0.13.0 — 2026-08-07

### New

- Service Bus topic naming + Audit/Reporting subscription stubs

  Document topic/subscription naming in packages/events with exhaustive,

### Fixed

- Give packages/events a real dist build for runtime consumers

  Codex review on PR #75: apps/api's compiled production entrypoint

- Make packages/events CommonJS to match ts-node/jest tooling

  apps/api's openapi:export script loads the Nest app graph via ts-node in

## 0.12.0 — 2026-08-07

### New

- Add tenant support search

### Fixed

- Cap tenant service results

## 0.11.0 — 2026-08-07

### New

- Add JSON Forms demo

### Fixed

- Address form review feedback

## 0.10.0 — 2026-08-07

### New

- Allow SWA preview CORS origins

  Support https://*.azurestaticapps.net in CORS_ORIGINS so SWA PR

### Fixed

- Scope SWA CORS to repo instance hosts

  Auth.js redirects ignore open *.azurestaticapps.net and only

## 0.9.0 — 2026-08-07

### New

- Cross-subdomain SSO cookies (Option B)

  Keep SWA Free: share Auth.js cookies across app/api hosts and

### Fixed

- Emit flat API dist for ACA preview

  Clear build path maps and set rootDir so nest emits

## 0.8.0 — 2026-08-06

### New

- Map Auth Entra App Config to runtime env

  Promote existing App Config Entra keys and KV refs into AUTH_* /

## 0.7.0 — 2026-08-06

### New

- Wire web tenants to generated api-client

  Use Orval TanStack hooks for tenant create/read/update, configure

## 0.6.0 — 2026-08-06

### New

- Add permissions stub

### Fixed

- Match check status contract

- Stabilize client output

## 0.5.0 — 2026-08-06

### New

- Load API configuration from Azure App Configuration (86d3yjvcg)

### Fixed

- Wire preview configuration

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

- Custom domains under singletonsd.com

  Wire marketing/app/api hostnames, B1 App Service, marketing SWA,

- Tenant stub + tenancy context

  Tenant Nest module with ALS context from x-tenant-id,

- Add Notifications pillar (ClickUp 86d3xa2u4)

  Lock ninth pillar for outbound email/SMS/WhatsApp with

- Add Prisma Outbox/Audit schema per pillar

  models for all seven pillars, sqlserver provider

- Add Nest host, Swagger, health

### Fixed

- Lean pnpm deploy zip to avoid App Service Kudu 504

  Full monorepo node_modules (~746MB) timed out on B1 ZipDeploy. Stage with

- Remerge main production deploys

  Keep Path B ACA preview-api.yml; fold in deploy-web /

- Remerge main Notifications pillar

  Keep Path B ACA + ACR KV secrets alongside Notifications

- Resolve main merge for ACA previews
