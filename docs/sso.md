# SingleSignOn (Keycloak OIDC + Auth.js cookies)

## Runtime contract

| Surface | Behaviour |
| --- | --- |
| Nest `/api/auth/*` | Auth.js (`@auth/express`) Keycloak provider; httpOnly session cookies |
| Nest `GET /api/me` | Cookie session **or** Bearer Keycloak access token to `{ id, email, name, roles: string[] }` |
| Global `APP_GUARD` | `SessionOrJwtAuthGuard` + `RolesGuard` — non-public Nest routes require session or Bearer; `@Roles` passes when **any** user role matches |
| JWT guard | Validates Keycloak JWTs via realm JWKS (`KEYCLOAK_ISSUER`, `KEYCLOAK_API_AUDIENCE` and/or `KEYCLOAK_CLIENT_ID` as `aud`) |
| Web SPA (custom domain) | Auth.js cookies; `fetch(..., { credentials: 'include' })` via `NEXT_PUBLIC_API_BASE_URL` |
| Web SPA (SWA Free / PR) | `oidc-client-ts` redirect + `Authorization: Bearer` (no shared cookie Domain) |

See [ADR 0006](./adr/0006-platform-kit-multitenancy.md) (org ADR-002). Dual cookie/Bearer transport from [ADR 0004](./adr/0004-cross-subdomain-cookie-auth-swa-free.md) stays; Bearer is public OIDC, not MSAL.

## Public vs protected

| Public (no AuthN) | Protected |
| --- | --- |
| `GET /` (302 → `/docs`) | `GET /api/me` |
| `GET /health` (`@Public()`) | `/tenants/**` (and other domain routes as they land) |
| `/api/auth/*` (Auth.js) | |
| `/docs`, `/docs-json`, `/docs/oauth2-redirect.html` (Swagger) | |

Mark additional Nest handlers with `@Public()` when they must stay anonymous. Coarse app roles use `@Roles('tenant-admin' \| 'support-agent')` (e.g. `POST /tenants`, `PATCH /tenants/:id`).

## Swagger Authorize (Keycloak OAuth2)

Swagger UI at `/docs` exposes an **oauth2** scheme (authorization code + PKCE) in addition to Bearer paste and `x-tenant-id`.

| Piece | Value |
| --- | --- |
| Authorize | `{KEYCLOAK_ISSUER}/protocol/openid-connect/auth` |
| Client id (prefilled) | `KEYCLOAK_CLIENT_ID` |
| Default API scope | `KEYCLOAK_SWAGGER_SCOPE` / App Config `app:keycloak:swaggerScope`, else `KEYCLOAK_API_AUDIENCE` / `KEYCLOAK_CLIENT_ID` |
| Redirect URI | Same-origin `{currentHost}/docs/oauth2-redirect.html` (Swagger UI derives this; optional override `SWAGGER_OAUTH2_REDIRECT_URL`). Do **not** default from prod `AUTH_URL` — that breaks ACA PR previews. |
| Token URL | Same-origin relative `/docs/oauth2/token` (Nest proxy) |

Register that redirect URI on the Keycloak confidential API client (Singleton Auth owns production clients). Prod example: `https://api.plattform-kit.poc.singletonsd.com/docs/oauth2-redirect.html`. Local example: `http://localhost:3001/docs/oauth2-redirect.html`. Each ACA PR host also needs its exact redirect.

Token exchange uses Nest `POST /docs/oauth2/token` (server adds `KEYCLOAK_CLIENT_SECRET`) so the browser never calls Keycloak’s token endpoint. The API serves a custom `/docs/oauth2-redirect.html` plus a one-shot BroadcastChannel bridge on `/docs`.

## Tenancy

Prefer optional token/session claim `tenant_id` → `AuthenticatedUser.tenantId` over `x-tenant-id`. The header remains a **legacy/dev escape** when the claim is absent; when both are present, the **claim wins** (see `TenancyMiddleware` + `ClaimTenancyInterceptor`). Do not treat a Keycloak realm id as the Platform Kit tenant id.

## Env (see `.env.example`)

Server / Auth.js: `AUTH_SECRET`, `AUTH_URL`, `AUTH_COOKIE_DOMAIN`, `KEYCLOAK_ISSUER`, `KEYCLOAK_CLIENT_ID`, `KEYCLOAK_CLIENT_SECRET`, `KEYCLOAK_API_AUDIENCE`, `CORS_ORIGINS`

Web (build-time, inlined): `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_KEYCLOAK_ISSUER`, `NEXT_PUBLIC_KEYCLOAK_CLIENT_ID`, optional `NEXT_PUBLIC_KEYCLOAK_API_AUDIENCE` (defaults to the SPA client id). Nest accepts `KEYCLOAK_API_AUDIENCE` (fallback: `KEYCLOAK_CLIENT_ID`) as JWT `aud`.

Production issuer: `https://auth.singletonsd.com/realms/singletonsd`. Client IDs are created by Singleton Auth — never hardcode them.

KV secret names (human): `auth-secret`, `keycloak-client-secret`.

Local Keycloak (optional, not required for unit tests):

```bash
docker compose -f infra/keycloak/docker-compose.yml up
```

Issuer `http://127.0.0.1:8080/realms/plattform-kit-test`. See [`infra/keycloak/README.md`](../infra/keycloak/README.md). Unit tests sign RS256 JWTs with `jose` against that issuer/audience and never call production Keycloak.

## Option B — cross-subdomain cookies (locked for PoC)

SWA **Free** cannot use Bring-your-own API (App Service link requires SWA **Standard**). Cost lock stays Free ×2.

| Piece | Value |
| --- | --- |
| Web origin | `https://app.plattform-kit.poc.singletonsd.com` |
| API origin | `https://api.plattform-kit.poc.singletonsd.com` |
| Cookie `Domain` | `.plattform-kit.poc.singletonsd.com` (`AUTH_COOKIE_DOMAIN`) |
| CORS | App (+ marketing) origins + instance-scoped SWA prefixes (`https://{swaName}*.azurestaticapps.net`) with `credentials: true` |
| SPA calls | Absolute API base (`NEXT_PUBLIC_API_BASE_URL`), not same-origin `/api` |

Sibling subdomains under `singletonsd.com` are same-site, so `SameSite=Lax` + shared cookie Domain is enough for credentialed `fetch` from `app.` → `api.`.

Do **not** upgrade app SWA to Standard solely for `/api` linking unless cost lock is explicitly revised.

## Web PR previews

Production web stays on SWA Free (`app.plattform-kit.poc.singletonsd.com` and the SWA default hostname). **PR** previews for `apps/web` run on Container Apps (`ssd-pocpk-aca-web-pr-<n>-ae.*.azurecontainerapps.io`). Marketing PR previews are GitHub Pages paths (`/pr-preview/pr-<n>/`) and do not participate in Auth.js / OIDC.

Preview hosts **cannot** share the PoC cookie Domain, and Auth.js CSRF (`__Host-…; SameSite=Lax`) fails cross-site (`MissingCSRF`).

### Auth mode (locked)

| Host | Mode |
| --- | --- |
| `app.plattform-kit.poc.singletonsd.com` (and other custom / localhost hosts) | Auth.js cookies (Option B) |
| `*.azurestaticapps.net` (production SWA default hostname) | OIDC **redirect** → Keycloak access token → `Authorization: Bearer` on `/api/me` and Orval `customFetch` |
| `ssd-pocpk-aca-web-pr-<n>-ae.*.azurecontainerapps.io` (web PR previews) | Same OIDC Bearer path as SWA hosts |

Nest accepts Bearer via `KeycloakJwtStrategy` (`KEYCLOAK_API_AUDIENCE` / client id). Prod cookie path is unchanged. API preview hosts (`ssd-pocpk-aca-pr-<n>-ae`) are **not** SPA origins.

### CORS (locked)

`CORS_ORIGINS` / App Config `app:cors:origins` includes:

- Custom domains: `https://app.plattform-kit.poc.singletonsd.com`, `https://plattform-kit.poc.singletonsd.com`
- Instance-scoped SWA hosts: `https://kind-rock-0f409fe00*.azurestaticapps.net`, `https://purple-field-05048bf00*.azurestaticapps.net` (default hostname; leftover SWA staging hosts)
- Web ACA PR previews: Nest also allows `ssd-pocpk-aca-web-pr-<n>-ae.<hash>.australiaeast.azurecontainerapps.io` even when App Config overrides the list (see `apps/api/src/cors-origins.ts`)

Do **not** use open `https://*.azurestaticapps.net` or `https://*.azurecontainerapps.io` for Auth.js redirects — that would allow any Azure customer’s app as a post-login redirect target. Nest CORS may still parse a SWA suffix form if misconfigured; Auth.js redirect checks ignore it and only honour exact origins + `{swaName}*` instance prefixes. Open ACA wildcards are rejected.

Nest resolves wildcards at request time (`isCorsOriginAllowed` / `isAuthRedirectOriginAllowed`). Applies to prod App Service and ACA PR API previews (same Nest bootstrap).

### Keycloak redirect URIs

Production clients are created by Singleton Auth. Ask that team for:

| Flow | Redirect URI |
| --- | --- |
| Auth.js (Option B cookies) | API callback only: `https://api.plattform-kit.poc.singletonsd.com/api/auth/callback/keycloak` (`AUTH_URL`). Preview origins are **not** redirect URIs for this flow. |
| Swagger UI OAuth2 (PKCE) | Confidential client: prod `…/docs/oauth2-redirect.html`, local `http://localhost:3001/docs/oauth2-redirect.html`, and each ACA PR API preview host’s `…/docs/oauth2-redirect.html`. |
| OIDC / Bearer SPA | Public SPA client: exact preview origins (`*.azurestaticapps.net` / `*.azurecontainerapps.io` have no wildcards). `oidc-client-ts` uses `window.location.origin` as `redirect_uri`. The nginx preview image sets `Cross-Origin-Opener-Policy: same-origin-allow-popups`. |

`preview-web.yml` no longer PATCHes Entra `spa.redirectUris` — Keycloak clients are not this repo’s to mutate.

### Build / GitHub Variables

`preview-web.yml` / `deploy-web.yml` bake (IDs only, no secrets):

- `NEXT_PUBLIC_KEYCLOAK_ISSUER`
- `NEXT_PUBLIC_KEYCLOAK_CLIENT_ID`
- `NEXT_PUBLIC_KEYCLOAK_API_AUDIENCE` (optional)

Set matching repo **Variables**. Expect access-token `aud` = `KEYCLOAK_API_AUDIENCE` (or the confidential client id).

### Follow-ups

| Title | Intent |
| --- | --- |
| Preview: SWA API base URL prod vs ACA | Bake `NEXT_PUBLIC_API_BASE_URL` → this PR’s API ACA preview when it exists, else prod |

## Human portal follow-ups

Keycloak clients, realm mappers, and KV/App Config seeding are owned by Singleton Auth (human-only). Ensure redirect URIs include:

- Auth.js callback: `https://api.plattform-kit.poc.singletonsd.com/api/auth/callback/keycloak`
- Swagger OAuth2: `https://api.plattform-kit.poc.singletonsd.com/docs/oauth2-redirect.html`

Also ensure App Service/App Config expose `AUTH_*` / `KEYCLOAK_*` / `AUTH_COOKIE_DOMAIN` / `AUTH_URL`. Also set GitHub Variables `NEXT_PUBLIC_KEYCLOAK_ISSUER` / `NEXT_PUBLIC_KEYCLOAK_CLIENT_ID` (and optional API audience).

Microsoft Graph manager-chain resolution remains Entra-only and fail-soft when `User.entraOid` is null (see Permissions access requests).

## HTTP hardening

The Nest API applies Helmet's default response headers on App Service and ACA.
Content Security Policy is intentionally disabled in the API middleware because
Swagger UI currently needs inline assets; the remaining Helmet protections apply
to `/health`, `/api/auth/*`, Swagger, and protected controllers.

Nest controllers also share a global in-memory rate limit of **100 requests per
60 seconds per client IP**. Express trusts the single App Service/ACA proxy hop
when resolving that IP. Override it with positive integers in
`API_THROTTLE_LIMIT` and `API_THROTTLE_TTL_MS` (App Configuration keys
`app:throttle:limit` and `app:throttle:ttlMs`). Auth.js callbacks are mounted as
Express middleware and are therefore covered by Helmet but not the Nest
controller throttle. This baseline is per process; use an external store or edge
rate limiter before scaling to quotas that must be consistent across replicas.

To check the `429 Too Many Requests` response locally, temporarily set
`API_THROTTLE_LIMIT=2`, restart `pnpm dev:api`, then make three requests within a
minute:

```bash
for request in 1 2 3; do curl -i http://localhost:3001/health; done
```
