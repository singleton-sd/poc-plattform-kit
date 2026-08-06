# SingleSignOn (Entra JWT + Auth.js cookies)

`[repo=singleton-sd/poc-plattform-kit]`

## Runtime contract

| Surface | Behaviour |
| --- | --- |
| Nest `/api/auth/*` | Auth.js (`@auth/express`) Microsoft Entra ID provider; httpOnly session cookies |
| Nest `GET /api/me` | Cookie session **or** Bearer Entra access token to `{ id, email, name, role }` |
| Global `APP_GUARD` | `SessionOrJwtAuthGuard` + `RolesGuard` — non-public Nest routes require session or Bearer |
| JWT guard | Validates Entra JWTs via JWKS (`AZURE_AD_TENANT_ID`, `AZURE_AD_API_AUDIENCE`) |
| Web SPA | Static export; `fetch('/api/me', { credentials: 'include' })` |

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

`AUTH_SECRET`, `AZURE_AD_CLIENT_ID`, `AZURE_AD_CLIENT_SECRET`, `AZURE_AD_TENANT_ID`, `AZURE_AD_API_AUDIENCE`

KV secret names (human): `auth-secret`, `azure-ad-client-secret`.

## Same-origin cookies

SWA Free hosts the static SPA. Cookies require `/api/*` to hit Nest (App Service), not `navigationFallback` to `index.html`. See **Link SWA /api to App Service for SSO cookies**.

## Human portal follow-ups

Entra app registration, admin consent, and KV/App Config seeding are tracked as human-only ClickUp tickets (may already be complete).
