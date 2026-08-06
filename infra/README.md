# Azure infrastructure (poc-plattform-kit)

Idempotent Bicep for the PoC stack. **No secrets in git.**

**Subscription:** `ssd-poc-plattform-kit` / `7b8343d7-969f-4b71-8864-b7925e7fae30`
**Resource group:** `rg-poc-plattform-kit` (`australiaeast`)

## Locked constraints

### Cost (cheapest that works)

| Resource | PoC SKU | Notes |
| --- | --- | --- |
| Azure SQL DB | **Basic** (5 DTU) | Do not use Hyperscale / high GP |
| App Service Plan | **B1** | Required for custom-domain managed TLS + Nest always-on |
| Static Web Apps | **Free** ×2 | App (`pocpk-web-…`) + marketing (`ssd-pocpk-mkt-dev-ae`); region often `eastasia` for Free |
| Service Bus | **Standard** | Topics required — Basic is queues-only; never Premium |
| Key Vault | **Standard** | No Premium HSM |
| App Configuration | **Free** | Non-secret config + KV references |
| ACR | **Basic** | API PR images; alphanumeric name only |
| Container Apps (API previews) | **Consumption** | Ephemeral `ssd-pocpk-aca-pr-<n>-ae`; scale to zero |
| Container Apps (OpenFGA) | **Consumption** | Permissions pillar authZ engine — not an Azure product name |

### Naming

**New resources (CAF):** `{org}-{app}-{resource}-{env}-{region}`

Example: `ssd-pocpk-kv-dev-ae`, `ssd-pocpk-appcs-dev-ae`

| Token | Value |
| --- | --- |
| org | `ssd` |
| app | `pocpk` |
| env | `dev` |
| region | `ae` = australiaeast; SWA Free may stay `eastasia` |

**Existing resources (legacy — do not rename):** `pocpk-{resource}-{uniqueString}` from first deploy. Renaming would recreate SQL/API/SWA/SB. Keep them; map in docs.

## Resources (live)

| Resource | Live name | CAF alias (not renamed) | SKU |
| --- | --- | --- | --- |
| Resource group | `rg-poc-plattform-kit` | — | — |
| Key Vault | `ssd-pocpk-kv-dev-ae` | (CAF) | Standard |
| App Configuration | `ssd-pocpk-appcs-dev-ae` | (CAF) | Free |
| SQL Server / DB | `pocpk-sql-si5fhs6dvxiha` / `pocpk` | `ssd-pocpk-sql-dev-ae` | Basic |
| App Service Plan / API | `pocpk-plan` / `pocpk-api-si5fhs6dvxiha` | `ssd-pocpk-plan-dev-ae` / `ssd-pocpk-api-dev-ae` | **B1** |
| Static Web App (app) | `pocpk-web-si5fhs6dvxiha` | `ssd-pocpk-swa-dev-ae` | Free |
| Static Web App (marketing) | `ssd-pocpk-mkt-dev-ae` | (CAF) | Free |
| Service Bus | `pocpk-sb-si5fhs6dvxiha` | `ssd-pocpk-sb-dev-ae` | Standard |
| Container Apps Env | `ssd-pocpk-cae-dev-ae` | (CAF) | Consumption |
| Log Analytics | `ssd-pocpk-law-dev-ae` | (CAF) | PerGB2018 (CAE required) |
| ACR | `ssdpocpkacrdevae` | CAF would be `ssd-pocpk-acr-dev-ae` (hyphens illegal) | Basic |
| Ephemeral ACA (PR) | `ssd-pocpk-aca-pr-<n>-ae` | (CAF) | Consumption |

### Key Vault secret names (values never in git)

| Secret name | Source env var |
| --- | --- |
| `sql-admin-password` | `AZURE_SQL_ADMIN_PASSWORD` |
| `database-url` | `DATABASE_URL` |
| `servicebus-connection-string` | `AZURE_SERVICEBUS_CONNECTION_STRING` |
| `swa-deployment-token` | (from `az staticwebapp secrets list` — app SWA) |
| `swa-marketing-deployment-token` | (from marketing SWA `ssd-pocpk-mkt-dev-ae`) |
| `acr-admin-username` | (from `az acr credential show`) |
| `acr-admin-password` | (from `az acr credential show`) |
| `acr-login-server` | e.g. `ssdpocpkacrdevae.azurecr.io` |
| `forwardemail-api-key` | `FORWARDEMAIL_API_KEY` |
| `sms-gateway-username` | `SMS_GATEWAY_USERNAME` |
| `sms-gateway-password` | `SMS_GATEWAY_PASSWORD` |
| `whatsapp-cloud-access-token` | `WHATSAPP_CLOUD_ACCESS_TOKEN` || *(future)* `auth-secret` | `AUTH_SECRET` |
| *(future)* `azure-ad-client-secret` | `AZURE_AD_CLIENT_SECRET` |

Vault URI: `https://ssd-pocpk-kv-dev-ae.vault.azure.net/`

### App Configuration

Endpoint: `https://ssd-pocpk-appcs-dev-ae.azconfig.io`

| Key | Type |
| --- | --- |
| `app:api:baseUrl` | plain — `https://api.plattform-kit.poc.singletonsd.com` |
| `app:web:baseUrl` | plain — `https://app.plattform-kit.poc.singletonsd.com` |
| `app:marketing:baseUrl` | plain — `https://plattform-kit.poc.singletonsd.com` |
| `app:web:swaName` | plain |
| `app:marketing:swaName` | plain — `ssd-pocpk-mkt-dev-ae` |
| `app:cors:origins` | plain — comma-separated allowed browser origins |
| `app:azure:resourceGroup` | plain |
| `app:azure:keyVaultName` | plain |
| `secret:database-url` | Key Vault reference |
| `secret:servicebus-connection-string` | Key Vault reference |
| `secret:swa-deployment-token` | Key Vault reference |
| `secret:swa-marketing-deployment-token` | Key Vault reference |
| `secret:sql-admin-password` | Key Vault reference |

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

Fine-grained authZ lives in the **Permissions** pillar. PoC engine: **OpenFGA** hosted on **Azure Container Apps Consumption** (CAF name e.g. `ssd-pocpk-openfga-dev-ae` when provisioned). Azure RBAC/Entra are not used for per-item domain ACL.

## Prerequisites

- Azure CLI (`az`) logged in with access to subscription `7b8343d7-969f-4b71-8864-b7925e7fae30`
- PowerShell 7+
- Providers registered: `Microsoft.KeyVault`, `Microsoft.AppConfiguration`

```powershell
az account set --subscription 7b8343d7-969f-4b71-8864-b7925e7fae30
pwsh ./infra/deploy.ps1 -WhatIf   # preview
pwsh ./infra/deploy.ps1           # create / update (idempotent)
powershell -File ./infra/deploy-aca-preview.ps1   # CAE + ACR for API PR previews
```

`deploy.ps1` upserts SQL/SB/SWA secrets into Key Vault, seeds App Config plain keys + KV refs, and mirrors non-secret + secret cache into local `.env` (gitignored).
`deploy-aca-preview.ps1` upserts ACR admin secrets (`acr-admin-*`) into the same vault.
`refresh-database-url.ps1` rebuilds KV `database-url` from `sql-admin-password`, resets the SQL admin password to match, and restarts the API App Service (use when Prisma reports auth failure for `pocpkadmin`).

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
