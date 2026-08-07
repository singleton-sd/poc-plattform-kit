# SingleSignOn (Entra JWT + Auth.js cookies)

`[repo=singleton-sd/poc-plattform-kit]`

## Runtime contract

| Surface | Behaviour |
| --- | --- |
| Nest `/api/auth/*` | Auth.js (`@auth/express`) Microsoft Entra ID provider; httpOnly session cookies |
| Nest `GET /api/me` | Cookie session **or** Bearer Entra access token to `{ id, email, name, role }` |
| Global `APP_GUARD` | `SessionOrJwtAuthGuard` + `RolesGuard` — non-public Nest routes require session or Bearer |
| JWT guard | Validates Entra JWTs via JWKS (`AZURE_AD_TENANT_ID`, `AZURE_AD_API_AUDIENCE`) |
| Web SPA | Static export; `fetch(apiUrl('/api/me'), { credentials: 'include' })` via `NEXT_PUBLIC_API_BASE_URL` |

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
| Default API scope | `AZURE_AD_SWAGGER_SCOPE` / `AZURE_AD_API_SCOPE`, else `api://{AZURE_AD_CLIENT_ID}/.default` (GUID form — required for same-app Swagger tokens; avoids AADSTS90009). Hostname App ID URI alone is not used for Authorize. |
| Redirect URI | `{AUTH_URL}/docs/oauth2-redirect.html` (override with `SWAGGER_OAUTH2_REDIRECT_URL`) |

Register that redirect URI on the Entra app registration as a **SPA** platform redirect (required for browser PKCE from Swagger UI). Prod example: `https://api.plattform-kit.poc.singletonsd.com/docs/oauth2-redirect.html`. Local example: `http://localhost:3001/docs/oauth2-redirect.html`.

## Tenancy

Prefer optional token/session claim `tenant_id` → `AuthenticatedUser.tenantId` over `x-tenant-id`. The header remains a **legacy/dev escape** when the claim is absent; when both are present, the **claim wins** (see `TenancyMiddleware` + `ClaimTenancyInterceptor`). Do not treat Entra directory `tid` as the Platform Kit tenant id.

## Env (see `.env.example`)

`AUTH_SECRET`, `AUTH_URL`, `AUTH_COOKIE_DOMAIN`, `AZURE_AD_CLIENT_ID`, `AZURE_AD_CLIENT_SECRET`, `AZURE_AD_TENANT_ID`, `AZURE_AD_API_AUDIENCE`, `CORS_ORIGINS`, `NEXT_PUBLIC_API_BASE_URL`

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

Preview hosts stay on `*.azurestaticapps.net` (no custom preview domains). They cannot share the PoC cookie Domain.

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
| Swagger UI OAuth2 (PKCE) | SPA redirect: `https://api.plattform-kit.poc.singletonsd.com/docs/oauth2-redirect.html` (and local `http://localhost:3001/docs/oauth2-redirect.html` when testing). |
| MSAL / Bearer SPA (follow-up) | Entra **does not** accept `*.azurestaticapps.net` wildcards for SPA redirect URIs. Add the **exact** PR preview origin (and logout URI) in the Entra app registration when testing login on that PR, or use the stable SWA default hostname for non-PR default-host checks. |

Cookie sessions still will not stick on SWA preview hosts (wrong `Domain`). Track Bearer/MSAL separately:

| Title | Intent |
| --- | --- |
| Preview: SWA API base URL prod vs ACA | Bake `NEXT_PUBLIC_API_BASE_URL` → prod or ACA per PR |
| Preview: Bearer Entra auth for SWA PR hosts | MSAL / Bearer for preview (Nest already accepts JWT) |

## Human portal follow-ups

Entra app registration, admin consent, and KV/App Config seeding are tracked as human-only ClickUp tickets (may already be complete). Ensure SPA redirect URIs include:

- Auth.js callback: `https://api.plattform-kit.poc.singletonsd.com/api/auth/callback/microsoft-entra-id`
- Swagger OAuth2: `https://api.plattform-kit.poc.singletonsd.com/docs/oauth2-redirect.html` (SPA platform)

Also ensure App Service/App Config expose `AUTH_*` / `AZURE_AD_*` / `AUTH_COOKIE_DOMAIN` / `AUTH_URL`. When testing MSAL on a SWA PR preview, add that preview’s exact origin as a SPA redirect URI (see pattern above).
