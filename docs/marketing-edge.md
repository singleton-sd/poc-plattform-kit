# Marketing edge (public HTTP)

## Decision (locked for PoC)

**Marketing public HTTP** (brochure Contact form, future anonymous marketing APIs) runs on the existing Azure Function App:

| Piece | Value |
| --- | --- |
| Function App | `ssd-pocpk-decap-oauth-dev-ae` |
| Code | `apps/marketing-oauth` |
| Plan | Shared App Service **B1** `pocpk-plan` (same plan as Nest API; Function is a separate app) |
| Site | Astro SWA Free `ssd-pocpk-mkt-dev-ae` / `plattform-kit.poc.singletonsd.com` |

**Do not** attach marketing Contact (or similar brochure endpoints) to the Nest product API (`apps/api` / `api.plattform-kit.poc.singletonsd.com`) as the long-term surface. Nest remains the authenticated product API.

When marketing HTTP outgrows this host (many routes, heavier auth, noisy deploy coupling with Decap OAuth), migrate behind the same public contract to a dedicated marketing API — do not rewrite the Astro clients ad hoc.

## Guardrails

| Do | Don't |
| --- | --- |
| Anonymous marketing HTTP only (contact, waitlist, demo request) | Product / tenant / SSO APIs |
| Validate → Forward Email via `@poc-plattform-kit/email` (and/or enqueue `notifications.send` later) | Depend on Nest or the Notifications pillar runtime; write product Azure SQL / CRM Contact pillar tables from the edge |
| Load secrets from Key Vault via App Config + managed identity | Bake provider keys into SWA or GitHub Secrets |
| Expose a stable `PUBLIC_MARKETING_API_BASE_URL` to Astro | Point marketing forms at Nest `PUBLIC_API_BASE_URL` / `NEXT_PUBLIC_API_BASE_URL` |

Decap GitHub OAuth routes already live on this Function App; Contact and OAuth share a **host**, not a domain model. Prefer clear route prefixes (e.g. `/contact` vs `/auth`, `/callback`).

Marketing-oauth depends on **`@poc-plattform-kit/email`** (workspace library). It does **not** depend on `@poc-plattform-kit/pillar-notifications`. Function zip deploy vendors the built email package (see `scripts/deploy-decap-oauth.ps1`). App Config keys may still use the `app:notifications:*` prefix — those are shared email runtime settings, not a Nest coupling.

## Env (marketing SWA build)

| Key | Purpose |
| --- | --- |
| `PUBLIC_MARKETING_API_BASE_URL` | Origin of `ssd-pocpk-decap-oauth-dev-ae` (default `https://ssd-pocpk-decap-oauth-dev-ae.azurewebsites.net`) |

Contact form posts to `{PUBLIC_MARKETING_API_BASE_URL}/contact`. Do **not** use Nest `PUBLIC_API_BASE_URL` / `NEXT_PUBLIC_API_BASE_URL` for brochure Contact.

## Forward Email + contact delivery config

| Kind | Store | Name / key → runtime env |
| --- | --- | --- |
| API key | Key Vault `ssd-pocpk-kv-dev-ae` | secret name `forwardemail-api-key` |
| KV reference | App Config `ssd-pocpk-appcs-dev-ae` | `secret:forwardemail-api-key` → **`FORWARD_EMAIL_TOKEN`** |
| Base URL (optional) | App Config plain | `app:notifications:forwardEmailBaseUrl` → `FORWARD_EMAIL_BASE_URL` (default `https://api.forwardemail.net`) |
| Provider | App Config plain | `app:notifications:emailProvider` → `EMAIL_PROVIDER` (`development` locally / previews; `forward-email` in production) |
| From address / name | App Config plain | `app:notifications:emailFromAddress` → `EMAIL_FROM_ADDRESS`; `app:notifications:emailFromName` → `EMAIL_FROM_NAME` |
| Inbox | App Config plain | `app:notifications:contactInboxAddress` → `CONTACT_INBOX_ADDRESS` |
| Production send gate | App Config plain | `app:notifications:emailAllowProductionSend` → `EMAIL_ALLOW_PRODUCTION_SEND` (must be `true` on prod hosts only) |

Human/ops set the KV value (never commit or paste into ClickUp/git). Prefer runtime names `FORWARD_EMAIL_TOKEN` / `EMAIL_*` / `CONTACT_INBOX_ADDRESS`; the KV secret **name** remains `forwardemail-api-key`. See [email-forward-email.md](./email-forward-email.md), the ClickUp ticket **Provision Forward Email Key Vault + App Config keys**, and SETUP.md.

## Related tickets

| Ticket | Intent |
| --- | --- |
| Decision / docs | this policy |
| Provision Forward Email KV + App Config | create missing secret + config keys |
| Move Contact to marketing-edge Function | re-home from Nest `POST /contact` |
| Notifications `notifications.send` consumer | async delivery worker |

See also [marketing-astro-decap.md](./marketing-astro-decap.md).
