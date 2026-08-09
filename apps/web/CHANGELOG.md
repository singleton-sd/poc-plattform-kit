# Changelog

Release history for **@poc-plattform-kit/web**, generated from conventional commits by the release-it workflow.

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
