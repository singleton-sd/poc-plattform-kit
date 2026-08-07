# SingleSignOn (Entra JWT + Auth.js cookies)

`[repo=singleton-sd/poc-plattform-kit]`

## Runtime contract

| Surface | Behaviour |
| --- | --- |
| Nest `/api/auth/*` | Auth.js (`@auth/express`) Microsoft Entra ID provider; httpOnly session cookies |
| Nest `GET /api/me` | Cookie session **or** Bearer Entra access token to `{ id, email, name, role }` |
| Global `APP_GUARD` | `SessionOrJwtAuthGuard` + `RolesGuard` — non-public Nest routes require session or Bearer |
| JWT guard | Validates Entra JWTs via JWKS (`AZURE_AD_TENANT_ID`, `AZURE_AD_API_AUDIENCE` and/or `AZURE_AD_CLIENT_ID` as `aud`) |
| Web SPA (custom domain) | Auth.js cookies; `fetch(..., { credentials: 'include' })` via `NEXT_PUBLIC_API_BASE_URL` |
| Web SPA (SWA Free / PR) | MSAL.js popup + `Authorization: Bearer` (no shared cookie Domain) |

## Public vs protected

| Public (no AuthN) | Protected |
| --- | --- |
| `GET /` (302 → `/docs`) | `GET /api/me` |
| `GET /health` (`@Public()`) | `/tenants/**` (and other domain routes as they land) |
| `/api/auth/*` (Auth.js) | |
| `/docs`, `/docs-json`, `/docs/oauth2-redirect.html` (Swagger) | |

Mark additional Nest handlers with `@Public()` when they must stay anonymous. Coarse Entra app roles use `@Roles('tenant-admin' \| 'support-agent')` (e.g. `POST /tenants`, `PATCH /tenants/:id`).

## Swagger Authorize (Entra OAuth2)

Swagger UI at `/docs` exposes an **oauth2** scheme (authorization code + PKCE) in addition to Bearer paste and `x-tenant-id`.

| Piece | Value |
| --- | --- |
| Authorize / token | `https://login.microsoftonline.com/{AZURE_AD_TENANT_ID}/oauth2/v2.0/{authorize\|token}` |
| Client id (prefilled) | `AZURE_AD_CLIENT_ID` |
| Default API scope | `AZURE_AD_SWAGGER_SCOPE` / App Config `app:azureAd:swaggerScope`, else `{AZURE_AD_CLIENT_ID}/.default` (bare GUID — required for same-app Swagger; avoids AADSTS90009 / AADSTS500011). |
| Redirect URI | `{AUTH_URL}/docs/oauth2-redirect.html` (override with `SWAGGER_OAUTH2_REDIRECT_URL`) |

Register that redirect URI on the Entra app registration as a **Web** platform redirect (not SPA — SPA triggers Entra `/reprocess` loops with Swagger). Prod example: `https://api.plattform-kit.poc.singletonsd.com/docs/oauth2-redirect.html`. Local example: `http://localhost:3001/docs/oauth2-redirect.html`.

Token exchange uses Nest `POST /docs/oauth2/token` (server adds `AZURE_AD_CLIENT_SECRET`) so the browser never calls Entra’s token endpoint. Entra’s login navigation can still break Swagger’s stock `window.opener` handoff; the API serves a custom `/docs/oauth2-redirect.html` plus a one-shot BroadcastChannel bridge on `/docs`.

## Tenancy

Prefer optional token/session claim `tenant_id` → `AuthenticatedUser.tenantId` over `x-tenant-id`. The header remains a **legacy/dev escape** when the claim is absent; when both are present, the **claim wins** (see `TenancyMiddleware` + `ClaimTenancyInterceptor`). Do not treat Entra directory `tid` as the Platform Kit tenant id.

## Env (see `.env.example`)

Server / Auth.js: `AUTH_SECRET`, `AUTH_URL`, `AUTH_COOKIE_DOMAIN`, `AZURE_AD_CLIENT_ID`, `AZURE_AD_CLIENT_SECRET`, `AZURE_AD_TENANT_ID`, `AZURE_AD_API_AUDIENCE`, `CORS_ORIGINS`

Web (build-time, inlined): `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_AZURE_AD_CLIENT_ID`, `NEXT_PUBLIC_AZURE_AD_TENANT_ID`, optional `NEXT_PUBLIC_AZURE_AD_API_SCOPE` (defaults to `api://{clientId}/.default`). With Entra `requestedAccessTokenVersion: 2`, access-token `aud` is the **client id** (GUID); Nest accepts that plus optional `AZURE_AD_API_AUDIENCE` (App ID URI) for older tokens.

KV secret names (human): `auth-secret`, `azure-ad-client-secret`.

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

## SWA PR previews

Preview hosts stay on `*.azurestaticapps.net` (no custom preview domains). They **cannot** share the PoC cookie Domain, and Auth.js CSRF (`__Host-…; SameSite=Lax`) fails cross-site (`MissingCSRF`).

### Auth mode (locked)

| Host | Mode |
| --- | --- |
| `app.plattform-kit.poc.singletonsd.com` (and other non-SWA hosts) | Auth.js cookies (Option B) |
| `*.azurestaticapps.net` (default + PR preview) | MSAL **redirect** → Entra access token → `Authorization: Bearer` on `/api/me` and Orval `customFetch` (popup is blocked by Entra `Cross-Origin-Opener-Policy`) |

Nest already accepts Bearer via `EntraJwtStrategy` (`AZURE_AD_API_AUDIENCE` / client id). Prod cookie path is unchanged.

### CORS (locked)

`CORS_ORIGINS` / App Config `app:cors:origins` includes:

- Custom domains: `https://app.plattform-kit.poc.singletonsd.com`, `https://plattform-kit.poc.singletonsd.com`
- Instance-scoped SWA hosts: `https://kind-rock-0f409fe00*.azurestaticapps.net`, `https://purple-field-05048bf00*.azurestaticapps.net` (default hostname + PR preview hosts such as `https://kind-rock-…-57.eastasia.7.azurestaticapps.net`)

Do **not** use open `https://*.azurestaticapps.net` for Auth.js redirects — that would allow any Azure customer’s Static Web App as a post-login redirect target. Nest CORS may still parse that suffix form if misconfigured; Auth.js redirect checks ignore it and only honour exact origins + `{swaName}*` instance prefixes.

Nest resolves wildcards at request time (`isCorsOriginAllowed` / `isAuthRedirectOriginAllowed`). Applies to prod App Service and ACA PR API previews (same Nest bootstrap).

### Entra redirect URIs (approved pattern)

| Flow | Redirect URI |
| --- | --- |
| Auth.js (Option B cookies) | API callback only: `https://api.plattform-kit.poc.singletonsd.com/api/auth/callback/microsoft-entra-id` (`AUTH_URL`). SWA preview origins are **not** Entra redirect URIs for this flow. |
| Swagger UI OAuth2 (PKCE) | **Web** redirect: `https://api.plattform-kit.poc.singletonsd.com/docs/oauth2-redirect.html` (and local `http://localhost:3001/docs/oauth2-redirect.html`). Do **not** use SPA platform for this URI. |
| MSAL / Bearer SPA | Entra **does not** accept `*.azurestaticapps.net` wildcards for SPA redirect URIs. Add the **exact** PR preview origin (and logout URI) in the Entra app registration when testing login on that PR, or use the stable SWA default hostname for non-PR default-host checks. MSAL uses `window.location.origin` as `redirectUri` and **redirect** (not popup) so Entra COOP cannot break `window.closed`. SWA also sets `Cross-Origin-Opener-Policy: same-origin-allow-popups`. |

### Build / GitHub Variables

`preview-web.yml` / `deploy-web.yml` bake (IDs only, no secrets):

- `NEXT_PUBLIC_AZURE_AD_CLIENT_ID`
- `NEXT_PUBLIC_AZURE_AD_TENANT_ID`
- `NEXT_PUBLIC_AZURE_AD_API_SCOPE` (optional)

Set matching repo **Variables**. Prefer the exposed delegated scope `api://api.plattform-kit.poc.singletonsd.com/access_as_user` (SPA-friendly); `.default` is a fallback for confidential clients. Expect access-token `aud` = Entra app client id when `requestedAccessTokenVersion` is `2` — Nest accepts client id and `AZURE_AD_API_AUDIENCE`.

### Follow-ups

| Title | Intent |
| --- | --- |
| Preview: SWA API base URL prod vs ACA | Bake `NEXT_PUBLIC_API_BASE_URL` → prod or ACA per PR |

## Human portal follow-ups

Entra app registration, admin consent, and KV/App Config seeding are tracked as human-only ClickUp tickets (may already be complete). Ensure redirect URIs include:

- Auth.js callback (Web): `https://api.plattform-kit.poc.singletonsd.com/api/auth/callback/microsoft-entra-id`
- Swagger OAuth2 (Web, not SPA): `https://api.plattform-kit.poc.singletonsd.com/docs/oauth2-redirect.html`

Also ensure App Service/App Config expose `AUTH_*` / `AZURE_AD_*` / `AUTH_COOKIE_DOMAIN` / `AUTH_URL`. When testing MSAL on a SWA PR preview, add that preview’s exact origin as a SPA redirect URI (see pattern above). Also set GitHub Variables `NEXT_PUBLIC_AZURE_AD_CLIENT_ID` / `NEXT_PUBLIC_AZURE_AD_TENANT_ID` (and optional API scope).
