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
| `GET /health` (`@Public()`) | `GET /api/me` |
| `/api/auth/*` (Auth.js) | `/tenants/**` (and other domain routes as they land) |
| `/docs`, `/docs-json` (Swagger) | |

Mark additional Nest handlers with `@Public()` when they must stay anonymous. Coarse Entra app roles use `@Roles('tenant-admin' \| 'support-agent')` (e.g. `POST /tenants`, `PATCH /tenants/:id`).

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
| CORS | App (+ marketing) origins + `https://*.azurestaticapps.net` with `credentials: true` |
| SPA calls | Absolute API base (`NEXT_PUBLIC_API_BASE_URL`), not same-origin `/api` |

Sibling subdomains under `singletonsd.com` are same-site, so `SameSite=Lax` + shared cookie Domain is enough for credentialed `fetch` from `app.` → `api.`.

Do **not** upgrade app SWA to Standard solely for `/api` linking unless cost lock is explicitly revised.

## SWA PR previews

Preview hosts stay on `*.azurestaticapps.net` (no custom preview domains). They cannot share the PoC cookie Domain.

### CORS (locked)

`CORS_ORIGINS` / App Config `app:cors:origins` includes:

- Custom domains: `https://app.plattform-kit.poc.singletonsd.com`, `https://plattform-kit.poc.singletonsd.com`
- Host wildcard: `https://*.azurestaticapps.net` (SWA default hostname + PR preview hosts such as `https://kind-rock-…-57.eastasia.7.azurestaticapps.net`)

Nest resolves wildcards at request time (`isCorsOriginAllowed`). The same allowlist gates Auth.js post-login `redirect` callbacks so returns to SWA preview origins are permitted. Applies to prod App Service and ACA PR API previews (same Nest bootstrap).

### Entra redirect URIs (approved pattern)

| Flow | Redirect URI |
| --- | --- |
| Auth.js (Option B cookies) | API callback only: `https://api.plattform-kit.poc.singletonsd.com/api/auth/callback/microsoft-entra-id` (`AUTH_URL`). SWA preview origins are **not** Entra redirect URIs for this flow. |
| MSAL / Bearer SPA (follow-up) | Entra **does not** accept `*.azurestaticapps.net` wildcards for SPA redirect URIs. Add the **exact** PR preview origin (and logout URI) in the Entra app registration when testing login on that PR, or use the stable SWA default hostname for non-PR default-host checks. |

Cookie sessions still will not stick on SWA preview hosts (wrong `Domain`). Track Bearer/MSAL separately:

| Title | Intent |
| --- | --- |
| Preview: SWA API base URL prod vs ACA | Bake `NEXT_PUBLIC_API_BASE_URL` → prod or ACA per PR |
| Preview: Bearer Entra auth for SWA PR hosts | MSAL / Bearer for preview (Nest already accepts JWT) |

## Human portal follow-ups

Entra app registration, admin consent, and KV/App Config seeding are tracked as human-only ClickUp tickets (may already be complete). Ensure SPA redirect URIs include the API callback (`https://api.plattform-kit.poc.singletonsd.com/api/auth/callback/microsoft-entra-id`) and that App Service/App Config expose `AUTH_*` / `AZURE_AD_*` / `AUTH_COOKIE_DOMAIN` / `AUTH_URL`. When testing MSAL on a SWA PR preview, add that preview’s exact origin as a SPA redirect URI (see pattern above).
