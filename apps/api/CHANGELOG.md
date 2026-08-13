# Changelog

Release history for **@poc-plattform-kit/api**, generated from conventional commits by the release-it workflow.

## Unreleased

### New

- Allow CORS from ACA web PR preview hosts

  Scoped `ssd-pocpk-aca-web-pr-*` origins only — not every Container App.

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
