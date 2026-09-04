# Azure infrastructure (poc-plattform-kit)

Idempotent Bicep for the PoC stack. **No secrets in git.**

**Subscription:** `ssd-poc-plattform-kit` / `7b8343d7-969f-4b71-8864-b7925e7fae30`
**Resource group:** `rg-poc-plattform-kit` (`australiaeast`)

## Locked constraints

### Cost (cheapest that works)

| Resource | PoC SKU | Notes |
| --- | --- | --- |
| Neon PostgreSQL | Neon Free / Launch | PoC relational DB (`neondb`); not provisioned by this Bicep — set KV `database-url*` |
| App Service Plan | **B1** | Required for custom-domain managed TLS + Nest always-on |
| Static Web Apps | **Free** ×2 | App (`pocpk-web-…`) + marketing (`ssd-pocpk-mkt-dev-ae`); region often `eastasia` for Free |
| Service Bus | **Standard** | Topics required — Basic is queues-only; never Premium |
| Key Vault | **Standard** | No Premium HSM |
| App Configuration | **Free** | Non-secret config + KV references |
| ACR | **Basic** | API PR images; alphanumeric name only |
| Container Apps (API previews) | **Consumption** | Ephemeral `ssd-pocpk-aca-pr-<n>-ae`; scale to zero |
| Container Apps (OpenFGA) | **Consumption** | `ssd-pocpk-openfga-dev-ae`; PostgreSQL on Neon (`openfga` database) |
| Log Analytics | **PerGB2018** | 30-day retention; shared by CAE + App Insights |
| Application Insights | **Workspace-based** | Shared BE+FE sink |

### Naming

**New resources (CAF):** `{org}-{app}-{resource}-{env}-{region}`

Example: `ssd-pocpk-kv-dev-ae`, `ssd-pocpk-appcs-dev-ae`

| Token | Value |
| --- | --- |
| org | `ssd` |
| app | `pocpk` |
| env | `dev` |
| region | `ae` = australiaeast; SWA Free may stay `eastasia` |

**Existing resources (legacy — do not rename):** `pocpk-{resource}-{uniqueString}` from first deploy. Renaming would recreate API/SWA/SB. Keep them; map in docs. Legacy Azure SQL (`pocpk-sql-…`) is no longer in `main.bicep`; delete after Neon cutover (#292).

## Resources (live)

| Resource | Live name | CAF alias (not renamed) | SKU |
| --- | --- | --- | --- |
| Resource group | `rg-poc-plattform-kit` | — | — |
| Key Vault | `ssd-pocpk-kv-dev-ae` | (CAF) | Standard |
| App Configuration | `ssd-pocpk-appcs-dev-ae` | (CAF) | Free |
| Neon PostgreSQL | project `round-union-05852948` / DB `neondb` | — | Neon (outside Azure) |
| App Service Plan / API | `pocpk-plan` / `pocpk-api-si5fhs6dvxiha` | `ssd-pocpk-plan-dev-ae` / `ssd-pocpk-api-dev-ae` | **B1** |
| Static Web App (app) | `pocpk-web-si5fhs6dvxiha` | `ssd-pocpk-swa-dev-ae` | Free |
| Static Web App (marketing) | `ssd-pocpk-mkt-dev-ae` | (CAF) | Free |
| Service Bus | `pocpk-sb-si5fhs6dvxiha` | `ssd-pocpk-sb-dev-ae` | Standard |
| Container Apps Env | `ssd-pocpk-cae-dev-ae` | (CAF) | Consumption |
| Log Analytics | `ssd-pocpk-law-dev-ae` | (CAF) | PerGB2018 (CAE + App Insights) |
| Application Insights | `ssd-pocpk-appi-dev-ae` | (CAF) | Workspace-based |
| ACR | `ssdpocpkacrdevae` | CAF would be `ssd-pocpk-acr-dev-ae` (hyphens illegal) | Basic |
| Ephemeral ACA (API PR) | `ssd-pocpk-aca-pr-<n>-ae` | (CAF) | Consumption |
| Ephemeral ACA (web PR) | `ssd-pocpk-aca-web-pr-<n>-ae` | (CAF) | Consumption |
| OpenFGA Container App | `ssd-pocpk-openfga-dev-ae` | (CAF) | Consumption (min 1) |

### Key Vault secret names (values never in git)

| Secret name | Source env var |
| --- | --- |
| `database-url` | `DATABASE_URL` (Neon pooled — hostname includes `-pooler`) |
| `database-url-unpooled` | `DATABASE_URL_UNPOOLED` (Neon direct — Prisma migrate / schema) |
| `servicebus-connection-string` | `AZURE_SERVICEBUS_CONNECTION_STRING` |
| `swa-deployment-token` | (from `az staticwebapp secrets list` — app SWA) |
| `swa-marketing-deployment-token` | (from marketing SWA `ssd-pocpk-mkt-dev-ae`) |
| `acr-admin-username` | (from `az acr credential show`) |
| `acr-admin-password` | (from `az acr credential show`) |
| `acr-login-server` | e.g. `ssdpocpkacrdevae.azurecr.io` |
| `forwardemail-api-key` | `FORWARDEMAIL_API_KEY` |
| `sms-gateway-username` | `SMS_GATEWAY_USERNAME` |
| `sms-gateway-password` | `SMS_GATEWAY_PASSWORD` |
| `whatsapp-cloud-access-token` | `WHATSAPP_CLOUD_ACCESS_TOKEN` |
| `appinsights-connection-string` | `APPLICATIONINSIGHTS_CONNECTION_STRING` |
| `auth-secret` | `AUTH_SECRET` |
| `azure-ad-client-secret` | `AZURE_AD_CLIENT_SECRET` |
| `chromatic-project-token` | Chromatic project token (OIDC → KV at runtime) |
| `openfga-database-url` | Neon pooled URI for OpenFGA runtime (`OPENFGA_DATASTORE_URI`) |
| `openfga-database-url-unpooled` | Neon direct URI for OpenFGA migrate (`OPENFGA_DATASTORE_URI_UNPOOLED`) |

**Org devtools vault** (`ssd-devtools-kv-prod-ae`, not this app vault): `github-automation-pat` — org-wide platform automation PAT for ruleset-bypass git pushes (`SETUP.md`).

Auth.js Option B (Free SWA): set App Config `app:auth:url` + `app:auth:cookieDomain` and wire `AUTH_*` / `AZURE_AD_*` on App Service (secrets from KV). Do **not** require SWA Standard linked backends for SSO cookies — see `docs/sso.md`.

Vault URI: `https://ssd-pocpk-kv-dev-ae.vault.azure.net/`

**Org devtools Key Vault (CI/provision — not app runtime):** `ssd-devtools-kv-prod-ae` in subscription **Singleton SD** (`01c0bb8b-3770-4765-979a-cb13ae7e3dd2`), RG `ssd-devtools-rg-prod-ae`. Shared across org repos; GitHub Actions OIDC reads CI secrets here (e.g. org-wide `github-automation-pat`). App managed identities do **not** get access. See `SETUP.md` → Platform GitHub automation PAT.

### App Configuration

Endpoint: `https://ssd-pocpk-appcs-dev-ae.azconfig.io`

| Key | Type |
| --- | --- |
| `app:api:baseUrl` | plain — `https://api.plattform-kit.poc.singletonsd.com` |
| `app:web:baseUrl` | plain — `https://app.plattform-kit.poc.singletonsd.com` |
| `app:marketing:baseUrl` | plain — `https://plattform-kit.poc.singletonsd.com` |
| `app:web:swaName` | plain |
| `app:marketing:swaName` | plain — `ssd-pocpk-mkt-dev-ae` |
| `app:cors:origins` | plain — comma-separated allowed browser origins; use `https://{swaName}*.azurestaticapps.net` for this repo’s SWA Free hosts (not open `https://*.azurestaticapps.net`). Web **PR** previews are ACA (`ssd-pocpk-aca-web-pr-<n>-ae`); Nest also allows those hosts in code even when this list is overridden. |
| `app:auth:url` | plain — Auth.js `AUTH_URL` (API public origin) |
| `app:auth:cookieDomain` | plain — Auth.js cookie Domain (Option B; e.g. `.plattform-kit.poc.singletonsd.com`) |
| `app:azure:resourceGroup` | plain |
| `app:azure:keyVaultName` | plain |
| `app:azureAd:clientId` | plain — Entra SPA/API client ID → `AZURE_AD_CLIENT_ID` |
| `app:azureAd:tenantId` | plain — Entra tenant ID → `AZURE_AD_TENANT_ID` |
| `app:azureAd:apiAudience` | plain — API app ID URI → `AZURE_AD_API_AUDIENCE` |
| `secret:database-url` | Key Vault reference (Neon pooled) |
| `secret:servicebus-connection-string` | Key Vault reference |
| `secret:swa-deployment-token` | Key Vault reference |
| `secret:swa-marketing-deployment-token` | Key Vault reference |
| `secret:appinsights-connection-string` | Key Vault reference |
| `secret:auth-secret` | Key Vault reference → `AUTH_SECRET` |
| `secret:azure-ad-client-secret` | Key Vault reference → `AZURE_AD_CLIENT_SECRET` |
| `app:telemetry:cloudRoleName:api` | plain (`api`) |
| `app:telemetry:cloudRoleName:web` | plain (`web`) |
| `app:openfga:apiUrl` | plain — OpenFGA HTTPS base URL → `OPENFGA_API_URL` |
| `app:openfga:storeId` | plain — store id from bootstrap → `OPENFGA_STORE_ID` |
| `app:openfga:authorizationModelId` | plain → `OPENFGA_AUTHORIZATION_MODEL_ID` |
| `app:openfga:audience` | plain — `api://{tenantId}/ssd-pocpk-openfga` → `OPENFGA_AUDIENCE` |

### Custom domains

| Hostname | Resource |
| --- | --- |
| `plattform-kit.poc.singletonsd.com` | Marketing SWA `ssd-pocpk-mkt-dev-ae` |
| `app.plattform-kit.poc.singletonsd.com` | App SWA `pocpk-web-si5fhs6dvxiha` |
| `api.plattform-kit.poc.singletonsd.com` | App Service `pocpk-api-si5fhs6dvxiha` (B1) |

DNS: AWS Route53 CNAMEs (+ Azure validation TXT). See `SETUP.md`.

Also: non-secret notification provider URLs / WhatsApp phone-number-id / Graph API version (plain); notification secrets only as Key Vault references.

**How apps load config:** use the Azure App Configuration provider (or SDK) with **managed identity**. Resolve Key Vault references with the same (or app) identity that has **Key Vault Secrets User**. Do not embed secret values in App Config.

**How CI loads secrets:** GitHub Actions OIDC (`azure/login` + Variables `AZURE_CLIENT_ID` / `AZURE_TENANT_ID` / `AZURE_SUBSCRIPTION_ID`) → `az keyvault secret show`. Never GitHub Secrets for tokens/passwords.

### API PR previews (Container Apps)

```powershell
az account set --subscription 7b8343d7-969f-4b71-8864-b7925e7fae30
powershell -File ./infra/deploy-aca-preview.ps1 -WhatIf
powershell -File ./infra/deploy-aca-preview.ps1
```

Bicep: `container-apps-preview.bicep`. Workflow: `.github/workflows/preview-api.yml`. Docs: `docs/pr-pipelines.md`.

### Service Bus topics

`tenant.events`, `single-sign-on.events`, `permissions.events`, `subscriptions.events`, `contact.events`, `support.events`, `audit.events`, `reporting.events`, `notifications.events`

Subscriptions `audit`, `reporting`, `support`, `notifications` on each publishing topic (`tenant` / `single-sign-on` / `permissions` / `subscriptions` / `contact`).

Subscriptions `audit`, `reporting`, `support` on `notifications.events`.

### Service Bus queues

| Queue | Purpose |
| --- | --- |
| `notifications.send` | Explicit “send notification” commands from other pillars |

### Notifications / channels (locked)

| Channel | Provider | Adapter |
| --- | --- | --- |
| Email | Forward Email API | `EmailProvider` |
| SMS | android-sms-gateway (self-hosted) | `SmsProvider` |
| WhatsApp | Meta WhatsApp Cloud API (default; swappable) | `WhatsAppProvider` |

### Permissions / OpenFGA (locked)

Fine-grained authZ lives in the **Permissions** pillar. PoC engine: **OpenFGA** on **Azure Container Apps Consumption** (`ssd-pocpk-openfga-dev-ae` on CAE `ssd-pocpk-cae-dev-ae`). Azure RBAC/Entra are not used for per-item domain ACL.

| Concern | Choice |
| --- | --- |
| Image | `openfga/openfga:v1.18.3` (pin in `infra/openfga.bicep`) |
| Datastore | **PostgreSQL** on **Neon** (`openfga` database on branch `production`). Deploy script upserts pooled + direct URIs into Key Vault (`openfga-database-url`, `openfga-database-url-unpooled`) and passes them to ACA as secrets. Init container runs `openfga migrate`; runtime uses pooled URI. Single replica (`minReplicas=1` / `maxReplicas=1`) for PoC. Portable to Azure Database for PostgreSQL Flexible Server by swapping the connection string. |
| AuthN | `OPENFGA_AUTHN_METHOD=oidc` → Entra app `api://{tenantId}/ssd-pocpk-openfga` (assignment-required; bare `api://ssd-pocpk-openfga` is blocked by verified-domain URI policy). Nest API App Service system MI (`pocpk-api-si5fhs6dvxiha`) is the sole `OpenFga.Access` assignee. Ephemeral PR ACA identities (`ssd-pocpk-aca-pr-<n>-ae`) are intentionally **not** assigned — preview `Check()` stays fail-closed until a follow-up widens that allowlist. |
| Model | `infra/openfga/model.fga` (+ `model.json` for API push) — `user` (`manager` direct + `in_manager_chain` transitive), `tenant` roles/actions as `[user, user with not_yet_expired]`, `one_time_grant` marker, condition `not_yet_expired` |
| Bootstrap | `./infra/deploy-openfga.sh` (idempotent: Bicep + Entra + store/model + App Config `app:openfga:*`) |

```bash
az account set --subscription 7b8343d7-969f-4b71-8864-b7925e7fae30
pwsh ./infra/deploy-aca-preview.ps1   # CAE must exist first (see #296 for bash migration)
./infra/deploy-openfga.sh --what-if
./infra/deploy-openfga.sh
```

OIDC deploy auth matches `preview-api.yml`: Azure CLI / GitHub OIDC Variables (`AZURE_CLIENT_ID` / `AZURE_TENANT_ID` / `AZURE_SUBSCRIPTION_ID`) — never `AZURE_CREDENTIALS` or deploy tokens in GitHub Secrets.

## Prerequisites

- Azure CLI (`az`) logged in with access to subscription `7b8343d7-969f-4b71-8864-b7925e7fae30`
- PowerShell 7+ (for `deploy.ps1` / `deploy-aca-preview.ps1` until [#296](https://github.com/singleton-sd/poc-plattform-kit/issues/296))
- Bash 4+, `curl`, `python3` (required by `infra/deploy-openfga.sh`)
- Neon CLI via `npx neon` when repo `.env` has no `OPENFGA_DATASTORE_URI*` values
- Providers registered: `Microsoft.KeyVault`, `Microsoft.AppConfiguration`, `Microsoft.Insights`, `Microsoft.OperationalInsights`

```powershell
az account set --subscription 7b8343d7-969f-4b71-8864-b7925e7fae30
pwsh ./infra/deploy.ps1 -WhatIf   # preview
pwsh ./infra/deploy.ps1           # create / update (idempotent)
powershell -File ./infra/deploy-aca-preview.ps1   # CAE + ACR for API PR previews
./infra/deploy-openfga.sh       # OpenFGA ACA + store/model bootstrap
```

`deploy.ps1` upserts SB/SWA/App Insights secrets into Key Vault (and Neon `database-url*` when present in local `.env`), seeds App Config plain keys + KV refs, and mirrors non-secret + secret cache into local `.env` (gitignored).
`deploy-aca-preview.ps1` upserts ACR admin secrets (`acr-admin-*`) into the same vault.
`deploy-openfga.sh` provisions OpenFGA on ACA (Neon PostgreSQL datastore), Entra OIDC app, store/model bootstrap, and `app:openfga:*` App Config keys. Requires Neon connection strings in repo `.env` (`OPENFGA_DATASTORE_URI` / `OPENFGA_DATASTORE_URI_UNPOOLED`) or a linked `neon` CLI project.
`migrate-db.ps1` pulls Key Vault `database-url` + `database-url-unpooled` into gitignored `packages/db/.env` and runs `prisma migrate deploy` against Neon PostgreSQL (forward-only; never commit the `.env`).

**Neon `database-url` pattern (human-set):**

```bash
./scripts/neon-env-pull.sh   # writes DATABASE_URL / DATABASE_URL_UNPOOLED to repo-root .env
az keyvault secret set --vault-name ssd-pocpk-kv-dev-ae --name database-url --file <(printenv DATABASE_URL)
# or: az keyvault secret set --vault-name … --name database-url --value "$DATABASE_URL"
az keyvault secret set --vault-name ssd-pocpk-kv-dev-ae --name database-url-unpooled --value "$DATABASE_URL_UNPOOLED"
# Prisma Migrate / packages/db scripts read packages/db/.env — use migrate-db.ps1 to pull KV → that file
```

`deploy.ps1` only upserts local `DATABASE_URL*` when the scheme is `postgresql://` / `postgres://` (rejects leftover `sqlserver://` values from older deploys).

App Service continues to resolve `DATABASE_URL` from `@Microsoft.KeyVault(.../secrets/database-url/)`. Do not recreate `sql-admin-password` — Azure SQL is out of IaC; live server deletion is #292.

```powershell
pwsh ./infra/migrate-db.ps1 -WhatIf
pwsh ./infra/migrate-db.ps1
pwsh ./infra/migrate-db.ps1 -StatusOnly
```

## Secrets & config surfaces

| Surface | How |
| --- | --- |
| Local | `az keyvault secret show` / App Config (optional `.env` cache) |
| GitHub Actions | OIDC → Azure login → Key Vault / App Config / ACR / ACA at runtime |
| App Service / SWA / ACA | App Configuration provider + `@Microsoft.KeyVault(...)` / KV refs via MI |

**App Service secret app settings (IaC only):** `DATABASE_URL` is set in `main.bicep` as
`@Microsoft.KeyVault(SecretUri=https://{keyVaultName}.vault.azure.net/secrets/database-url/)`
so the platform injects the value via the web app’s system-assigned identity (Key Vault
Secrets User). Never write this in `deploy-api.yml` (appsettings changes restart SCM and
abort OneDeploy). Apply one-off live updates with `az webapp config appsettings set`
outside the zip-deploy job, then keep Bicep in sync.

Do not paste secrets into ClickUp, GitHub Secrets, or git.
