# SingleSignOn (Entra JWT + Auth.js cookies)

`[repo=singleton-sd/poc-plattform-kit]`

## Runtime contract

| Surface | Behaviour |
| --- | --- |
| Nest `/api/auth/*` | Auth.js (`@auth/express`) Microsoft Entra ID provider; httpOnly session cookies |
| Nest `GET /api/me` | Cookie session **or** Bearer Entra access token to `{ id, email, name, role }` |
| JWT guard | Validates Entra JWTs via JWKS (`AZURE_AD_TENANT_ID`, `AZURE_AD_API_AUDIENCE`) |
| Web SPA | Static export; `fetch('/api/me', { credentials: 'include' })` |

## Env (see `.env.example`)

`AUTH_SECRET`, `AZURE_AD_CLIENT_ID`, `AZURE_AD_CLIENT_SECRET`, `AZURE_AD_TENANT_ID`, `AZURE_AD_API_AUDIENCE`

KV secret names (human): `auth-secret`, `azure-ad-client-secret`.

## Same-origin cookies

SWA Free hosts the static SPA. Cookies require `/api/*` to hit Nest (App Service), not `navigationFallback` to `index.html`. See **Link SWA /api to App Service for SSO cookies**.

## Human portal follow-ups

- **Register Entra SPA + API apps for Platform Kit SSO**
- **Grant Entra admin consent for Platform Kit SSO**
- **Store Auth.js and Entra secrets in Key Vault**
