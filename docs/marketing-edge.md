# Marketing edge (public HTTP)

`[repo=singleton-sd/poc-plattform-kit]`

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
| Validate → Forward Email and/or enqueue `notifications.send` | Write product Azure SQL / CRM Contact pillar tables from the edge |
| Load secrets from Key Vault via App Config + managed identity | Bake provider keys into SWA or GitHub Secrets |
| Expose a stable `PUBLIC_MARKETING_API_BASE_URL` to Astro | Point marketing forms at Nest `PUBLIC_API_BASE_URL` / `NEXT_PUBLIC_API_BASE_URL` |

Decap GitHub OAuth routes already live on this Function App; Contact and OAuth share a **host**, not a domain model. Prefer clear route prefixes (e.g. `/contact` vs `/auth`, `/callback`).

## Env (marketing SWA build)

| Key | Purpose |
| --- | --- |
| `PUBLIC_MARKETING_API_BASE_URL` | Origin of `ssd-pocpk-decap-oauth-dev-ae` (custom hostname when added, else `*.azurewebsites.net`) |

## Forward Email + contact delivery config

| Kind | Store | Name / key |
| --- | --- | --- |
| API key | Key Vault `ssd-pocpk-kv-dev-ae` | `forwardemail-api-key` |
| KV reference | App Config `ssd-pocpk-appcs-dev-ae` | `secret:forwardemail-api-key` |
| Base URL (optional) | App Config plain | `app:notifications:forwardEmailBaseUrl` (default `https://api.forwardemail.net`) |
| Inbox | App Config plain | `app:notifications:contactInboxEmail` |
| From | App Config plain | `app:notifications:contactFromEmail` |

Human/ops set the KV value (never commit or paste into ClickUp/git). See commands in the ClickUp ticket **Provision Forward Email Key Vault + App Config keys** and SETUP.md.

## Related tickets

| Ticket | Intent |
| --- | --- |
| Decision / docs | this policy |
| Provision Forward Email KV + App Config | create missing secret + config keys |
| Move Contact to marketing-edge Function | re-home from Nest `POST /contact` |
| Notifications `notifications.send` consumer | async delivery worker |

See also [marketing-astro-decap.md](./marketing-astro-decap.md).
